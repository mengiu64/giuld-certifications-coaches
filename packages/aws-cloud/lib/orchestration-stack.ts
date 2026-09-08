/**
 * OrchestrationStack - Stack annidato per l'orchestrazione della generazione domande.
 *
 * Definisce la macchina a stati Step Functions con i seguenti stati:
 * BuildPlan, IterateQuestions, GenerateQuestion, PersistCheckpoint,
 * CheckThreshold, AssembleBank, PublishEvent.
 *
 * Gestisce 3 funzioni Lambda di orchestrazione con policy IAM specifiche:
 * - buildPlan: lettura/scrittura DynamoDB, lettura SSM
 * - generateQuestion: lettura/scrittura DynamoDB, invocazione Bedrock, lettura SSM
 * - assembleBank: lettura/scrittura DynamoDB, pubblicazione EventBridge, lettura SSM
 */
import * as cdk from 'aws-cdk-lib'; // Importazione del modulo principale CDK
import { aws_stepfunctions as sfn } from 'aws-cdk-lib'; // Servizio Step Functions per l'orchestrazione
import { aws_stepfunctions_tasks as tasks } from 'aws-cdk-lib'; // Task integrati per Step Functions
import { aws_lambda as lambda } from 'aws-cdk-lib'; // Servizio Lambda per le funzioni serverless
import { aws_iam as iam } from 'aws-cdk-lib'; // Servizio IAM per le policy di accesso
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib'; // Tipo DynamoDB per riferimento alla tabella
import { Construct } from 'constructs'; // Classe base per i costrutti CDK
import * as path from 'path'; // Modulo Node.js per la gestione dei percorsi

// Interfaccia per le proprietà accettate dall'OrchestrationStack
export interface OrchestrationStackProps extends cdk.NestedStackProps {
  // Ambiente di deployment (dev, staging, prod)
  readonly environment: string;
  // Riferimento alla tabella DynamoDB definita nel DataStack
  readonly table: dynamodb.Table;
}

// Stack annidato che gestisce l'orchestrazione Step Functions e le Lambda associate
export class OrchestrationStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: OrchestrationStackProps) {
    super(scope, id, props); // Invocazione del costruttore della classe base

    // Recupero dell'ambiente e della tabella dalle proprietà
    const env = props.environment; // Ambiente di deployment corrente
    const table = props.table; // Riferimento alla tabella DynamoDB

    // Nome del bus EventBridge personalizzato per gli eventi di dominio
    const eventBusName = 'aws-exam-generator'; // Bus personalizzato per l'applicazione

    // ARN del bus EventBridge costruito con i parametri dell'account e regione
    const eventBusArn = cdk.Arn.format(
      { service: 'events', resource: 'event-bus', resourceName: eventBusName }, // Formato ARN per il bus
      this, // Contesto dello stack corrente
    );

    // Percorso base dei sorgenti Lambda di orchestrazione
    const orchestrationCodePath = path.join(__dirname, '..', 'src'); // Percorso alla directory src

    // Variabili d'ambiente comuni per tutte le funzioni Lambda di orchestrazione
    const commonEnvVars: Record<string, string> = {
      TABLE_NAME: table.tableName, // Nome della tabella DynamoDB
      EVENT_BUS_NAME: eventBusName, // Nome del bus EventBridge
      SSM_ENV: env, // Ambiente per i percorsi SSM
    };

