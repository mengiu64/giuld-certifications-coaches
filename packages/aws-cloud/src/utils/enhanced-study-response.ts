/**
 * Modulo per la costruzione delle risposte arricchite in modalità studio.
 *
 * Responsabilità:
 * - Definizione delle interfacce per il contesto e la risposta Bedrock
 * - Costruzione del prompt per Bedrock con il contesto della domanda
 *
 * Ogni riga è commentata in italiano come richiesto dal Requirement 6.1.
 */

import type { Question, OptionAnalysisItem, EnhancedStudyResponse } from '@aws-exam-generator/shared'; // Tipi dal pacchetto condiviso

/**
 * Contesto necessario per costruire la risposta arricchita in modalità studio.
 * Contiene la domanda, le risposte selezionate dall'utente, la correttezza e la spiegazione base.
 */
export interface EnhancedStudyContext {
  /** La domanda originale con stem, opzioni, risposte corrette, dominio e servizi */
  question: Question;
  /** Array delle etichette (label) delle risposte selezionate dall'utente */
  selectedAnswers: string[];
  /** Indica se la risposta dell'utente è corretta */
  isCorrect: boolean;
  /** Spiegazione base della risposta (già presente nel sistema) */
  baseExplanation: string;
}

/**
 * Formato della risposta grezza attesa da Bedrock per il study mode.
 * Contiene la spiegazione dettagliata, l'analisi delle opzioni e un diagramma opzionale.
 */
export interface BedrockStudyResponseData {
  /** Spiegazione dettagliata generata dal modello AI (100-5000 caratteri) */
  detailedExplanation: string;
  /** Analisi di ciascuna opzione con label, correttezza e spiegazione */
  optionAnalysis: Array<{
    /** Etichetta dell'opzione (A, B, C, D, E, F) */
    label: string;
    /** Indica se l'opzione è una risposta corretta */
    isCorrect: boolean;
    /** Spiegazione del perché l'opzione è corretta o incorretta */
    explanation: string;
  }>;
  /** Diagramma Mermaid opzionale (null se non applicabile) */
  diagram: string | null;
}

/**
 * Costruisce il system prompt e lo user prompt per l'invocazione di Bedrock.
 * Il prompt include tutto il contesto necessario: stem, opzioni, risposte corrette,
 * risposte selezionate, dominio e servizi AWS.
 * La richiesta di diagramma è inclusa solo se la domanda coinvolge almeno 2 servizi.
 *
 * @param context - Il contesto della domanda e delle risposte dell'utente
 * @returns Oggetto con systemPrompt e userPrompt per Bedrock
 */
