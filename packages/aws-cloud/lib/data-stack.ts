/**
 * DataStack - Stack annidato per il layer dati dell'applicazione.
 *
 * Definisce la tabella DynamoDB single-table con GSI per le query per bankId,
 * e i parametri SSM per la configurazione runtime dei Lambda.
 *
 * Esporta la tabella DynamoDB per consentire l'accesso da ApiStack e OrchestrationStack.
 */
import * as cdk from 'aws-cdk-lib'; // Importazione del modulo CDK principale
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib'; // Servizio DynamoDB per la persistenza
import { aws_ssm as ssm } from 'aws-cdk-lib'; // Servizio SSM Parameter Store per la configurazione
import { Construct } from 'constructs'; // Classe base per i costrutti CDK

// Interfaccia per le proprietà accettate dal DataStack
export interface DataStackProps extends cdk.NestedStackProps {
  // Ambiente di deployment (dev, staging, prod)
  readonly environment: string;
}

// Stack annidato che gestisce le risorse dati (DynamoDB e SSM)
export class DataStack extends cdk.NestedStack {
  // Riferimento alla tabella DynamoDB, esposto per gli altri stack
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props); // Inizializzazione dello stack annidato

    // Recupero dell'ambiente per costruire nomi e percorsi
    const env = props.environment;

    // Creazione della tabella DynamoDB single-table
    this.table = new dynamodb.Table(this, 'ExamGeneratorTable', {
      tableName: `${env}-aws-exam-generator`, // Nome tabella con prefisso ambiente
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING }, // Chiave di partizione di tipo stringa
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // Chiave di ordinamento di tipo stringa
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Modalità on-demand per scalabilità automatica
      pointInTimeRecovery: true, // Abilitazione del ripristino point-in-time per la protezione dei dati
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Conservazione della tabella in caso di eliminazione dello stack
    });

    // Aggiunta del GSI per le query per bankId
    this.table.addGlobalSecondaryIndex({
      indexName: 'gsi-bankId', // Nome dell'indice secondario globale
      partitionKey: { name: 'bankId', type: dynamodb.AttributeType.STRING }, // Chiave di partizione del GSI
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }, // Chiave di ordinamento del GSI (riutilizza sk)
      projectionType: dynamodb.ProjectionType.ALL, // Proiezione completa di tutti gli attributi
    });

    // Creazione dei parametri SSM per la configurazione runtime
    // Parametro per l'ID del modello Bedrock
    new ssm.StringParameter(this, 'BedrockModelIdParam', {
      parameterName: `/aws-exam-generator/${env}/bedrock-model-id`, // Percorso del parametro con ambiente
      stringValue: 'anthropic.claude-3-sonnet-20240229-v1:0', // Valore predefinito del modello
      description: 'ID del modello Bedrock per la generazione delle domande', // Descrizione in italiano
    });

    // Parametro per il timeout delle invocazioni Bedrock in millisecondi
    new ssm.StringParameter(this, 'BedrockTimeoutParam', {
      parameterName: `/aws-exam-generator/${env}/bedrock-timeout-ms`, // Percorso del parametro con ambiente
      stringValue: '30000', // Timeout di 30 secondi
      description: 'Timeout in millisecondi per le invocazioni Bedrock', // Descrizione in italiano
    });

    // Parametro per il ritardo tra le richieste successive in millisecondi
    new ssm.StringParameter(this, 'InterRequestDelayParam', {
      parameterName: `/aws-exam-generator/${env}/inter-request-delay-ms`, // Percorso del parametro con ambiente
      stringValue: '2000', // Ritardo di 2 secondi tra le richieste
      description: 'Ritardo in millisecondi tra le richieste successive a Bedrock', // Descrizione in italiano
    });

    // Parametro per il limite di frequenza dell'API in richieste al secondo
    new ssm.StringParameter(this, 'ApiRateLimitParam', {
      parameterName: `/aws-exam-generator/${env}/api-rate-limit-rps`, // Percorso del parametro con ambiente
      stringValue: '100', // Limite di 100 richieste al secondo
      description: 'Limite di frequenza dell\'API Gateway in richieste al secondo', // Descrizione in italiano
    });
  }
}