    // --- Definizione della funzione Lambda buildPlan ---
    const buildPlanFn = new lambda.Function(this, 'BuildPlanFunction', {
      functionName: `${env}-orchestration-buildPlan`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'orchestration/build-plan.handler', // Percorso dell'handler nel bundle
      code: lambda.Code.fromAsset(orchestrationCodePath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente per la configurazione runtime
      timeout: cdk.Duration.seconds(30), // Timeout di 30 secondi per la funzione
      memorySize: 256, // 256 MB di memoria allocata
    });

    // Policy IAM per buildPlan: lettura e scrittura sulla tabella DynamoDB
    table.grantReadWriteData(buildPlanFn); // Permessi di lettura/scrittura sulla tabella

    // Policy IAM per buildPlan: lettura dei parametri SSM
    buildPlanFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW, // Permesso di tipo ALLOW
        actions: ['ssm:GetParameter', 'ssm:GetParameters'], // Azioni SSM consentite
        resources: [
          cdk.Arn.format(
            { service: 'ssm', resource: 'parameter', resourceName: `aws-exam-generator/${env}/*` }, // Percorso SSM con ambiente
            this, // Contesto dello stack corrente
          ),
        ],
      }),
    );

    // --- Definizione della funzione Lambda generateQuestion ---
    const generateQuestionFn = new lambda.Function(this, 'GenerateQuestionFunction', {
      functionName: `${env}-orchestration-generateQuestion`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'orchestration/generate-question.handler', // Percorso dell'handler nel bundle
      code: lambda.Code.fromAsset(orchestrationCodePath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente per la configurazione runtime
      timeout: cdk.Duration.seconds(60), // Timeout di 60 secondi per consentire le invocazioni Bedrock
      memorySize: 256, // 256 MB di memoria allocata
    });

    // Policy IAM per generateQuestion: lettura e scrittura sulla tabella DynamoDB
    table.grantReadWriteData(generateQuestionFn); // Permessi di lettura/scrittura sulla tabella

    // Policy IAM per generateQuestion: invocazione del modello Bedrock
    generateQuestionFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW, // Permesso di tipo ALLOW
        actions: ['bedrock:InvokeModel'], // Azione per invocare il modello Bedrock
        resources: [
          cdk.Arn.format(
            { service: 'bedrock', resource: 'foundation-model', resourceName: 'anthropic.claude-*' }, // ARN dei modelli Claude
            this, // Contesto dello stack corrente
          ),
        ],
      }),
    );

    // Policy IAM per generateQuestion: lettura dei parametri SSM
    generateQuestionFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW, // Permesso di tipo ALLOW
        actions: ['ssm:GetParameter', 'ssm:GetParameters'], // Azioni SSM consentite
        resources: [
          cdk.Arn.format(
            { service: 'ssm', resource: 'parameter', resourceName: `aws-exam-generator/${env}/*` }, // Percorso SSM con ambiente
            this, // Contesto dello stack corrente
          ),
        ],
      }),
    );

    // --- Definizione della funzione Lambda assembleBank ---
    const assembleBankFn = new lambda.Function(this, 'AssembleBankFunction', {
      functionName: `${env}-orchestration-assembleBank`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'orchestration/assemble-bank.handler', // Percorso dell'handler nel bundle
      code: lambda.Code.fromAsset(orchestrationCodePath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente per la configurazione runtime
      timeout: cdk.Duration.seconds(30), // Timeout di 30 secondi per la funzione
      memorySize: 256, // 256 MB di memoria allocata
    });

    // Policy IAM per assembleBank: lettura e scrittura sulla tabella DynamoDB
    table.grantReadWriteData(assembleBankFn); // Permessi di lettura/scrittura sulla tabella

    // Policy IAM per assembleBank: pubblicazione eventi su EventBridge
    assembleBankFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW, // Permesso di tipo ALLOW
        actions: ['events:PutEvents'], // Azione per pubblicare eventi
        resources: [eventBusArn], // ARN specifico del bus EventBridge
      }),
    );

    // Policy IAM per assembleBank: lettura dei parametri SSM
    assembleBankFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW, // Permesso di tipo ALLOW
        actions: ['ssm:GetParameter', 'ssm:GetParameters'], // Azioni SSM consentite
        resources: [
          cdk.Arn.format(
            { service: 'ssm', resource: 'parameter', resourceName: `aws-exam-generator/${env}/*` }, // Percorso SSM con ambiente
            this, // Contesto dello stack corrente
          ),
        ],
      }),
    );

    // --- Definizione della macchina a stati Step Functions ---

    // Stato BuildPlan: invoca la funzione buildPlan per creare il piano di generazione
    const buildPlanState = new tasks.LambdaInvoke(this, 'BuildPlan', {
      lambdaFunction: buildPlanFn, // Funzione Lambda da invocare
      outputPath: '$.Payload', // Estrazione del payload dalla risposta Lambda
      comment: 'Invoca buildPlan per creare il piano di generazione delle domande', // Descrizione dello stato
    });

    // Stato GenerateQuestion: invoca la funzione generateQuestion per generare una singola domanda
    const generateQuestionState = new tasks.LambdaInvoke(this, 'GenerateQuestion', {
      lambdaFunction: generateQuestionFn, // Funzione Lambda da invocare
      outputPath: '$.Payload', // Estrazione del payload dalla risposta Lambda
      comment: 'Invoca generateQuestion per generare una singola domanda con Bedrock', // Descrizione dello stato
    });

    // Configurazione dei tentativi di retry per GenerateQuestion: 3 tentativi con backoff esponenziale
    generateQuestionState.addRetry({
      errors: ['States.ALL'], // Retry su qualsiasi tipo di errore
      maxAttempts: 3, // Numero massimo di tentativi
      interval: cdk.Duration.seconds(1), // Intervallo iniziale di 1 secondo
      backoffRate: 2, // Tasso di backoff esponenziale (1s, 2s, 4s)
    });

    // Configurazione del catch per GenerateQuestion: cattura errori dopo esaurimento retry
    generateQuestionState.addCatch(
      new sfn.Pass(this, 'SkipFailedQuestion', {
        resultPath: '$.error', // Percorso per memorizzare l'errore nello stato
        comment: 'Registra il fallimento e continua con le domande rimanenti', // Descrizione dello stato di skip
      }),
      {
        errors: ['States.ALL'], // Cattura qualsiasi errore residuo
        resultPath: '$.error', // Salva i dettagli dell'errore nel percorso specificato
      },
    );

    // Stato PersistCheckpoint: salva il progresso intermedio dopo ogni domanda generata
    const persistCheckpointState = new tasks.LambdaInvoke(this, 'PersistCheckpoint', {
      lambdaFunction: generateQuestionFn, // Riutilizza generateQuestion per persistere il checkpoint
      outputPath: '$.Payload', // Estrazione del payload dalla risposta Lambda
      comment: 'Persiste il checkpoint del progresso di generazione su DynamoDB', // Descrizione dello stato
    });

    // Stato IterateQuestions: Map state per iterare su tutti gli elementi del piano
    const iterateQuestionsState = new sfn.Map(this, 'IterateQuestions', {
      itemsPath: '$.planItems', // Percorso dell'array di elementi del piano nell'input
      resultPath: '$.results', // Percorso per i risultati dell'iterazione
      maxConcurrency: 1, // Esecuzione sequenziale (una domanda alla volta)
      comment: 'Itera sequenzialmente su ogni elemento del piano di generazione', // Descrizione dello stato Map
    });

    // Definizione del flusso interno al Map state: genera domanda → persisti checkpoint
    iterateQuestionsState.itemProcessor(
      generateQuestionState.next(persistCheckpointState), // Catena: genera → persisti
    );

    // Stato CheckThreshold: verifica se il numero di domande generate supera il 50%
    const checkThresholdState = new sfn.Choice(this, 'CheckThreshold', {
      comment: 'Verifica se le domande generate con successo raggiungono la soglia del 50%', // Descrizione della scelta
    });

    // Stato AssembleBank: assembla le domande generate in un question bank completo
    const assembleBankState = new tasks.LambdaInvoke(this, 'AssembleBank', {
      lambdaFunction: assembleBankFn, // Funzione Lambda da invocare
      outputPath: '$.Payload', // Estrazione del payload dalla risposta Lambda
      comment: 'Assembla il question bank finale e lo salva su DynamoDB', // Descrizione dello stato
    });

    // Stato PublishEvent: pubblica l'evento di completamento su EventBridge
    const publishEventState = new tasks.LambdaInvoke(this, 'PublishEvent', {
      lambdaFunction: assembleBankFn, // Riutilizza assembleBank per pubblicare l'evento
      outputPath: '$.Payload', // Estrazione del payload dalla risposta Lambda
      comment: 'Pubblica l\'evento generation.completed su EventBridge', // Descrizione dello stato
    });

    // Stato di fallimento: workflow fallito per soglia non raggiunta
    const failWorkflowState = new sfn.Fail(this, 'FailWorkflow', {
      cause: 'Soglia minima del 50% di domande generate non raggiunta', // Causa del fallimento
      error: 'ThresholdNotMet', // Codice errore personalizzato
      comment: 'Termina il workflow come fallito quando la soglia non è raggiunta', // Descrizione dello stato
    });

    // Definizione delle transizioni del Choice state CheckThreshold
    checkThresholdState
      .when(
        sfn.Condition.numberGreaterThanEqualsJsonPath('$.successCount', '$.threshold'), // Condizione: successi >= soglia
        assembleBankState.next(publishEventState), // Transizione verso assemblaggio e pubblicazione
      )
      .otherwise(failWorkflowState); // Altrimenti fallisce il workflow

    // Composizione della catena principale della macchina a stati
    const definition = buildPlanState // Inizio: costruzione del piano
      .next(iterateQuestionsState) // Poi: iterazione sulle domande
      .next(checkThresholdState); // Infine: verifica della soglia

    // Creazione della macchina a stati Step Functions
    new sfn.StateMachine(this, 'GenerationStateMachine', {
      stateMachineName: `${env}-aws-exam-generator-generation`, // Nome della macchina a stati con prefisso ambiente
      definitionBody: sfn.DefinitionBody.fromChainable(definition), // Definizione dal flusso concatenato
      timeout: cdk.Duration.minutes(60), // Timeout massimo di esecuzione: 60 minuti
      comment: 'Macchina a stati per l\'orchestrazione della generazione di domande d\'esame AWS', // Descrizione
    });
  }
}
