import fs from 'node:fs';
import { parse } from 'yaml';
import { DEFAULT_AI_TOPIC_PERCENTAGE } from '@aws-exam-generator/shared';
import type { CertificationRegistryImpl } from '@aws-exam-generator/shared';

/**
 * Mappa di override: certificationId -> topicId -> percentuale.
 * Rappresenta la struttura dei dati estratti dal file YAML di configurazione.
 */
export interface TopicConfigOverrides {
  [certificationId: string]: Record<string, number>;
}

/**
 * Loader responsabile della lettura, parsing e validazione del file YAML
 * di configurazione dei topic AI per certificazione.
 *
 * Se il file è assente o invalido, applica i valori di default senza
 * interrompere l'avvio dell'applicazione.
 */
export class TopicConfigLoader {
  /**
   * Carica il file YAML di configurazione topic e applica gli override al registry.
   * Se il file è assente o invalido, applica i valori di default.
   *
   * @param yamlPath - Percorso assoluto al file YAML di configurazione
   * @param registry - Istanza del registry delle certificazioni da aggiornare
   * @param defaultPercentage - Percentuale di default (opzionale, usata come fallback)
   */
  static load(
    yamlPath: string,
    registry: CertificationRegistryImpl,
    defaultPercentage?: number,
  ): void {
    // Lettura del file YAML dal percorso specificato
    const content = TopicConfigLoader.readFile(yamlPath);
    if (content === null) {
      // File assente: i default del registry rimangono invariati
      return;
    }

    // Parsing del contenuto YAML
    const parsed = TopicConfigLoader.parseYaml(content, yamlPath);
    if (parsed === null) {
      // Parsing fallito: i default del registry rimangono invariati
      return;
    }

    // Validazione della struttura e dei valori
    const overrides = TopicConfigLoader.validate(parsed, registry);

    // Applicazione degli override validati al registry delle certificazioni
    registry.applyTopicOverrides(overrides);

    // Logging della configurazione effettiva dopo il caricamento
    TopicConfigLoader.logEffectiveConfiguration(registry, overrides);
  }

  /**
   * Logga la configurazione effettiva della topicDistribution per ogni certificazione.
   * Indica quali valori provengono dal file YAML e quali sono i default.
   *
   * @param registry - Registry delle certificazioni con override già applicati
   * @param overrides - Override applicati dal file YAML (per distinguere la sorgente)
   */
  private static logEffectiveConfiguration(
    registry: CertificationRegistryImpl,
    overrides: TopicConfigOverrides,
  ): void {
    const allCertifications = registry.getAll();
    const hasOverrides = Object.keys(overrides).length > 0;

    if (!hasOverrides) {
      console.info('[TopicConfigLoader] INFO: No valid overrides found in YAML configuration. All certifications using default values.');
      return;
    }

    console.info('[TopicConfigLoader] INFO: Topic configuration loaded successfully. Effective configuration:');

    // Iterazione su tutte le certificazioni raggruppate per livello
    for (const certList of Object.values(allCertifications)) {
      for (const cert of certList) {
        if (!cert.topicDistribution) {
          continue;
        }

        // Determinazione della sorgente per ogni topic della certificazione
        const topicEntries = Object.entries(cert.topicDistribution);
        const certOverrides = overrides[cert.id];
        for (const [topicId, percentage] of topicEntries) {
          const source = (certOverrides && topicId in certOverrides)
            ? 'YAML'
            : 'default';
          console.info(
            `[TopicConfigLoader] INFO:   ${cert.id} -> ${topicId}: ${percentage}% (source: ${source}, default: ${DEFAULT_AI_TOPIC_PERCENTAGE}%)`,
          );
        }
      }
    }
  }