export function buildStudyPrompt(context: EnhancedStudyContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  // Estrae i campi necessari dal contesto per costruire il prompt
  const { question, selectedAnswers, isCorrect } = context;

  // Determina se il diagramma deve essere richiesto (solo se servizi >= 2)
  const shouldRequestDiagram = question.services.length >= 2;

  // Costruisce la sezione delle opzioni formattata per il prompt
  const optionsText = question.options
    .map((opt) => `${opt.label}. ${opt.text}`) // Formato: "A. testo dell'opzione"
    .join('\n'); // Separa ogni opzione con un newline

  // Costruisce la lista delle risposte corrette come stringa
  const correctAnswersText = question.correctAnswers.join(', '); // Es: "A, C"

  // Costruisce la lista delle risposte selezionate dall'utente come stringa
  const selectedAnswersText = selectedAnswers.join(', '); // Es: "B, D"

  // Costruisce la lista dei servizi AWS coinvolti come stringa
  const servicesText = question.services.join(', '); // Es: "S3, Lambda, DynamoDB"

  // Sezione del diagramma nel prompt: inclusa solo se la domanda coinvolge >= 2 servizi
  const diagramInstruction = shouldRequestDiagram
    ? `
- "diagram": una stringa con un diagramma Mermaid che illustra le relazioni tra i servizi AWS coinvolti. Il diagramma DEVE iniziare con una keyword valida: "graph", "sequenceDiagram", "flowchart" o "architecture". Usa nodi e connessioni per mostrare come i servizi interagiscono.`
    : `
- "diagram": null (la domanda coinvolge meno di 2 servizi, il diagramma non è necessario)`;

  // System prompt: istruisce il modello sul suo ruolo e sul formato di risposta atteso
  const systemPrompt = `Sei un tutor esperto di servizi AWS e certificazioni cloud. Il tuo compito è fornire spiegazioni dettagliate e analisi approfondite delle domande d'esame AWS in formato JSON strutturato.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con la seguente struttura:
{
  "detailedExplanation": "spiegazione dettagliata (100-5000 caratteri)",
  "optionAnalysis": [
    { "label": "A", "isCorrect": true/false, "explanation": "spiegazione (20-1000 caratteri)" }
  ],
  "diagram": "diagramma Mermaid" | null
}

Regole:
- La "detailedExplanation" deve essere approfondita, tra 100 e 5000 caratteri, e spiegare il concetto AWS sottostante.
- L'"optionAnalysis" deve contenere un elemento per OGNI opzione della domanda, spiegando perché è corretta o incorretta.
- Ogni spiegazione nell'optionAnalysis deve avere tra 20 e 1000 caratteri.
- NON includere testo al di fuori del JSON.`;

  // User prompt: fornisce il contesto specifico della domanda da analizzare
  const userPrompt = `Analizza la seguente domanda d'esame AWS e fornisci una risposta arricchita.

DOMANDA (stem):
${question.stem}

OPZIONI:
${optionsText}

RISPOSTE CORRETTE: ${correctAnswersText}
RISPOSTE SELEZIONATE DALL'UTENTE: ${selectedAnswersText}
ESITO: ${isCorrect ? 'CORRETTO' : 'ERRATO'}

DOMINIO: ${question.domain}
SERVIZI AWS COINVOLTI: ${servicesText}

ISTRUZIONI PER LA RISPOSTA JSON:
- "detailedExplanation": spiegazione approfondita del concetto AWS, perché le risposte corrette sono giuste e perché quelle sbagliate sono errate. Tra 100 e 5000 caratteri.
- "optionAnalysis": un array con un elemento per CIASCUNA delle ${question.options.length} opzioni (${question.options.map((o) => o.label).join(', ')}). Ogni elemento deve avere "label", "isCorrect" (boolean), "explanation" (20-1000 caratteri).${diagramInstruction}

Rispondi SOLO con il JSON, senza testo aggiuntivo.`;

  // Restituisce l'oggetto con entrambi i prompt costruiti
  return { systemPrompt, userPrompt };
}

/**
 * Parsa la risposta grezza di Bedrock ed estrae i dati strutturati per il study mode.
 * Ritorna null se il parsing JSON fallisce o se la struttura non ha i campi attesi.
 *
 * @param rawText - La stringa grezza restituita da Bedrock (attesa in formato JSON)
 * @param context - Il contesto della domanda per eventuale validazione incrociata
 * @returns L'oggetto BedrockStudyResponseData estratto oppure null se il parsing fallisce
 */
export function parseBedrockStudyResponse(
  rawText: string,
  context: EnhancedStudyContext
): BedrockStudyResponseData | null {
  // Variabile per contenere il risultato del parsing JSON
  let parsed: unknown;

  try {
    // Tenta il parsing JSON della risposta grezza di Bedrock
    parsed = JSON.parse(rawText);
  } catch {
    // Se il parsing fallisce, ritorna null (la risposta non è JSON valido)
    return null;
  }

  // Verifica che il risultato del parsing sia un oggetto non-null
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  // Cast a Record per accedere ai campi in modo sicuro
  const obj = parsed as Record<string, unknown>;

  // Verifica che il campo detailedExplanation sia una stringa
  if (typeof obj.detailedExplanation !== 'string') {
    return null;
  }

  // Verifica che il campo optionAnalysis sia un array
  if (!Array.isArray(obj.optionAnalysis)) {
    return null;
  }

  // Verifica che ogni elemento dell'array optionAnalysis abbia la struttura attesa
  const optionAnalysisValid = obj.optionAnalysis.every((item: unknown) => {
    // Ogni elemento deve essere un oggetto non-null
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    // Cast per accedere ai campi dell'elemento
    const entry = item as Record<string, unknown>;
    // Verifica che label sia una stringa, isCorrect un boolean, explanation una stringa
    return (
      typeof entry.label === 'string' &&
      typeof entry.isCorrect === 'boolean' &&
      typeof entry.explanation === 'string'
    );
  });

  // Se la validazione degli elementi optionAnalysis fallisce, ritorna null
  if (!optionAnalysisValid) {
    return null;
  }

  // Verifica che il campo diagram sia null oppure una stringa (opzionale)
  if (obj.diagram !== null && typeof obj.diagram !== 'string') {
    return null;
  }

  // Costruisce e ritorna l'oggetto BedrockStudyResponseData con i campi estratti
  return {
    detailedExplanation: obj.detailedExplanation, // Spiegazione dettagliata
    optionAnalysis: obj.optionAnalysis as BedrockStudyResponseData['optionAnalysis'], // Analisi opzioni
    diagram: (obj.diagram as string | null) ?? null, // Diagramma Mermaid o null
  };
}

