/**
 * Lambda di orchestrazione per la costruzione del piano di generazione domande.
 *
 * Questa Lambda è il primo step della Step Functions state machine.
 * Riceve in input certificationId e bankId, carica la configurazione della certificazione
 * dal registry condiviso, e produce un piano di generazione che distribuisce le domande
 * tra i domini e i formati secondo le percentuali configurate.
 *
 * Metodo di distribuzione: largest-remainder (Hamilton) per garantire che il totale
 * delle domande assegnate corrisponda esattamente a totalQuestions.
 *
 * Input: { certificationId: string, bankId: string }
 * Output: { certificationId: string, bankId: string, plan: GenerationPlanItem[], totalQuestions: number }
 */

import { certificationRegistry } from '@aws-exam-generator/shared';
import type { CertificationConfig, GenerationPlanItem, QuestionFormat } from '@aws-exam-generator/shared';
import { createLogger } from '../utils/logger.js';

// Crea il logger strutturato per questa funzione Lambda
const logger = createLogger('build-plan');

/**
 * Interfaccia per l'evento in ingresso dalla Step Functions state machine.
 * Contiene l'identificativo della certificazione e della banca domande da generare.
 */
interface BuildPlanEvent {
  // Identificativo univoco della certificazione (es. "SAP-C02")
  certificationId: string;
  // Identificativo univoco della banca domande da generare
  bankId: string;
}

/**
 * Interfaccia per la risposta restituita dalla Lambda.
 * Diventa l'input dello stato successivo nella state machine.
 */
interface BuildPlanOutput {
  // Identificativo della certificazione elaborata
  certificationId: string;
  // Identificativo della banca domande
  bankId: string;
  // Piano di generazione con un elemento per ogni domanda da generare
  plan: GenerationPlanItem[];
  // Numero totale di domande nel piano
  totalQuestions: number;
}

/**
 * Elemento intermedio utilizzato durante la distribuzione per dominio.
 * Mantiene il conteggio assegnato e il resto per l'allocazione largest-remainder.
 */
interface DomainAllocation {
  // Identificativo del dominio
  domainId: string;
  // Numero di domande assegnate (floor della quota ideale)
  count: number;
  // Resto frazionario per l'allocazione dei posti residui
  remainder: number;
}

/**
 * Elemento intermedio utilizzato durante la distribuzione per formato.
 * Mantiene il conteggio assegnato e il resto per l'allocazione largest-remainder.
 */
interface FormatAllocation {
  // Tipo di formato domanda
  format: QuestionFormat;
  // Numero di domande assegnate a questo formato
  count: number;
  // Resto frazionario per l'allocazione dei posti residui
  remainder: number;
}

/**
 * Applica l'algoritmo largest-remainder (Hamilton) per distribuire un totale
 * intero tra N categorie con percentuali date.
 *
 * L'algoritmo:
 * 1. Calcola la quota ideale per ogni categoria: total * (percentage / 100)
 * 2. Assegna a ciascuna il floor della quota ideale
 * 3. Ordina le categorie per resto decrescente
 * 4. Distribuisce i posti rimanenti uno per uno alle categorie con resto maggiore
 *
 * @param items - Array di coppie [chiave, percentuale]
 * @param total - Numero totale da distribuire
 * @returns Mappa da chiave a conteggio assegnato
 */
