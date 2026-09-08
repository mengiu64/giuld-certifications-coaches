import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import {
  AI_TOPIC_SERVICES,
  certificationConfigSchema,
  generationPlanItemSchema,
  CertificationConfig,
  CertificationRegistry,
  GenerationPlanItem,
} from '@aws-exam-generator/shared';
import { aiServicesArrayArbitrary, certificationConfigWithTopicsArbitrary, generationPlanItemWithTopicArbitrary, questionFormatArbitrary, topicDistributionArbitrary } from '@aws-exam-generator/shared/test-helpers';
import { ExamAgentController } from '../agent/ExamAgentController.js';
import { QuestionGenerator } from '../agent/QuestionGenerator.js';
import { QuestionBankManager } from '../agent/QuestionBankManager.js';

// --- Mock delle dipendenze per istanziare ExamAgentController ---

const mockQuestionGenerator = {} as unknown as QuestionGenerator;
const mockQuestionBankManager = {} as unknown as QuestionBankManager;
const mockCertificationRegistry: CertificationRegistry = {
  getAll: () => ({ professional: [], associate: [], specialty: [] }),
  getById: () => null,
  getByLevel: () => [],
};

/**
 * Crea un'istanza di ExamAgentController con dipendenze mock.
 * Serve unicamente per accedere al metodo privato `buildPlan`.
 */
const createController = (): ExamAgentController =>
  new ExamAgentController(
    mockQuestionGenerator,
    mockQuestionBankManager,
    mockCertificationRegistry,
    '/tmp/test-checkpoint.json',
  );

/**
 * Reimplementazione dell'allocazione largest-remainder (metodo di Hamilton)
 * usata come oracolo di riferimento nel test.
 * Calcola la distribuzione intera di `total` unità tra le entry in base ai pesi percentuali.
 */
const expectedLargestRemainder = (
  weights: Array<{ key: string; weight: number }>,
  total: number,
): Map<string, number> => {
  // Calcola il valore esatto (frazionario) per ciascuna entry
  const raw = weights.map((entry) => ({
    ...entry,
    exact: (entry.weight / 100) * total,
  }));
  // Assegna la parte intera (floor) a ciascuna entry
  const base = raw.map((entry) => ({ ...entry, count: Math.floor(entry.exact) }));
  let assigned = base.reduce((sum, entry) => sum + entry.count, 0);
  // Ordina per resto decrescente per assegnare le unità rimanenti
  const orderedByRemainder = [...base].sort(
    (left, right) => (right.exact - right.count) - (left.exact - left.count),
  );
  let index = 0;
  while (assigned < total) {
    orderedByRemainder[index % orderedByRemainder.length]!.count += 1;
    assigned += 1;
    index += 1;
  }
  return new Map(orderedByRemainder.map((entry) => [entry.key, entry.count]));
};