/**
 * Valida la sintassi di un diagramma Mermaid verificando che inizi con una keyword valida.
 * Le keyword valide sono: graph, sequenceDiagram, flowchart, architecture.
 *
 * @param diagram - La stringa del diagramma Mermaid da validare
 * @returns true se il diagramma inizia con una keyword Mermaid valida, false altrimenti
 */
export function validateMermaidSyntax(diagram: string): boolean {
  // Rimuove spazi iniziali e finali dalla stringa del diagramma
  const trimmed = diagram.trim();

  // Lista delle keyword Mermaid valide con cui un diagramma deve iniziare
  const validKeywords = ['graph', 'sequenceDiagram', 'flowchart', 'architecture'];

  // Verifica che la stringa trimmata inizi con una delle keyword valide
  return validKeywords.some((keyword) => trimmed.startsWith(keyword));
}


/**
 * Completa l'array di analisi delle opzioni assicurando che ci sia un elemento
 * per ogni opzione della domanda. Se un'opzione non è presente nell'array parziale
 * fornito da Bedrock, viene creato un placeholder con spiegazione generica.
 *
 * @param partial - Array parziale di analisi opzioni (potenzialmente incompleto) restituito da Bedrock
 * @param question - La domanda originale con tutte le opzioni e risposte corrette
 * @returns Array completo di OptionAnalysisItem con un elemento per ogni opzione della domanda
 */
export function completeOptionAnalysis(
  partial: OptionAnalysisItem[],
  question: Question
): OptionAnalysisItem[] {
  // Itera su tutte le opzioni della domanda per garantire completezza
  return question.options.map((option) => {
    // Cerca nell'array parziale un elemento con la stessa etichetta (label) dell'opzione corrente
    const existing = partial.find((item) => item.label === option.label);

    // Determina se questa opzione è una risposta corretta confrontando con correctAnswers
    const isCorrect = question.correctAnswers.includes(option.label);

    // Se l'elemento esiste nell'array parziale, lo utilizza con i dati aggiornati dalla domanda
    if (existing) {
      // Restituisce l'elemento esistente con text e isCorrect dalla domanda originale
      return {
        label: option.label, // Etichetta dell'opzione (A, B, C, D, E, F)
        text: option.text, // Testo dell'opzione dalla domanda originale
        isCorrect, // Correttezza derivata da correctAnswers della domanda
        explanation: existing.explanation, // Spiegazione fornita da Bedrock
      };
    }

    // Se l'elemento non esiste, crea un placeholder con spiegazione generica in italiano
    const genericExplanation = isCorrect
      ? 'Questa opzione è corretta in base ai criteri dell\'esame AWS.' // Spiegazione generica per opzione corretta
      : 'Questa opzione è incorretta in base ai criteri dell\'esame AWS.'; // Spiegazione generica per opzione incorretta

    // Restituisce il placeholder completo con tutti i campi richiesti
    return {
      label: option.label, // Etichetta dell'opzione (A, B, C, D, E, F)
      text: option.text, // Testo dell'opzione dalla domanda originale
      isCorrect, // Correttezza derivata da correctAnswers della domanda
      explanation: genericExplanation, // Spiegazione generica di almeno 20 caratteri
    };
  });
}

