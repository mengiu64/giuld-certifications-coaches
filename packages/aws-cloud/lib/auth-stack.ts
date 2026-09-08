/**
 * AuthStack - Stack annidato per l'autenticazione e autorizzazione tramite Cognito.
 *
 * Definisce il Cognito User Pool con verifica email, policy di password,
 * e il client dell'applicazione per l'accesso frontend (SPA).
 *
 * Esporta il User Pool e il Client per consentire ad ApiStack di configurare l'authorizer.
 */
import * as cdk from 'aws-cdk-lib'; // Importazione del modulo CDK principale
import { aws_cognito as cognito } from 'aws-cdk-lib'; // Servizio Cognito per autenticazione utenti
import { Duration } from 'aws-cdk-lib'; // Utilità per definire durate temporali
import { Construct } from 'constructs'; // Classe base per i costrutti CDK

// Interfaccia per le proprietà accettate dall'AuthStack
export interface AuthStackProps extends cdk.NestedStackProps {
  // Ambiente di deployment (dev, staging, prod)
  readonly environment: string;
}

// Stack annidato che gestisce le risorse di autenticazione (Cognito)
export class AuthStack extends cdk.NestedStack {
  // Riferimento al User Pool, esposto per l'authorizer di ApiStack
  public readonly userPool: cognito.UserPool;

  // Riferimento al Client dell'applicazione, esposto per la configurazione frontend
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props); // Inizializzazione dello stack annidato

    // Recupero dell'ambiente per costruire i nomi delle risorse
    const env = props.environment;

    // Creazione del Cognito User Pool con verifica email e policy di password
    this.userPool = new cognito.UserPool(this, 'ExamGeneratorUserPool', {
      userPoolName: `${env}-aws-exam-generator-users`, // Nome del pool con prefisso ambiente
      selfSignUpEnabled: true, // Abilitazione della registrazione autonoma degli utenti
      signInAliases: {
        email: true, // Utilizzo dell'email come alias di accesso
      },
      autoVerify: {
        email: true, // Verifica automatica dell'email alla registrazione
      },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE, // Invio di un codice di verifica via email
        emailSubject: 'AWS Exam Generator - Codice di verifica', // Oggetto dell'email di verifica
        emailBody: 'Il tuo codice di verifica è: {####}', // Corpo dell'email con il placeholder del codice
      },
      passwordPolicy: {
        minLength: 8, // Lunghezza minima della password: 8 caratteri
        requireUppercase: true, // Almeno una lettera maiuscola obbligatoria
        requireLowercase: true, // Almeno una lettera minuscola obbligatoria
        requireDigits: true, // Almeno un numero obbligatorio
        requireSymbols: false, // Simboli speciali non obbligatori
        tempPasswordValidity: Duration.hours(24), // Validità del codice di verifica: 24 ore
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY, // Recupero account esclusivamente via email
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Conservazione del pool in caso di eliminazione dello stack
    });

    // Creazione del client dell'applicazione (SPA, senza segreto)
    this.userPoolClient = this.userPool.addClient('ExamGeneratorAppClient', {
      generateSecret: false, // Nessun segreto client per applicazioni SPA
      authFlows: {
        userPassword: true, // Abilitazione del flusso USER_PASSWORD_AUTH
        userSrp: true, // Abilitazione del flusso USER_SRP_AUTH
      },
      accessTokenValidity: Duration.hours(1), // Validità del token di accesso: 1 ora
      refreshTokenValidity: Duration.days(30), // Validità del token di aggiornamento: 30 giorni
    });
  }
}