describe('Feature: ai-question-distribution, Property 2: Topic count matches largest-remainder allocation', () => {
  /**
   * Proprietà 2: Topic count matches largest-remainder allocation
   *
   * Per qualsiasi CertificationConfig valida con topicDistribution:
   * 1. La lunghezza totale del piano === certification.totalQuestions
   * 2. Il conteggio degli elementi con topic === t è uguale all'output dell'allocazione
   *    largest-remainder applicata a totalQuestions × percentage / 100 per ciascun topic t
   * 3. Quando topicDistribution è assente, tutti gli elementi hanno topic === undefined
   *
   * **Validates: Requirements 1.2, 1.3, 2.1, 2.4, 8.1, 8.2, 8.3**
   */
  it('plan topic counts match largest-remainder allocation and total plan length equals totalQuestions', () => {
    const controller = createController();

    /**
     * Funzione ausiliaria per verificare se una configurazione produce overflow
     * di assegnazione topic in un dominio (la somma delle allocazioni per-topic
     * eccede il numero di elementi disponibili nel dominio).
     * Restituisce true se NON ci sono overflow — solo questi casi verificano la proprietà esatta.
     */
    const hasNoDomainOverflow = (certification: CertificationConfig): boolean => {
      if (!certification.topicDistribution || Object.keys(certification.topicDistribution).length === 0) {
        return true;
      }
      const topicWeights = Object.entries(certification.topicDistribution).map(
        ([topic, percentage]) => ({ key: topic, weight: percentage }),
      );
      const topicCounts = expectedLargestRemainder(topicWeights, certification.totalQuestions);
      const domainWeights = certification.domains.map((d) => ({ key: d.id, weight: d.percentage }));
      const domainCounts = expectedLargestRemainder(domainWeights, certification.totalQuestions);

      // Calcola la somma delle allocazioni per-topic per ciascun dominio
      const domainTotalAlloc = new Map<string, number>();
      for (const [, topicCount] of topicCounts) {
        const perDomain = expectedLargestRemainder(domainWeights, topicCount);
        for (const [domainId, count] of perDomain) {
          domainTotalAlloc.set(domainId, (domainTotalAlloc.get(domainId) ?? 0) + count);
        }
      }

      // Verifica che nessun dominio superi la propria capacità
      for (const [domainId, totalAlloc] of domainTotalAlloc) {
        const capacity = domainCounts.get(domainId) ?? 0;
        if (totalAlloc > capacity) {
          return false;
        }
      }
      return true;
    };

    fc.assert(
      fc.property(
        // Filtra configurazioni con domain ID univoci e senza overflow di allocazione per-dominio
        certificationConfigWithTopicsArbitrary.filter((config) => {
          const domainIds = config.domains.map((d) => d.id);
          return new Set(domainIds).size === domainIds.length && hasNoDomainOverflow(config);
        }),
        (certification: CertificationConfig) => {
          // Invoca buildPlan tramite accesso al metodo privato
          const plan: GenerationPlanItem[] = (controller as any)['buildPlan'](certification);

          // 1. La lunghezza totale del piano deve essere uguale a totalQuestions
          expect(plan).toHaveLength(certification.totalQuestions);

          if (
            certification.topicDistribution === undefined ||
            Object.keys(certification.topicDistribution).length === 0
          ) {
            // 3. Quando topicDistribution è assente, tutti gli elementi devono avere topic === undefined
            for (const item of plan) {
              expect(item.topic).toBeUndefined();
            }
          } else {
            // 2. Calcola i conteggi attesi tramite l'oracolo largest-remainder
            const topicWeights = Object.entries(certification.topicDistribution).map(
              ([topic, percentage]) => ({ key: topic, weight: percentage }),
            );
            const expectedCounts = expectedLargestRemainder(topicWeights, certification.totalQuestions);

            // Conta le occorrenze effettive di ogni topic nel piano generato
            const actualCounts = new Map<string, number>();
            for (const item of plan) {
              if (item.topic) {
                actualCounts.set(item.topic, (actualCounts.get(item.topic) ?? 0) + 1);
              }
            }

            // Verifica che i conteggi effettivi corrispondano a quelli attesi
            for (const [topic, expectedCount] of expectedCounts) {
              const actualCount = actualCounts.get(topic) ?? 0;
              expect(actualCount).toBe(expectedCount);
            }

            // Verifica che non ci siano topic nel piano non presenti nella configurazione
            for (const [topic] of actualCounts) {
              expect(expectedCounts.has(topic)).toBe(true);
            }

            // Verifica che la somma degli elementi taggati + non taggati = totalQuestions
            const totalTagged = Array.from(actualCounts.values()).reduce((sum, c) => sum + c, 0);
            const totalUntagged = plan.filter((item) => item.topic === undefined).length;
            expect(totalTagged + totalUntagged).toBe(certification.totalQuestions);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: ai-question-distribution, Property 3: Per-domain topic distribution fairness', () => {
  /**
   * Proprietà 3: Per-domain topic distribution fairness
   *
   * Per ogni CertificationConfig con topicDistribution, e per ogni dominio,
   * il numero di elementi taggati con un topic assegnati a quel dominio
   * deve discostarsi dalla quota proporzionale ideale
   * (topicCount × domainPercentage / 100) al massimo di 1 unità.
   *
   * **Validates: Requirements 2.2**
   */
  it('per-domain topic-tagged item count deviates from ideal share by no more than 1', () => {
    const controller = createController();

    /**
     * Funzione ausiliaria per verificare se una configurazione produce overflow
     * di assegnazione topic in un dominio (la somma delle allocazioni per-topic
     * eccede il numero di elementi disponibili nel dominio).
     * Solo configurazioni senza overflow possono soddisfare la proprietà di fairness esatta.
     */
    const hasNoDomainOverflow = (certification: CertificationConfig): boolean => {
      const topicWeights = Object.entries(certification.topicDistribution!).map(
        ([topic, percentage]) => ({ key: topic, weight: percentage }),
      );
      const topicCounts = expectedLargestRemainder(topicWeights, certification.totalQuestions);
      const domainWeights = certification.domains.map((d) => ({ key: d.id, weight: d.percentage }));
      const domainCounts = expectedLargestRemainder(domainWeights, certification.totalQuestions);

      // Calcola la somma delle allocazioni per-topic per ciascun dominio
      const domainTotalAlloc = new Map<string, number>();
      for (const [, topicCount] of topicCounts) {
        const perDomain = expectedLargestRemainder(domainWeights, topicCount);
        for (const [domainId, count] of perDomain) {
          domainTotalAlloc.set(domainId, (domainTotalAlloc.get(domainId) ?? 0) + count);
        }
      }

      // Verifica che nessun dominio superi la propria capacità
      for (const [domainId, totalAlloc] of domainTotalAlloc) {
        const capacity = domainCounts.get(domainId) ?? 0;
        if (totalAlloc > capacity) {
          return false;
        }
      }
      return true;
    };

    fc.assert(
      fc.property(
        // Filtra configurazioni con topicDistribution definito, domain ID univoci, e senza overflow
        certificationConfigWithTopicsArbitrary.filter(
          (config) => {
            if (!config.topicDistribution || Object.keys(config.topicDistribution).length === 0) return false;
            const domainIds = config.domains.map((d) => d.id);
            if (new Set(domainIds).size !== domainIds.length) return false;
            return hasNoDomainOverflow(config);
          },
        ),
        (certification: CertificationConfig) => {
          // Invoca buildPlan tramite accesso privato
          const plan: GenerationPlanItem[] = (controller as any)['buildPlan'](certification);

          // Calcola il conteggio totale di ogni topic nel piano (largest-remainder globale)
          const topicTotalCounts = new Map<string, number>();
          for (const item of plan) {
            if (item.topic) {
              topicTotalCounts.set(item.topic, (topicTotalCounts.get(item.topic) ?? 0) + 1);
            }
          }

          // Per ogni dominio, verifica che la quota di topic-tagged items
          // devii dalla quota ideale al massimo di 1
          for (const domain of certification.domains) {
            // Elementi nel piano assegnati a questo dominio
            const domainItems = plan.filter((item) => item.domainId === domain.id);

            for (const [topic, topicTotal] of topicTotalCounts) {
              // Conteggio effettivo di elementi con questo topic in questo dominio
              const actualCount = domainItems.filter((item) => item.topic === topic).length;

              // Quota ideale: topicTotal × domainPercentage / 100
              const idealShare = (topicTotal * domain.percentage) / 100;

              // La deviazione dal valore ideale deve essere al massimo 1
              expect(actualCount).toBeGreaterThanOrEqual(Math.floor(idealShare));
              expect(actualCount).toBeLessThanOrEqual(Math.ceil(idealShare));
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


describe('Feature: ai-question-distribution, Property 5: AI-topic mock question passes validation', () => {
  /**
   * Proprietà 5: AI-topic mock question passes validation
   *
   * Per qualsiasi combinazione valida di domainId e QuestionFormat,
   * il mock builder AI-topic produce una domanda il cui campo `services`
   * contiene almeno un'entry che corrisponde (case-insensitive) a un
   * servizio in AI_TOPIC_SERVICES, superando sempre la validazione AI-topic.
   *
   * **Validates: Requirements 3.5, 8.5**
   */
  it('mock builder produces a question with at least one AI_TOPIC_SERVICES match for any domain/format', () => {
    // Crea dipendenze mock vuote per istanziare QuestionGenerator
    const mockBedrockClient = {} as any;
    const mockMcpClient = {} as any;

    // Istanzia il generatore con allowMockFallback = true
    const generator = new QuestionGenerator(mockBedrockClient, mockMcpClient, true);

    // Prepara la lista lowercase dei servizi AI per il confronto case-insensitive
    const aiServicesLower: string[] = AI_TOPIC_SERVICES.map((s) => s.toLowerCase());

    fc.assert(
      fc.property(
        // Genera una CertificationConfig valida (con o senza topicDistribution)
        certificationConfigWithTopicsArbitrary,
        // Genera un formato domanda valido
        questionFormatArbitrary,
        (certification, format) => {
          // Seleziona un domainId dalla configurazione generata
          const domainId = certification.domains[0]!.id;

          // Invoca il metodo privato buildAiTopicMockQuestion
          const draft = (generator as any)['buildAiTopicMockQuestion'](certification, domainId, format);

          // Verifica che il campo services contenga almeno un servizio AI (case-insensitive)
          const hasAiService = draft.services.some((service: string) =>
            aiServicesLower.includes(service.toLowerCase()),
          );

          expect(hasAiService).toBe(true);

          // Verifica aggiuntiva: il formato restituito corrisponde a quello richiesto
          expect(draft.format).toBe(format);
        },
      ),
      { numRuns: 100 },
    );
  });
});


describe('Feature: ai-question-distribution, Property 4: AI-topic validation correctness', () => {
  /**
   * Proprietà 4: AI-topic validation correctness
   *
   * Per qualsiasi array di stringhe di servizi, la funzione di validazione AI-topic
   * restituisce true se e solo se almeno un elemento corrisponde (confronto esatto
   * case-insensitive) a un entry nella lista AI_TOPIC_SERVICES.
   * Servizi che differiscono solo per casing devono corrispondere.
   * Servizi non presenti nella lista (indipendentemente dal casing) non devono corrispondere.
   *
   * **Validates: Requirements 3.3, 4.3, 4.4**
   */

  // Oracolo di riferimento: reimplementa la logica di validazione per confronto
  const aiServicesLower = AI_TOPIC_SERVICES.map((s) => s.toLowerCase());

  const referenceValidation = (services: string[]): boolean =>
    services.some((service) => aiServicesLower.includes(service.toLowerCase()));

  // Istanza di QuestionGenerator con dipendenze mock per accesso al metodo privato
  const mockGenerator = new QuestionGenerator(
    {} as any, // BedrockClient mock
    {} as any, // McpClient mock
    false, // allowMockFallback
  );

  const validateViaGenerator = (services: string[]): boolean =>
    (mockGenerator as any)['validateAiTopicServices']({ services });

  it('returns true iff at least one service case-insensitively matches AI_TOPIC_SERVICES (mixed arrays)', () => {
    fc.assert(
      fc.property(
        aiServicesArrayArbitrary,
        (services: string[]) => {
          const actual = validateViaGenerator(services);
          const expected = referenceValidation(services);
          expect(actual).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns false for arrays containing only non-AI services', () => {
    // Genera array di servizi che NON sono nella lista AI_TOPIC_SERVICES
    const nonAiServicesArbitrary = fc
      .array(
        fc.constantFrom(
          'Amazon EC2',
          'Amazon S3',
          'AWS Lambda',
          'Amazon RDS',
          'Amazon DynamoDB',
          'AWS CloudFormation',
          'Amazon VPC',
          'AWS IAM',
          'Amazon CloudWatch',
          'AWS Step Functions',
        ),
        { minLength: 1, maxLength: 5 },
      );

    fc.assert(
      fc.property(
        nonAiServicesArbitrary,
        (services: string[]) => {
          const actual = validateViaGenerator(services);
          expect(actual).toBe(false);
          // Conferma con l'oracolo di riferimento
          expect(referenceValidation(services)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns true when at least one AI service is present with any casing variation', () => {
    // Genera un singolo servizio AI con casing casuale + servizi non-AI
    const aiServiceWithCasingArbitrary = fc
      .constantFrom(...AI_TOPIC_SERVICES)
      .chain((service) =>
        fc.constantFrom('lower', 'upper', 'mixed').map((casing) => {
          if (casing === 'lower') return service.toLowerCase();
          if (casing === 'upper') return service.toUpperCase();
          return service
            .split('')
            .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
            .join('');
        }),
      );

    const arrayWithAtLeastOneAiServiceArbitrary = fc.tuple(
      aiServiceWithCasingArbitrary,
      fc.array(
        fc.constantFrom('Amazon EC2', 'Amazon S3', 'AWS Lambda', 'Amazon RDS'),
        { minLength: 0, maxLength: 3 },
      ),
    ).map(([aiService, nonAiServices]) => [aiService, ...nonAiServices]);

    fc.assert(
      fc.property(
        arrayWithAtLeastOneAiServiceArbitrary,
        (services: string[]) => {
          const actual = validateViaGenerator(services);
          expect(actual).toBe(true);
          // Conferma con l'oracolo di riferimento
          expect(referenceValidation(services)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});


describe('Feature: ai-question-distribution, Property 6: Plan item schema backward compatibility', () => {
  /**
   * Proprietà 6: Plan item schema backward compatibility
   *
   * Per qualsiasi GenerationPlanItem con un domainId valido e un format valido:
   * 1. Lo schema accetta l'oggetto quando `topic` è una stringa non vuota
   * 2. Lo schema accetta l'oggetto quando `topic` è assente (undefined)
   * 3. Lo schema rifiuta l'oggetto quando `topic` è una stringa vuota ""
   * 4. Lo schema preserva il valore di `topic` attraverso un round-trip JSON
   *    (JSON.stringify + JSON.parse + schema.parse)
   *
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   */

  it('schema succeeds when topic is a non-empty string', () => {
    fc.assert(
      fc.property(
        generationPlanItemWithTopicArbitrary.filter((item) => item.topic !== undefined),
        (item: GenerationPlanItem) => {
          // Verifica che lo schema accetti un plan item con topic definito (stringa non vuota)
          const result = generationPlanItemSchema.safeParse(item);
          expect(result.success).toBe(true);
          expect(result.data.topic).toBe(item.topic);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('schema succeeds when topic is absent (undefined)', () => {
    fc.assert(
      fc.property(
        generationPlanItemWithTopicArbitrary.map((item) => {
          // Rimuove il campo topic per simulare un plan item senza topic
          const { topic: _, ...rest } = item;
          return rest;
        }),
        (item) => {
          // Verifica che lo schema accetti un plan item senza il campo topic
          const result = generationPlanItemSchema.safeParse(item);
          expect(result.success).toBe(true);
          expect(result.data.topic).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('schema rejects when topic is an empty string ""', () => {
    fc.assert(
      fc.property(
        generationPlanItemWithTopicArbitrary.map((item) => ({
          ...item,
          // Sovrascrive topic con una stringa vuota per testare il rifiuto
          topic: '',
        })),
        (item) => {
          // Verifica che lo schema rifiuti un plan item con topic = ""
          const result = generationPlanItemSchema.safeParse(item);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('schema preserves topic through JSON.stringify + JSON.parse + schema.parse round-trip', () => {
    fc.assert(
      fc.property(
        generationPlanItemWithTopicArbitrary.filter((item) => item.topic !== undefined),
        (item: GenerationPlanItem) => {
          // Serializza l'oggetto in JSON e lo deserializza nuovamente
          const serialized = JSON.stringify(item);
          const deserialized = JSON.parse(serialized);

          // Parsa il risultato della deserializzazione attraverso lo schema
          const result = generationPlanItemSchema.safeParse(deserialized);

          // Verifica che il round-trip preservi il valore di topic
          expect(result.success).toBe(true);
          expect(result.data.topic).toBe(item.topic);
          expect(result.data.domainId).toBe(item.domainId);
          expect(result.data.format).toBe(item.format);
        },
      ),
      { numRuns: 100 },
    );
  });
});


describe('Feature: ai-question-distribution, Property 1: Topic distribution schema validation', () => {
  /**
   * Proprietà 1: Topic distribution schema validation
   *
   * Per qualsiasi oggetto `topicDistribution` generato casualmente,
   * lo schema `certificationConfigSchema` DEVE accettarlo se e solo se:
   * - Tutte le chiavi corrispondono al pattern [a-z0-9-]+ con lunghezza 1–64
   * - Tutti i valori sono interi nell'intervallo [1, 100]
   * - Il numero di entry è compreso tra 1 e 10
   * - La somma dei valori ≤ 100
   * Configurazioni che violano uno qualsiasi di questi vincoli DEVONO essere rifiutate.
   *
   * **Validates: Requirements 1.1, 1.4, 2.3, 2.5**
   */

  // Configurazione base valida per testare il campo topicDistribution in contesto
  const validBaseConfig = {
    id: 'TEST-01',
    displayName: 'Test Certification',
    examCode: 'TST-01',
    level: 'associate',
    domains: [{ id: 'domain-1', name: 'Test Domain', percentage: 100 }],
    formatDistribution: { singleAnswer4Options: 70, multiAnswer5Options: 20, multiAnswer6Options: 10 },
    totalQuestions: 65,
    timeLimitMinutes: 130,
  };

  it('accetta configurazioni con topicDistribution valido generato dal arbitrary', () => {
    fc.assert(
      fc.property(
        topicDistributionArbitrary,
        (topicDist: Record<string, number>) => {
          // Verifica che lo schema accetti una config con topicDistribution valido
          const config = { ...validBaseConfig, topicDistribution: topicDist };
          const result = certificationConfigSchema.safeParse(config);
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rifiuta topicDistribution con chiavi contenenti caratteri maiuscoli o speciali', () => {
    // Genera chiavi invalide: contengono lettere maiuscole o caratteri speciali
    const invalidKeyArbitrary = fc.oneof(
      // Chiavi con lettere maiuscole
      fc.stringOf(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
        { minLength: 1, maxLength: 20 },
      ).filter((s) => /[A-Z]/.test(s)),
      // Chiavi con caratteri speciali non consentiti
      fc.stringOf(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_!@#$%^&*()'.split('')),
        { minLength: 1, maxLength: 20 },
      ).filter((s) => /[_!@#$%^&*()]/.test(s)),
    );

    fc.assert(
      fc.property(
        invalidKeyArbitrary,
        (invalidKey: string) => {
          // Costruisce un topicDistribution con una chiave invalida
          const topicDist = { [invalidKey]: 34 };
          const config = { ...validBaseConfig, topicDistribution: topicDist };
          const result = certificationConfigSchema.safeParse(config);
          // Lo schema deve rifiutare la configurazione
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rifiuta topicDistribution con valori fuori dall\'intervallo [1, 100]', () => {
    // Genera valori non validi: 0, negativi, > 100, o non interi
    const invalidValueArbitrary = fc.oneof(
      fc.constant(0), // Valore zero (il minimo ammesso è 1)
      fc.integer({ min: -1000, max: -1 }), // Valori negativi
      fc.integer({ min: 101, max: 10000 }), // Valori superiori a 100
      fc.double({ min: 0.01, max: 99.99, noNaN: true }).filter((v) => !Number.isInteger(v)), // Non interi
    );

    fc.assert(
      fc.property(
        invalidValueArbitrary,
        (invalidValue: number) => {
          // Costruisce un topicDistribution con un valore invalido
          const topicDist = { 'generative-ai': invalidValue };
          const config = { ...validBaseConfig, topicDistribution: topicDist };
          const result = certificationConfigSchema.safeParse(config);
          // Lo schema deve rifiutare la configurazione
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rifiuta topicDistribution la cui somma dei valori supera 100', () => {
    // Genera entry multiple la cui somma eccede deliberatamente 100
    const overflowDistributionArbitrary = fc
      .integer({ min: 2, max: 10 })
      .chain((numEntries) =>
        fc
          .tuple(
            fc.uniqueArray(
              fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
                minLength: 1,
                maxLength: 20,
              }),
              { minLength: numEntries, maxLength: numEntries },
            ),
            fc.array(fc.integer({ min: 11, max: 100 }), { minLength: numEntries, maxLength: numEntries }),
          )
          .map(([keys, values]) => {
            // Assicura che la somma superi strettamente 100
            const result: Record<string, number> = {};
            for (let i = 0; i < keys.length; i++) {
              result[keys[i]!] = values[i]!;
            }
            return result;
          })
          // Filtra solo i casi in cui la somma effettivamente supera 100
          .filter((dist) => Object.values(dist).reduce((a, b) => a + b, 0) > 100),
      );

    fc.assert(
      fc.property(
        overflowDistributionArbitrary,
        (topicDist: Record<string, number>) => {
          const config = { ...validBaseConfig, topicDistribution: topicDist };
          const result = certificationConfigSchema.safeParse(config);
          // Lo schema deve rifiutare configurazioni con somma > 100
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rifiuta topicDistribution con più di 10 entry', () => {
    // Genera esattamente 11-15 entry per superare il limite di 10
    const tooManyEntriesArbitrary = fc
      .integer({ min: 11, max: 15 })
      .chain((numEntries) =>
        fc
          .uniqueArray(
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), {
              minLength: 1,
              maxLength: 20,
            }),
            { minLength: numEntries, maxLength: numEntries },
          )
          .map((keys) => {
            // Assegna valori piccoli per evitare superamento della somma 100
            // (ogni entry riceve 1, così la somma rimane ≤ 15 < 100)
            const result: Record<string, number> = {};
            for (const key of keys) {
              result[key] = 1;
            }
            return result;
          }),
      );

    fc.assert(
      fc.property(
        tooManyEntriesArbitrary,
        (topicDist: Record<string, number>) => {
          const config = { ...validBaseConfig, topicDistribution: topicDist };
          const result = certificationConfigSchema.safeParse(config);
          // Lo schema deve rifiutare configurazioni con più di 10 entry
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accetta configurazioni senza topicDistribution (campo opzionale)', () => {
    // Verifica che lo schema accetti una config senza topicDistribution
    const config = { ...validBaseConfig };
    const result = certificationConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});
