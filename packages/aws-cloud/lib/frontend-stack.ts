/**
 * FrontendStack - Stack annidato per l'hosting del frontend statico.
 *
 * Definisce il bucket S3 per gli asset statici con accesso pubblico bloccato,
 * la distribuzione CloudFront con Origin Access Identity (OAI),
 * redirect HTTPS, TTL 24h per asset statici e TTL 0 per index.html,
 * risposte di errore personalizzate per il routing SPA,
 * e invalidazione della cache al momento del deployment.
 */
import * as cdk from 'aws-cdk-lib'; // Importazione del modulo CDK principale
import { aws_s3 as s3 } from 'aws-cdk-lib'; // Servizio S3 per lo storage di oggetti
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib'; // Servizio CloudFront per la CDN
import { aws_cloudfront_origins as origins } from 'aws-cdk-lib'; // Origini CloudFront per S3
import { aws_s3_deployment as s3deploy } from 'aws-cdk-lib'; // Modulo per il deployment degli asset su S3
import { Duration, RemovalPolicy } from 'aws-cdk-lib'; // Utilità per durate e policy di rimozione
import { Construct } from 'constructs'; // Classe base per i costrutti CDK

// Interfaccia per le proprietà accettate dal FrontendStack
export interface FrontendStackProps extends cdk.NestedStackProps {
  // Ambiente di deployment (dev, staging, prod)
  readonly environment: string;
}

// Stack annidato che gestisce le risorse di hosting frontend (S3 + CloudFront)
export class FrontendStack extends cdk.NestedStack {
  // Riferimento al bucket S3 per gli asset statici
  public readonly bucket: s3.Bucket;

  // Riferimento alla distribuzione CloudFront
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props); // Inizializzazione dello stack annidato

    // Recupero dell'ambiente per costruire i nomi delle risorse
    const env = props.environment;

    // Determinazione della policy di rimozione in base all'ambiente
    const removalPolicy = env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Creazione del bucket S3 per gli asset statici del frontend
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${env}-aws-exam-generator-frontend`, // Nome del bucket con prefisso ambiente
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Blocco di ogni accesso pubblico al bucket
      removalPolicy, // Policy di rimozione condizionale: DESTROY per dev, RETAIN per prod
      autoDeleteObjects: env !== 'prod', // Eliminazione automatica degli oggetti solo in ambienti non-prod
    });

    // Creazione dell'Origin Access Identity per limitare l'accesso diretto al bucket S3
    const oai = new cloudfront.OriginAccessIdentity(this, 'FrontendOAI', {
      comment: `OAI per il bucket frontend ${env}`, // Descrizione dell'OAI associata all'ambiente
    });

    // Concessione dei permessi di lettura all'OAI sul bucket S3
    this.bucket.grantRead(oai);

    // Creazione della distribuzione CloudFront con configurazione per SPA
    this.distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      comment: `Distribuzione CDN frontend ${env}`, // Descrizione della distribuzione
      defaultRootObject: 'index.html', // Oggetto radice predefinito per le richieste alla root
      defaultBehavior: {
        // Origine S3 con accesso tramite OAI
        origin: new origins.S3Origin(this.bucket, {
          originAccessIdentity: oai, // Associazione dell'OAI per l'accesso sicuro
        }),
        // Redirect automatico da HTTP a HTTPS per garantire connessioni sicure
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // Policy di caching predefinita con TTL di 24 ore per asset statici
        cachePolicy: new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
          cachePolicyName: `${env}-static-assets-cache-policy`, // Nome della policy di cache
          defaultTtl: Duration.hours(24), // TTL predefinito di 24 ore per gli asset statici
          minTtl: Duration.seconds(0), // TTL minimo di 0 secondi
          maxTtl: Duration.days(365), // TTL massimo di 365 giorni
        }),
      },
      // Comportamento aggiuntivo per index.html con TTL 0 (nessuna cache)
      additionalBehaviors: {
        '/index.html': {
          origin: new origins.S3Origin(this.bucket, {
            originAccessIdentity: oai, // Stessa OAI per l'accesso sicuro
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // HTTPS obbligatorio
          cachePolicy: new cloudfront.CachePolicy(this, 'IndexHtmlNoCachePolicy', {
            cachePolicyName: `${env}-index-html-no-cache-policy`, // Nome della policy senza cache
            defaultTtl: Duration.seconds(0), // TTL 0 per servire sempre la versione più recente
            minTtl: Duration.seconds(0), // TTL minimo di 0 secondi
            maxTtl: Duration.seconds(0), // TTL massimo di 0 secondi per disabilitare completamente la cache
          }),
        },
      },
      // Risposte di errore personalizzate per il routing SPA (Single Page Application)
      errorResponses: [
        {
          httpStatus: 403, // Errore di accesso negato da S3
          responseHttpStatus: 200, // Risposta con status 200 per il client
          responsePagePath: '/index.html', // Reindirizzamento a index.html per il routing client-side
          ttl: Duration.seconds(0), // Nessuna cache per le risposte di errore
        },
        {
          httpStatus: 404, // Errore di risorsa non trovata
          responseHttpStatus: 200, // Risposta con status 200 per il client
          responsePagePath: '/index.html', // Reindirizzamento a index.html per il routing client-side
          ttl: Duration.seconds(0), // Nessuna cache per le risposte di errore
        },
      ],
    });

    // Deployment degli asset frontend dal file system locale al bucket S3
    new s3deploy.BucketDeployment(this, 'FrontendDeployment', {
      sources: [s3deploy.Source.asset('../frontend-dist')], // Directory sorgente degli asset compilati
      destinationBucket: this.bucket, // Bucket di destinazione per gli asset
      distribution: this.distribution, // Distribuzione CloudFront per l'invalidazione della cache
      distributionPaths: ['/*'], // Invalidazione di tutti i percorsi nella cache CDN al deployment
    });
  }
}
