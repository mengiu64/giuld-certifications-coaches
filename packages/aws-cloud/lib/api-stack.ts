/**
 * ApiStack - Stack annidato per il livello API dell'applicazione.
 *
 * Definisce l'API Gateway REST con autorizzatore Cognito, 8 funzioni Lambda
 * con policy IAM a grana fine (nessun ARN wildcard), validazione delle richieste,
 * rate limiting a 100 rps, e CORS per l'origine CloudFront.
 *
 * Endpoint pubblico (senza autenticazione): GET /certifications.
 * Tutti gli altri endpoint richiedono un token JWT valido.
 */
import * as cdk from 'aws-cdk-lib'; // Importazione del modulo principale CDK
import { aws_apigateway as apigw } from 'aws-cdk-lib'; // Servizio API Gateway per l'esposizione REST
import { aws_lambda as lambda } from 'aws-cdk-lib'; // Servizio Lambda per i gestori serverless
import { aws_iam as iam } from 'aws-cdk-lib'; // Servizio IAM per le policy di accesso
import { aws_cognito as cognito } from 'aws-cdk-lib'; // Servizio Cognito per l'autenticazione
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib'; // Servizio DynamoDB per il riferimento alla tabella (tipo concreto Table)
import { Duration } from 'aws-cdk-lib'; // Utilità per definire durate temporali
import { Construct } from 'constructs'; // Classe base per i costrutti CDK
import * as path from 'path'; // Modulo per la risoluzione dei percorsi

// Interfaccia per le proprietà accettate dall'ApiStack
export interface ApiStackProps extends cdk.NestedStackProps {
  // Ambiente di deployment (dev, staging, prod)
  readonly environment: string;
  // Riferimento alla tabella DynamoDB proveniente dal DataStack
  readonly table: dynamodb.Table;
  // Riferimento al Cognito User Pool proveniente dall'AuthStack
  readonly userPool: cognito.UserPool;
}

