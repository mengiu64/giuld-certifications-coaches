// Stack radice che orchestra tutti gli stack annidati dell'applicazione
import * as cdk from 'aws-cdk-lib'; // Importazione del modulo principale CDK
import { Construct } from 'constructs'; // Importazione del tipo base per i costrutti
import { AuthStack } from './auth-stack.js'; // Importazione dello stack di autenticazione
import { DataStack } from './data-stack.js'; // Importazione dello stack dati
import { ApiStack } from './api-stack.js'; // Importazione dello stack API
import { FrontendStack } from './frontend-stack.js'; // Importazione dello stack frontend
import { OrchestrationStack } from './orchestration-stack.js'; // Importazione dello stack di orchestrazione

/**
 * Proprietà personalizzate per lo stack radice.
 * Estende le proprietà standard di CDK con parametri specifici dell'applicazione.
 */
export interface RootStackProps extends cdk.StackProps {
  /** Ambiente di deployment: dev, staging o prod */
  readonly environment: string;
  /** Centro di costo per il tagging delle risorse AWS */
  readonly costCenter: string;
}

/**
 * Stack radice dell'applicazione aws-exam-generator.
 * Istanzia cinque stack annidati (Auth, Data, Api, Frontend, Orchestration)
 * e applica tag globali a tutte le risorse.
 */
export class RootStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RootStackProps) {
    super(scope, id, props); // Invocazione del costruttore della classe base

    // Destrutturazione delle proprietà personalizzate
    const { environment, costCenter } = props;

    // Istanziazione dello stack di autenticazione (Cognito User Pool)
    const authStack = new AuthStack(this, `${environment}-AuthStack`, {
      description: 'Stack di autenticazione con Cognito User Pool', // Descrizione dello stack annidato
      environment, // Ambiente di deployment per il nome del User Pool
    });

    // Istanziazione dello stack dati (DynamoDB, SSM Parameter Store)
    const dataStack = new DataStack(this, `${environment}-DataStack`, {
      description: 'Stack dati con DynamoDB e SSM Parameter Store', // Descrizione dello stack annidato
      environment, // Ambiente di deployment per i percorsi SSM e il nome della tabella
    });

    // Istanziazione dello stack API (API Gateway, Lambda handlers)
    new ApiStack(this, `${environment}-ApiStack`, {
      description: 'Stack API con API Gateway e funzioni Lambda', // Descrizione dello stack annidato
      environment, // Ambiente di deployment per i nomi delle risorse API
      table: dataStack.table, // Riferimento alla tabella DynamoDB dal DataStack
      userPool: authStack.userPool, // Riferimento al User Pool dall'AuthStack
    });

    // Istanziazione dello stack frontend (S3, CloudFront)
    new FrontendStack(this, `${environment}-FrontendStack`, {
      description: 'Stack frontend con S3 e CloudFront', // Descrizione dello stack annidato
      environment, // Ambiente di deployment per i nomi delle risorse frontend
    });

    // Istanziazione dello stack di orchestrazione (Step Functions)
    new OrchestrationStack(this, `${environment}-OrchestrationStack`, {
      description: 'Stack di orchestrazione con Step Functions', // Descrizione dello stack annidato
      environment, // Ambiente di deployment per il prefisso delle risorse
      table: dataStack.table, // Riferimento alla tabella DynamoDB dal DataStack
    });

    // Applicazione del tag "Environment" a tutte le risorse dello stack
    cdk.Tags.of(this).add('Environment', environment);

    // Applicazione del tag "Project" a tutte le risorse dello stack
    cdk.Tags.of(this).add('Project', 'aws-exam-generator');

    // Applicazione del tag "CostCenter" a tutte le risorse dello stack
    cdk.Tags.of(this).add('CostCenter', costCenter);
  }
}