  /**
   * Esegue il parsing del contenuto YAML.
   * In caso di errore di sintassi, logga un messaggio ERROR e restituisce null.
   *
   * @param content - Contenuto grezzo del file YAML
   * @param filePath - Percorso del file (usato per il logging)
   * @returns L'oggetto parsed dal YAML, oppure null in caso di errore
   */
  static parseYaml(content: string, filePath: string): unknown {
    try {
      return parse(content);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[TopicConfigLoader] ERROR: Failed to parse YAML file at path: ${filePath}. ${message}. Applying default values.`);
      return null;
    }
  }

  /**
   * Valida la struttura del documento YAML e restituisce solo gli override validi.
   * Controlla la presenza della chiave topicDistribution, la validità degli ID
   * certificazione e che i valori percentuali siano interi nell'intervallo [0, 100].
   *
   * @param parsed - Oggetto risultante dal parsing YAML
   * @param registry - Registry delle certificazioni per verificare gli ID validi
   * @returns Oggetto con gli override validati, vuoto se nessun override è valido
   */
  static validate(parsed: unknown, registry: CertificationRegistryImpl): TopicConfigOverrides {
    const overrides: TopicConfigOverrides = {};

    // Verifica che il risultato del parsing sia un oggetto
    if (parsed === null || typeof parsed !== 'object') {
      console.warn('[TopicConfigLoader] WARN: YAML content is not a valid object. Applying default values.');
      return overrides;
    }

    const doc = parsed as Record<string, unknown>;

    // Verifica presenza della chiave topicDistribution
    if (!('topicDistribution' in doc) || doc.topicDistribution === undefined) {
      console.warn('[TopicConfigLoader] WARN: Missing "topicDistribution" key in YAML configuration. Applying default values.');
      return overrides;
    }

    const topicDistribution = doc.topicDistribution;

    // Verifica che topicDistribution sia un oggetto
    if (topicDistribution === null || typeof topicDistribution !== 'object') {
      console.warn('[TopicConfigLoader] WARN: "topicDistribution" is not a valid object. Applying default values.');
      return overrides;
    }

    // Raccolta degli ID di certificazione validi dal registry
    const allCertifications = registry.getAll();
    const knownCertIds = new Set<string>();
    for (const certList of Object.values(allCertifications)) {
      for (const cert of certList) {
        knownCertIds.add(cert.id);
      }
    }

    // Iterazione sulle entry di topicDistribution per validare ogni certificazione
    const entries = topicDistribution as Record<string, unknown>;
    for (const [certId, topicsValue] of Object.entries(entries)) {
      // Verifica che l'ID certificazione sia registrato
      if (!knownCertIds.has(certId)) {
        console.warn(`[TopicConfigLoader] WARN: Unknown certification ID "${certId}" in YAML configuration. Skipping entry.`);
        continue;
      }

      // Verifica che il valore associato sia un oggetto di topic
      if (topicsValue === null || typeof topicsValue !== 'object') {
        console.warn(`[TopicConfigLoader] WARN: Invalid topics value for certification "${certId}". Expected an object. Skipping entry.`);
        continue;
      }

      const topics = topicsValue as Record<string, unknown>;
      const validTopics: Record<string, number> = {};

      // Validazione di ogni valore percentuale per il topic
      for (const [topicId, percentage] of Object.entries(topics)) {
        if (!TopicConfigLoader.isValidPercentage(percentage)) {
          console.warn(`[TopicConfigLoader] WARN: Invalid percentage value "${percentage}" for certification "${certId}", topic "${topicId}". Must be an integer in [0, 100]. Skipping entry.`);
          continue;
        }
        validTopics[topicId] = percentage as number;
      }

      // Aggiunta degli override solo se ci sono topic validi
      if (Object.keys(validTopics).length > 0) {
        overrides[certId] = validTopics;
      }
    }

    return overrides;
  }

  /**
   * Verifica se un valore è un intero valido nell'intervallo [0, 100].
   *
   * @param value - Valore da validare
   * @returns true se il valore è un intero compreso tra 0 e 100 inclusi
   */
  static isValidPercentage(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
  }

  /**
   * Legge il contenuto del file YAML dal filesystem.
   * Gestisce gracefully il caso in cui il file non esiste,
   * loggando un messaggio di warning e restituendo null.
   *
   * @param filePath - Percorso assoluto al file da leggere
   * @returns Contenuto del file come stringa, oppure null se il file non esiste
   */
  static readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error: unknown) {
      // Gestione specifica per file non trovato
      if (TopicConfigLoader.isFileNotFoundError(error)) {
        console.warn(`[TopicConfigLoader] WARN: Configuration file not found at path: ${filePath}. Applying default values.`);
        return null;
      }
      // Errore generico di lettura file (permessi, ecc.)
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[TopicConfigLoader] WARN: Unable to read configuration file at path: ${filePath}. ${message}. Applying default values.`);
      return null;
    }
  }

  /**
   * Verifica se un errore è di tipo "file non trovato" (ENOENT).
   */
  private static isFileNotFoundError(error: unknown): boolean {
    return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}