// Stack annidato che gestisce le risorse API (API Gateway e Lambda)
export class ApiStack extends cdk.NestedStack {
  // Riferimento all'API REST, esposto per la configurazione del frontend
  public readonly restApi: apigw.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props); // Invocazione del costruttore della classe base

    // Destrutturazione delle proprietà per l'utilizzo locale
    const { environment, table, userPool } = props;

    // Percorso alla directory dei sorgenti Lambda
    const handlersPath = path.join(__dirname, '..', 'src'); // Percorso relativo alla cartella src

    // Nome del bus EventBridge per la pubblicazione degli eventi di dominio
    const eventBusName = 'aws-exam-generator'; // Nome del bus personalizzato

    // ─────────────────────────────────────────────────────────────────────────
    // API Gateway REST API
    // ─────────────────────────────────────────────────────────────────────────

    // Creazione dell'API Gateway REST con configurazione CORS e deploy automatico
    this.restApi = new apigw.RestApi(this, 'ExamGeneratorApi', {
      restApiName: `${environment}-aws-exam-generator-api`, // Nome dell'API con prefisso ambiente
      description: 'API REST per il generatore di esami AWS', // Descrizione dell'API
      deployOptions: {
        stageName: environment, // Nome dello stage (dev, staging, prod)
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS, // Permetti tutte le origini (CloudFront)
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'], // Metodi HTTP consentiti
        allowHeaders: ['Content-Type', 'Authorization'], // Header consentiti nelle richieste
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Autorizzatore Cognito
    // ─────────────────────────────────────────────────────────────────────────

    // Creazione dell'autorizzatore Cognito per la validazione dei token JWT
    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool], // Elenco dei User Pool per la validazione
      authorizerName: `${environment}-cognito-authorizer`, // Nome dell'autorizzatore
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Rate Limiting (Usage Plan)
    // ─────────────────────────────────────────────────────────────────────────

    // Creazione del piano di utilizzo con limite di frequenza a 100 richieste/secondo
    const usagePlan = this.restApi.addUsagePlan('UsagePlan', {
      name: `${environment}-usage-plan`, // Nome del piano di utilizzo
      throttle: {
        rateLimit: 100, // Limite di richieste al secondo (100 rps)
        burstLimit: 100, // Limite di burst per gestire picchi momentanei
      },
    });

    // Associazione del piano di utilizzo allo stage dell'API
    usagePlan.addApiStage({
      stage: this.restApi.deploymentStage, // Stage corrente dell'API
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Validatore delle richieste (body) per gli endpoint POST
    // ─────────────────────────────────────────────────────────────────────────

    // Creazione del validatore per il corpo delle richieste POST
    const bodyValidator = new apigw.RequestValidator(this, 'BodyValidator', {
      restApi: this.restApi as apigw.IRestApi, // API a cui associare il validatore (cast per compatibilità)
      requestValidatorName: `${environment}-body-validator`, // Nome del validatore
      validateRequestBody: true, // Abilita validazione del corpo della richiesta
      validateRequestParameters: false, // Non validare i parametri della query
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Modelli di validazione per le richieste POST
    // ─────────────────────────────────────────────────────────────────────────

    // Modello JSON Schema per POST /exams/generate
    const generateExamModel = new apigw.Model(this, 'GenerateExamModel', {
      restApi: this.restApi as apigw.IRestApi, // API a cui associare il modello (cast per compatibilità)
      contentType: 'application/json', // Tipo di contenuto del modello
      modelName: 'GenerateExamRequest', // Nome del modello
      schema: {
        type: apigw.JsonSchemaType.OBJECT, // Tipo radice: oggetto
        required: ['certificationId'], // Campo obbligatorio
        properties: {
          certificationId: {
            type: apigw.JsonSchemaType.STRING, // Il campo certificationId è una stringa
            minLength: 1, // Lunghezza minima di 1 carattere
          },
        },
      },
    });

    // Modello JSON Schema per POST /questions
    const saveQuestionModel = new apigw.Model(this, 'SaveQuestionModel', {
      restApi: this.restApi as apigw.IRestApi, // API a cui associare il modello (cast per compatibilità)
      contentType: 'application/json', // Tipo di contenuto del modello
      modelName: 'SaveQuestionRequest', // Nome del modello
      schema: {
        type: apigw.JsonSchemaType.OBJECT, // Tipo radice: oggetto
        required: ['certificationId', 'question'], // Campi obbligatori
        properties: {
          certificationId: {
            type: apigw.JsonSchemaType.STRING, // ID della certificazione
            minLength: 1, // Lunghezza minima di 1 carattere
          },
          question: {
            type: apigw.JsonSchemaType.OBJECT, // Oggetto domanda
          },
        },
      },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Variabili d'ambiente comuni per tutte le funzioni Lambda
    // ─────────────────────────────────────────────────────────────────────────

    // Variabili d'ambiente condivise da tutti i gestori Lambda
    const commonEnvVars: Record<string, string> = {
      TABLE_NAME: table.tableName, // Nome della tabella DynamoDB
      EVENT_BUS_NAME: eventBusName, // Nome del bus EventBridge
      SSM_ENV: environment, // Ambiente per i percorsi SSM
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Funzioni Lambda - Definizioni
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Lambda per GET /certifications (endpoint pubblico, senza autenticazione)
    const getCertificationsLambda = new lambda.Function(this, 'GetCertificationsHandler', {
      functionName: `${environment}-getCertifications`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/get-certifications.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // 2. Lambda per POST /exams/generate (avvia la generazione)
    const startGenerationLambda = new lambda.Function(this, 'StartGenerationHandler', {
      functionName: `${environment}-startGeneration`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/start-generation.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // 3. Lambda per GET /exams/generate/status (stato della generazione)
    const getGenerationStatusLambda = new lambda.Function(this, 'GetGenerationStatusHandler', {
      functionName: `${environment}-getGenerationStatus`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/get-generation-status.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // 4. Lambda per GET /banks (elenco banche domande)
    const listBanksLambda = new lambda.Function(this, 'ListBanksHandler', {
      functionName: `${environment}-listBanks`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/list-banks.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // 5. Lambda per GET /banks/{bankId} (dettaglio singola banca)
    const getBankLambda = new lambda.Function(this, 'GetBankHandler', {
      functionName: `${environment}-getBank`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/get-bank.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // 6. Lambda per POST /questions (salvataggio domanda)
    const saveQuestionLambda = new lambda.Function(this, 'SaveQuestionHandler', {
      functionName: `${environment}-saveQuestion`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/save-question.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // 7. Lambda per GET /questions (recupero domande recenti)
    const getQuestionsLambda = new lambda.Function(this, 'GetQuestionsHandler', {
      functionName: `${environment}-getQuestions`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/get-questions.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // 8. Lambda per la gestione delle sessioni (POST/GET/PUT /sessions)
    const sessionManagementLambda = new lambda.Function(this, 'SessionManagementHandler', {
      functionName: `${environment}-sessionManagement`, // Nome della funzione con prefisso ambiente
      runtime: lambda.Runtime.NODEJS_20_X, // Runtime Node.js 20
      handler: 'handlers/session-management.handler', // Punto di ingresso del gestore
      code: lambda.Code.fromAsset(handlersPath), // Codice sorgente dalla directory src
      environment: commonEnvVars, // Variabili d'ambiente
      timeout: Duration.seconds(30), // Timeout di 30 secondi
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Policy IAM a grana fine per ogni funzione Lambda
    // ─────────────────────────────────────────────────────────────────────────

    // Permessi DynamoDB in sola lettura per getCertifications (potrebbe consultare la tabella)
    getCertificationsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:Query'], // Operazioni di lettura sulla tabella
      resources: [table.tableArn], // ARN specifico della tabella
    }));

    // Permessi per startGeneration: lettura/scrittura DynamoDB + avvio Step Functions + lettura SSM
    startGenerationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query'], // Lettura e scrittura sulla tabella
      resources: [table.tableArn, `${table.tableArn}/index/*`], // Tabella e indici GSI
    }));
    startGenerationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:StartExecution', 'states:ListExecutions'], // Avvio e verifica esecuzioni Step Functions
      resources: [`arn:aws:states:${this.region}:${this.account}:stateMachine:${environment}-*`], // State machine con prefisso ambiente
    }));
    startGenerationLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'], // Lettura parametri SSM
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/aws-exam-generator/${environment}/*`], // Parametri con prefisso ambiente
    }));

    // Permessi per getGenerationStatus: sola lettura DynamoDB
    getGenerationStatusLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:Query'], // Operazioni di lettura
      resources: [table.tableArn], // ARN specifico della tabella
    }));

    // Permessi per listBanks: sola lettura DynamoDB (tabella e GSI)
    listBanksLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query'], // Query sulla tabella e GSI
      resources: [table.tableArn, `${table.tableArn}/index/*`], // Tabella e indici GSI
    }));

    // Permessi per getBank: sola lettura DynamoDB (tabella e GSI)
    getBankLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:Query'], // Lettura e query per riassemblare chunk
      resources: [table.tableArn, `${table.tableArn}/index/*`], // Tabella e indici GSI
    }));

    // Permessi per saveQuestion: lettura/scrittura DynamoDB
    saveQuestionLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'], // Operazioni di scrittura
      resources: [table.tableArn], // ARN specifico della tabella
    }));

    // Permessi per getQuestions: sola lettura DynamoDB
    getQuestionsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:Query'], // Query per recuperare le domande
      resources: [table.tableArn, `${table.tableArn}/index/*`], // Tabella e indici GSI
    }));

    // Permessi per sessionManagement: lettura/scrittura DynamoDB + pubblicazione eventi
    sessionManagementLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'], // CRUD completo
      resources: [table.tableArn, `${table.tableArn}/index/*`], // Tabella e indici GSI
    }));
    sessionManagementLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'], // Pubblicazione eventi su EventBridge
      resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/${eventBusName}`], // Bus specifico
    }));

    // Permessi SSM per le funzioni che necessitano di configurazione
    const ssmReadPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'], // Lettura parametri SSM
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/aws-exam-generator/${environment}/*`], // Parametri con prefisso ambiente
    });

    // Aggiunta della policy SSM alle funzioni che necessitano di configurazione runtime
    getCertificationsLambda.addToRolePolicy(ssmReadPolicy); // Lettura configurazione
    getGenerationStatusLambda.addToRolePolicy(ssmReadPolicy); // Lettura configurazione
    listBanksLambda.addToRolePolicy(ssmReadPolicy); // Lettura configurazione
    getBankLambda.addToRolePolicy(ssmReadPolicy); // Lettura configurazione
    saveQuestionLambda.addToRolePolicy(ssmReadPolicy); // Lettura configurazione
    getQuestionsLambda.addToRolePolicy(ssmReadPolicy); // Lettura configurazione
    sessionManagementLambda.addToRolePolicy(ssmReadPolicy); // Lettura configurazione

    // ─────────────────────────────────────────────────────────────────────────
    // Risorse API Gateway - Definizione degli endpoint
    // ─────────────────────────────────────────────────────────────────────────

    // Opzioni di autorizzazione per gli endpoint protetti
    const authorizedMethodOptions: apigw.MethodOptions = {
      authorizer: cognitoAuthorizer, // Autorizzatore Cognito per la validazione JWT
      authorizationType: apigw.AuthorizationType.COGNITO, // Tipo di autorizzazione Cognito
    };

    // --- GET /certifications (endpoint pubblico, senza autenticazione) ---
    const certifications = this.restApi.root.addResource('certifications'); // Risorsa /certifications
    certifications.addMethod('GET', new apigw.LambdaIntegration(getCertificationsLambda), {
      authorizationType: apigw.AuthorizationType.NONE, // Nessuna autorizzazione richiesta
    });

    // --- POST /exams/generate (con validazione del body) ---
    const exams = this.restApi.root.addResource('exams'); // Risorsa /exams
    const generate = exams.addResource('generate'); // Risorsa /exams/generate
    generate.addMethod('POST', new apigw.LambdaIntegration(startGenerationLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
      requestValidator: bodyValidator, // Validazione del corpo della richiesta
      requestModels: {
        'application/json': generateExamModel, // Modello di validazione per il corpo
      },
    });

    // --- GET /exams/generate/status ---
    const generateStatus = generate.addResource('status'); // Risorsa /exams/generate/status
    generateStatus.addMethod('GET', new apigw.LambdaIntegration(getGenerationStatusLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
    });

    // --- GET /banks ---
    const banks = this.restApi.root.addResource('banks'); // Risorsa /banks
    banks.addMethod('GET', new apigw.LambdaIntegration(listBanksLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
    });

    // --- GET /banks/{bankId} ---
    const bankById = banks.addResource('{bankId}'); // Risorsa /banks/{bankId} con parametro path
    bankById.addMethod('GET', new apigw.LambdaIntegration(getBankLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
    });

    // --- POST /questions (con validazione del body) ---
    const questions = this.restApi.root.addResource('questions'); // Risorsa /questions
    questions.addMethod('POST', new apigw.LambdaIntegration(saveQuestionLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
      requestValidator: bodyValidator, // Validazione del corpo della richiesta
      requestModels: {
        'application/json': saveQuestionModel, // Modello di validazione per il corpo
      },
    });

    // --- GET /questions ---
    questions.addMethod('GET', new apigw.LambdaIntegration(getQuestionsLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
    });

    // --- Gestione sessioni: POST /sessions, GET /sessions/{sessionId}, PUT /sessions/{sessionId} ---
    const sessions = this.restApi.root.addResource('sessions'); // Risorsa /sessions
    sessions.addMethod('POST', new apigw.LambdaIntegration(sessionManagementLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
    });

    // Risorsa /sessions/{sessionId} per GET e PUT
    const sessionById = sessions.addResource('{sessionId}'); // Risorsa con parametro path sessionId
    sessionById.addMethod('GET', new apigw.LambdaIntegration(sessionManagementLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
    });
    sessionById.addMethod('PUT', new apigw.LambdaIntegration(sessionManagementLambda), {
      ...authorizedMethodOptions, // Autorizzazione Cognito obbligatoria
    });
  }
}