function largestRemainderAllocation<T extends string>(
  items: Array<{ key: T; percentage: number }>,
  total: number
): Map<T, number> {
  // Calcola la quota ideale e il floor per ogni categoria
  const allocations = items.map((item) => {
    // Calcola il conteggio ideale frazionario
    const idealCount = total * (item.percentage / 100);
    // Assegna il floor come base
    const floorCount = Math.floor(idealCount);
    // Calcola il resto per la distribuzione residua
    const remainder = idealCount - floorCount;
    // Restituisce l'allocazione parziale
    return { key: item.key, count: floorCount, remainder };
  });

  // Calcola il numero di posti ancora da assegnare
  const sumFloors = allocations.reduce((sum, a) => sum + a.count, 0);
  // Determina quanti posti residui distribuire
  let remaining = total - sumFloors;

  // Ordina le allocazioni per resto decrescente per priorità di assegnazione
  const sorted = [...allocations].sort((a, b) => b.remainder - a.remainder);

  // Distribuisce i posti rimanenti uno per uno in ordine di resto decrescente
  for (const allocation of sorted) {
    // Verifica se ci sono ancora posti da assegnare
    if (remaining <= 0) break;
    // Assegna un posto aggiuntivo alla categoria corrente
    allocation.count += 1;
    // Decrementa il contatore dei posti rimanenti
    remaining -= 1;
  }

  // Costruisce la mappa risultante chiave -> conteggio
  const result = new Map<T, number>();
  // Popola la mappa con i conteggi finali
  for (const allocation of allocations) {
    // Inserisce l'allocazione nel risultato
    result.set(allocation.key, allocation.count);
  }

  // Restituisce la mappa delle allocazioni finali
  return result;
}

/**
 * Distribuisce i formati delle domande secondo le percentuali di configurazione.
 * Utilizza l'algoritmo largest-remainder per garantire la somma esatta.
 *
 * @param totalQuestions - Numero totale di domande da distribuire tra i formati
 * @param formatDistribution - Configurazione delle percentuali per ogni formato
 * @returns Array di formati, uno per ogni domanda
 */
function distributeFormats(
  totalQuestions: number,
  formatDistribution: CertificationConfig['formatDistribution']
): QuestionFormat[] {
  // Prepara gli elementi per l'allocazione largest-remainder
  const formatItems: Array<{ key: QuestionFormat; percentage: number }> = [
    // Formato domanda singola con 4 opzioni
    { key: 'single-4', percentage: formatDistribution.singleAnswer4Options },
    // Formato risposta multipla con 5 opzioni
    { key: 'multi-5', percentage: formatDistribution.multiAnswer5Options },
    // Formato risposta multipla con 6 opzioni
    { key: 'multi-6', percentage: formatDistribution.multiAnswer6Options },
  ];

  // Applica l'allocazione largest-remainder per i formati
  const formatCounts = largestRemainderAllocation(formatItems, totalQuestions);

  // Costruisce l'array di formati espanso, uno per ogni domanda
  const formats: QuestionFormat[] = [];
  // Itera sulla mappa dei conteggi per formato
  for (const [format, count] of formatCounts.entries()) {
    // Aggiunge il formato ripetuto per il numero di domande assegnate
    for (let i = 0; i < count; i++) {
      // Inserisce il formato nell'array risultante
      formats.push(format);
    }
  }

  // Restituisce l'array completo dei formati assegnati
  return formats;
}

/**
 * Assegna i topic opzionali agli elementi del piano di generazione.
 * Per ogni topic configurato, alloca ceil(totalQuestions * percentage / 100) elementi.
 * I topic vengono assegnati sequenzialmente ai primi N elementi del piano.
 *
 * @param plan - Array di elementi del piano da annotare con i topic
 * @param topicDistribution - Mappa topic -> percentuale
 * @param totalQuestions - Numero totale di domande nel piano
 */
function assignTopics(
  plan: GenerationPlanItem[],
  topicDistribution: Record<string, number>,
  totalQuestions: number
): void {
  // Indice corrente nel piano per l'assegnazione sequenziale dei topic
  let assignIndex = 0;

  // Itera su ogni topic definito nella distribuzione
  for (const [topic, percentage] of Object.entries(topicDistribution)) {
    // Calcola il numero di elementi da marcare con questo topic (arrotondamento per eccesso)
    const topicCount = Math.ceil((totalQuestions * percentage) / 100);

    // Assegna il topic ai prossimi N elementi del piano
    for (let i = 0; i < topicCount && assignIndex < plan.length; i++) {
      // Imposta il topic sull'elemento corrente del piano
      plan[assignIndex]!.topic = topic;
      // Avanza all'elemento successivo
      assignIndex += 1;
    }
  }
}

