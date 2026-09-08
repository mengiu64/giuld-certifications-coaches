#!/usr/bin/env node
// Punto di ingresso dell'applicazione CDK per aws-exam-generator
import * as cdk from 'aws-cdk-lib'; // Importazione del modulo principale CDK
import { RootStack } from './root-stack.js'; // Importazione dello stack radice

// Creazione dell'istanza dell'applicazione CDK
const app = new cdk.App();

// Lettura del parametro di contesto "environment" (default: "dev")
const environment = app.node.tryGetContext('environment') as string ?? 'dev';

// Lettura del parametro di contesto "costCenter" (default: "engineering")
const costCenter = app.node.tryGetContext('costCenter') as string ?? 'engineering';

// Istanziazione dello stack radice con i parametri di ambiente e centro di costo
new RootStack(app, `${environment}-aws-exam-generator`, {
  environment, // Ambiente di deployment (dev, staging, prod)
  costCenter, // Centro di costo per il tagging delle risorse
});