/**
 * Assembla l'oggetto EnhancedStudyResponse finale combinando il contesto base
 * con i dati generati da Bedrock. Gestisce il fallback quando Bedrock fallisce
 * e applica le regole per il diagramma (null se servizi < 2 o sintassi invalida).
 *
 * @param context - Il contesto con domanda, risposte utente, correttezza e spiegazione base
 * @param bedrockData - I dati strutturati dalla risposta Bedrock, oppure null se Bedrock ha fallito
 * @returns L'oggetto EnhancedStudyResponse completo pronto per la restituzione al client
 */
export function buildEnhancedResponse(
  context: EnhancedStudyContext,
  bedrockData: BedrockStudyResponseData | null
): EnhancedStudyResponse {
  // Estrae la domanda dal contesto per accesso rapido ai campi
  const { question } = context;

  // Caso fallback: Bedrock ha fallito (bedrockData è null)
  if (bedrockData === null) {
    // Utilizza la spiegazione base come detailedExplanation, assicurando almeno 100 caratteri
    let detailedExplanation = context.baseExplanation;

    // Se la spiegazione base è più corta di 100 caratteri, la estende con padding
    while (detailedExplanation.length < 100) {
      detailedExplanation += ' Approfondisci nella documentazione ufficiale AWS per maggiori dettagli.'; // Padding in italiano
    }

    // Completa l'optionAnalysis con un array vuoto (tutti placeholder generici)
    const optionAnalysis = completeOptionAnalysis([], question);

    // Costruisce e restituisce la risposta di fallback senza dati Bedrock
    return {
      isCorrect: context.isCorrect, // Correttezza dalla valutazione base
      explanation: context.baseExplanation, // Spiegazione base originale
      detailedExplanation, // Spiegazione base estesa a >= 100 caratteri
      optionAnalysis, // Analisi opzioni con placeholder generici
      diagram: null, // Nessun diagramma in caso di fallback
      services: question.services, // Servizi AWS dalla domanda originale
      referenceUrl: question.referenceUrl, // URL di riferimento dalla domanda (opzionale)
    };
  }

  // Caso normale: Bedrock ha restituito dati validi
  // Utilizza la spiegazione dettagliata generata da Bedrock
  const detailedExplanation = bedrockData.detailedExplanation;

  // Completa l'optionAnalysis integrando i dati parziali di Bedrock con quelli della domanda
  const optionAnalysis = completeOptionAnalysis(
    bedrockData.optionAnalysis as OptionAnalysisItem[], // Cast: i dati Bedrock hanno la stessa struttura base
    question
  );

  // Determina il valore del diagramma applicando le regole di validazione
  let diagram: string | null = null; // Inizializza a null (default sicuro)

  // Verifica se il diagramma può essere incluso: servizi >= 2 e diagramma fornito da Bedrock
  if (question.services.length >= 2 && bedrockData.diagram !== null) {
    // Valida la sintassi Mermaid del diagramma generato
    const isMermaidValid = validateMermaidSyntax(bedrockData.diagram);

    // Imposta il diagramma solo se la sintassi è valida, altrimenti resta null
    if (isMermaidValid) {
      diagram = bedrockData.diagram; // Diagramma Mermaid valido
    }
    // Se la sintassi non è valida, diagram resta null (regola di graceful degradation)
  }
  // Se servizi < 2, diagram resta null indipendentemente dalla risposta Bedrock

  // Costruisce e restituisce la risposta arricchita completa
  return {
    isCorrect: context.isCorrect, // Correttezza dalla valutazione base
    explanation: context.baseExplanation, // Spiegazione base originale
    detailedExplanation, // Spiegazione dettagliata da Bedrock
    optionAnalysis, // Analisi opzioni completata
    diagram, // Diagramma Mermaid o null
    services: question.services, // Servizi AWS dalla domanda originale
    referenceUrl: question.referenceUrl, // URL di riferimento dalla domanda (opzionale)
  };
}