/**
 * Handler principale della Lambda build-plan.
 * Carica la configurazione della certificazione, distribuisce le domande tra domini
 * e formati, applica i topic opzionali, e restituisce il piano completo.
 *
 * @param event - Evento in ingresso con certificationId e bankId
 * @returns Piano di generazione completo per lo stato successivo della state machine
 */
export async function handler(event: BuildPlanEvent): Promise<BuildPlanOutput> {
  // Logga l'inizio dell'elaborazione del piano
  logger.info('Inizio costruzione piano di generazione', {
    certificationId: event.certificationId,
    bankId: event.bankId,
  });

  // Carica la configurazione della certificazione dal registry condiviso
  const certConfig = certificationRegistry.getById(event.certificationId);

  // Verifica che la certificazione esista nel registry
  if (!certConfig) {
    // Logga l'errore per certificazione non trovata
    logger.error('Certificazione non trovata nel registry', {
      certificationId: event.certificationId,
    });
    // Lancia un errore per interrompere l'esecuzione della state machine
    throw new Error(`Certificazione non trovata: ${event.certificationId}`);
  }

  // Determina il numero totale di domande dalla configurazione
  const totalQuestions = certConfig.totalQuestions;

  // Prepara gli elementi per la distribuzione per dominio
  const domainItems = certConfig.domains.map((domain) => ({
    // Usa l'ID del dominio come chiave
    key: domain.id,
    // Usa la percentuale configurata per il dominio
    percentage: domain.percentage,
  }));

  // Applica l'allocazione largest-remainder per i domini
  const domainCounts = largestRemainderAllocation(domainItems, totalQuestions);

  // Distribuisce i formati secondo le percentuali di configurazione
  const formats = distributeFormats(totalQuestions, certConfig.formatDistribution);

  // Costruisce il piano espandendo le allocazioni per dominio
  const plan: GenerationPlanItem[] = [];
  // Indice corrente nell'array dei formati
  let formatIndex = 0;

  // Itera sulle allocazioni per dominio per costruire gli elementi del piano
  for (const [domainId, count] of domainCounts.entries()) {
    // Crea un elemento per ogni domanda assegnata al dominio
    for (let i = 0; i < count; i++) {
      // Aggiunge l'elemento del piano con dominio e formato assegnato
      plan.push({
        // Assegna l'identificativo del dominio
        domainId,
        // Assegna il formato dalla distribuzione calcolata
        format: formats[formatIndex]!,
      });
      // Avanza all'indice del formato successivo
      formatIndex += 1;
    }
  }

  // Applica la distribuzione dei topic opzionali se configurata
  if (certConfig.topicDistribution) {
    // Assegna i topic agli elementi del piano
    assignTopics(plan, certConfig.topicDistribution, totalQuestions);
  }

  // Logga le statistiche del piano generato
  logger.info('Piano di generazione costruito con successo', {
    certificationId: event.certificationId,
    bankId: event.bankId,
    totalQuestions,
    dominiDistribuiti: Object.fromEntries(domainCounts),
    formatiDistribuiti: {
      'single-4': formats.filter((f) => f === 'single-4').length,
      'multi-5': formats.filter((f) => f === 'multi-5').length,
      'multi-6': formats.filter((f) => f === 'multi-6').length,
    },
    topicAssegnati: certConfig.topicDistribution
      ? Object.entries(certConfig.topicDistribution).map(([topic, pct]) => ({
          topic,
          conteggio: Math.ceil(totalQuestions * pct / 100),
        }))
      : [],
  });

  // Restituisce il piano completo per lo stato successivo della state machine
  return {
    // Propaga l'identificativo della certificazione
    certificationId: event.certificationId,
    // Propaga l'identificativo della banca domande
    bankId: event.bankId,
    // Include il piano di generazione completo
    plan,
    // Include il numero totale di domande
    totalQuestions,
  };
}
