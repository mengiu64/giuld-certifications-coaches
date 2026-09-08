/**
 * Modulo per la pubblicazione di eventi su Amazon EventBridge.
 *
 * Espone la funzione `publishEvent` che invia eventi sul bus personalizzato
 * "aws-exam-generator". La pubblicazione è fire-and-forget: in caso di errore
 * viene loggato un messaggio di errore strutturato, ma l'eccezione non viene
 * mai propagata al chiamante.
 *
 * @module eventbridge-publisher
 */

// Importazione del client EventBridge e del comando per l'invio di eventi
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

// Nome del bus eventi, configurabile tramite variabile d'ambiente con fallback
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? "aws-exam-generator";

// Sorgente costante per tutti gli eventi pubblicati dall'applicazione
const EVENT_SOURCE = "aws-exam-generator";

// Istanza singleton del client EventBridge
const client = new EventBridgeClient({});

/**
 * Pubblica un evento sul bus EventBridge personalizzato.
 *
 * Funziona in modalità fire-and-forget: se la pubblicazione fallisce,
 * l'errore viene loggato a livello ERROR ma non viene mai sollevata
 * un'eccezione verso il chiamante.
 *
 * @param detailType - Tipo di dettaglio dell'evento (es. "QuestionBankGenerated")
 * @param detail - Payload dell'evento come oggetto chiave-valore
 * @returns Promise<void> - Si risolve sempre senza errori
 */
export async function publishEvent(
  detailType: string,
  detail: Record<string, unknown>
): Promise<void> {
  try {
    // Costruzione del comando per l'invio dell'evento al bus personalizzato
    const command = new PutEventsCommand({
      Entries: [
        {
          // Nome del bus eventi di destinazione
          EventBusName: EVENT_BUS_NAME,
          // Sorgente dell'evento per il filtraggio nelle regole
          Source: EVENT_SOURCE,
          // Tipo di dettaglio per il matching nelle regole EventBridge
          DetailType: detailType,
          // Payload serializzato come stringa JSON
          Detail: JSON.stringify(detail),
        },
      ],
    });

    // Invio dell'evento al bus EventBridge
    await client.send(command);
  } catch (error) {
    // Log strutturato dell'errore senza propagazione dell'eccezione
    console.error(
      JSON.stringify({
        level: "ERROR",
        message: "Errore durante la pubblicazione dell'evento su EventBridge",
        detailType,
        eventBusName: EVENT_BUS_NAME,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
