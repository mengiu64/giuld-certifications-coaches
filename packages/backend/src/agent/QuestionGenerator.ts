import { v4 as uuidv4 } from 'uuid';
    import {
      AI_TOPIC_SERVICES,
      BEDROCK_INTER_REQUEST_DELAY_MS,
      FORMAT_OPTION_COUNT,
      QUESTION_LABELS,
      generatedQuestionDraftSchema,
      type CertificationConfig,
      type DocumentationResult,
      type GeneratedQuestionDraft,
      type Question,
      type QuestionFormat,
    } from '@aws-exam-generator/shared';
    import { BedrockClient } from '../services/BedrockClient.js';
    import { McpClient } from '../mcp/McpClient.js';
    import { QuestionValidator } from './QuestionValidator.js';
    import { SchemaValidator } from './SchemaValidator.js';

    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    const formatInstruction = (format: QuestionFormat): string => {
      switch (format) {
        case 'single-4':
          return '4 options, exactly 1 correct';
        case 'multi-5':
          return '5 options, exactly 2-3 correct';
        case 'multi-6':
          return '6 options, exactly 2-3 correct';
      }
    };

    const formatCorrectAnswerCount = (format: QuestionFormat): string[] => {
      switch (format) {
        case 'single-4':
          return ['A'];
        case 'multi-5':
          return ['A', 'D'];
        case 'multi-6':
          return ['B', 'D', 'F'];
      }
    };

    const domainServiceHints: Record<string, string[]> = {
      'design-solutions-organizational-complexity': ['Organizations', 'Control Tower', 'IAM'],
      'design-new-solutions': ['EC2', 'RDS', 'S3'],
      'continuous-improvement-existing-solutions': ['CloudWatch', 'Trusted Advisor', 'Compute Optimizer'],
      'accelerate-workload-migration-modernization': ['Migration Hub', 'Application Migration Service', 'DMS'],
      'design-secure-architectures': ['IAM', 'KMS', 'WAF'],
      'design-resilient-architectures': ['Route 53', 'Elastic Load Balancing', 'RDS'],
      'design-high-performing-architectures': ['CloudFront', 'DynamoDB', 'EC2'],
      'design-cost-optimized-architectures': ['S3', 'Savings Plans', 'Auto Scaling'],
      'development-with-aws-services': ['Lambda', 'API Gateway', 'SQS'],
      security: ['IAM', 'KMS', 'Secrets Manager'],
      deployment: ['CodePipeline', 'CodeDeploy', 'CloudFormation'],
      'troubleshooting-optimization': ['CloudWatch', 'X-Ray', 'Lambda'],
      'monitoring-reporting-logging': ['CloudWatch', 'CloudTrail', 'Config'],
      'reliability-business-continuity': ['AWS Backup', 'Route 53', 'Elastic Disaster Recovery'],
      'deployment-provisioning-automation': ['CloudFormation', 'Systems Manager', 'OpsWorks'],
      'security-compliance-governance': ['IAM', 'Security Hub', 'Organizations'],
      'networking-content-delivery': ['VPC', 'CloudFront', 'Global Accelerator'],
      'cost-performance-optimization': ['Compute Optimizer', 'Savings Plans', 'Trusted Advisor'],
      'data-engineering': ['Glue', 'S3', 'Kinesis'],
      'exploratory-data-analysis': ['Athena', 'SageMaker', 'QuickSight'],
      modeling: ['SageMaker', 'ECR', 'Step Functions'],
      'ml-implementation-operations': ['SageMaker', 'CloudWatch', 'EventBridge'],
      'threat-detection-incident-response': ['GuardDuty', 'Security Hub', 'Detective'],
      'security-logging-monitoring': ['CloudTrail', 'CloudWatch', 'Config'],
      'infrastructure-security': ['WAF', 'Shield', 'VPC'],
      'identity-access-management': ['IAM', 'IAM Identity Center', 'Cognito'],
      'data-protection': ['KMS', 'Macie', 'S3'],
      'management-security-governance': ['Organizations', 'Control Tower', 'Audit Manager'],
      'network-design': ['Transit Gateway', 'Direct Connect', 'Route 53'],
      'network-implementation': ['VPC', 'Site-to-Site VPN', 'NLB'],
      'network-management-operations': ['CloudWatch', 'Network Manager', 'Reachability Analyzer'],
      'network-security-compliance': ['Network Firewall', 'WAF', 'GuardDuty'],
    };

    export class QuestionGenerator {
      private lastBedrockRequestAt = 0;

      constructor(
        private readonly bedrockClient: BedrockClient,
        private readonly mcpClient: McpClient,
        private readonly allowMockFallback: boolean,
      ) {}

      async generateQuestion(certification: CertificationConfig, domainId: string, format: QuestionFormat, topic?: string): Promise<Question> {
        // Quando il topic è definito, utilizza il percorso di generazione AI-topic
        if (topic) {
          return this.generateAiTopicQuestion(certification, domainId, format, topic);
        }

        // Percorso standard senza topic: comportamento esistente invariato
        const documentation = await this.fetchDocumentation(domainId, certification);
        const systemPrompt = this.buildSystemPrompt(certification, domainId, format, documentation);
        const userPrompt = this.buildUserPrompt(certification, domainId, format);

        try {
          await this.enforceBedrockDelay();
          const raw = await this.bedrockClient.generateText(systemPrompt, userPrompt);
          this.lastBedrockRequestAt = Date.now();
          const parsed = SchemaValidator.parse(raw, generatedQuestionDraftSchema);
          const normalized = QuestionValidator.normalizeDraft(parsed);
          QuestionValidator.assertValidQuestion(normalized);
          return {
            questionId: uuidv4(),
            ...normalized,
          };
        } catch (error) {
          if (!this.allowMockFallback) {
            throw error;
          }
          const draft = this.buildMockQuestion(certification, domainId, format, documentation);
          QuestionValidator.assertValidQuestion(draft);
          return {
            questionId: uuidv4(),
            ...draft,
          };
        }
      }

      /**
       * Genera una domanda a tema AI con logica di retry e fallback mock.
       * Esegue fino a 3 tentativi totali (1 iniziale + 2 retry) se la validazione
       * dei servizi AI fallisce. Dopo l'esaurimento dei retry, ricade sulla mock AI-topic.
       *
       * @param certification - Configurazione della certificazione
       * @param domainId - Identificatore del dominio target
       * @param format - Formato della domanda (single-4, multi-5, multi-6)
       * @param topic - Identificatore del topic assegnato al plan item (es. "generative-ai")
       * @returns Domanda generata con servizi AI validati o mock AI-topic di fallback
       */
      private async generateAiTopicQuestion(certification: CertificationConfig, domainId: string, format: QuestionFormat, topic: string): Promise<Question> {
        // Log informativo: inizio elaborazione di un plan item a tema AI
        console.info(`[QuestionGenerator] Processing AI-topic plan item: domain=${domainId}, format=${format}, topic=${topic}`);

        // Recupera documentazione specifica per i servizi AI
        const documentation = await this.fetchAiTopicDocumentation(domainId, certification);
        // Costruisce il prompt specializzato per topic AI
        const systemPrompt = this.buildAiTopicSystemPrompt(certification, domainId, format, documentation);
        const userPrompt = this.buildUserPrompt(certification, domainId, format);

        // Numero massimo di tentativi: 1 iniziale + 2 retry = 3 totali
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await this.enforceBedrockDelay();
            const raw = await this.bedrockClient.generateText(systemPrompt, userPrompt);
            this.lastBedrockRequestAt = Date.now();
            const parsed = SchemaValidator.parse(raw, generatedQuestionDraftSchema);
            const normalized = QuestionValidator.normalizeDraft(parsed);
            QuestionValidator.assertValidQuestion(normalized);

            // Validazione post-generazione: verifica che almeno un servizio AI sia presente
            if (this.validateAiTopicServices(normalized)) {
              // Identifica i servizi corrispondenti per il log di successo
              const aiServicesLower = AI_TOPIC_SERVICES.map((s) => s.toLowerCase());
              const matchedServices = normalized.services.filter((service) =>
                aiServicesLower.includes(service.toLowerCase()),
              );
              // Log informativo: validazione AI-topic superata con successo
              console.info(`[QuestionGenerator] AI-topic validation passed: matched services=[${matchedServices.join(', ')}], domain=${domainId}`);
              // Validazione superata: restituisce la domanda generata
              return {
                questionId: uuidv4(),
                ...normalized,
              };
            }

            // Log di avviso: validazione AI-topic fallita, servizi restituiti non corrispondono
            console.warn(`[QuestionGenerator] AI-topic validation failed: returned services=[${normalized.services.join(', ')}], expected=[${AI_TOPIC_SERVICES.join(', ')}], attempt=${attempt}/${maxAttempts}`);

            // Validazione AI-topic fallita: se non è l'ultimo tentativo, riprova
            if (attempt === maxAttempts) {
              break;
            }
            // Continua con il prossimo tentativo di retry
          } catch (error) {
            // Errore generico durante la generazione: gestito con fallback
            console.error(`[QuestionGenerator] AI-topic attempt ${attempt}/${maxAttempts} failed:`, error instanceof Error ? error.message : String(error));
            if (!this.allowMockFallback) {
              throw error;
            }
            // Per errori non di validazione, ricade direttamente sulla mock AI-topic
            // Log di errore: fallback al mock per errore durante la generazione
            if (attempt === maxAttempts) {
              console.error(`[QuestionGenerator] AI-topic retries exhausted, falling back to mock: domain=${domainId}, topic=${topic}`);
            }
            const draft = this.buildAiTopicMockQuestion(certification, domainId, format);
            QuestionValidator.assertValidQuestion(draft);
            return {
              questionId: uuidv4(),
              ...draft,
            };
          }
        }

        // Tutti i retry esauriti: fallback alla domanda mock AI-topic garantita
        // Log di errore: tentativi esauriti, ricorso al mock con servizi AI garantiti
        console.error(`[QuestionGenerator] AI-topic retries exhausted, falling back to mock: domain=${domainId}, topic=${topic}`);
        const draft = this.buildAiTopicMockQuestion(certification, domainId, format);
        QuestionValidator.assertValidQuestion(draft);
        return {
          questionId: uuidv4(),
          ...draft,
        };
      }

      private async fetchDocumentation(domainId: string, certification: CertificationConfig): Promise<DocumentationResult[]> {
        const seedServices = domainServiceHints[domainId] ?? ['AWS', 'EC2', 'S3'];
        try {
          const [domainResults, topicResults] = await Promise.all([
            this.mcpClient.searchByDomain(domainId, certification.displayName),
            this.mcpClient.searchByTopic(certification.displayName, [domainId], seedServices.slice(0, 2)),
          ]);
          const merged = new Map<string, DocumentationResult>();
          for (const result of [...domainResults, ...topicResults]) {
            merged.set(result.url, result);
          }
          return Array.from(merged.values()).slice(0, 4);
        } catch {
          return seedServices.slice(0, 4).map((service) => ({
            title: `${service} architecture guidance`,
            url: `https://docs.aws.amazon.com/search/doc-search.html?searchPath=documentation-guide&searchQuery=${encodeURIComponent(service)}`,
            snippet: `AWS documentation highlights how ${service} supports resilient, secure, and operationally efficient workloads for ${certification.examCode}.`,
            service,
            domain: domainId,
            source: 'aws-docs-mock' as const,
          }));
        }
      }

      /**
       * Recupera documentazione contestuale per domande a tema AI generativa.
       * Utilizza i servizi definiti in AI_TOPIC_SERVICES come seed per la ricerca MCP.
       *
       * @param domainId - Identificatore del dominio per la ricerca
       * @param certification - Configurazione della certificazione
       * @returns Array di risultati di documentazione relativi ai servizi AI
       */
      private async fetchAiTopicDocumentation(domainId: string, certification: CertificationConfig): Promise<DocumentationResult[]> {
        // Usa i servizi AI come seed invece dei suggerimenti per dominio
        const seedServices = AI_TOPIC_SERVICES.slice(0, 3) as unknown as string[];
        try {
          const [domainResults, topicResults] = await Promise.all([
            this.mcpClient.searchByDomain(domainId, certification.displayName),
            this.mcpClient.searchByTopic(certification.displayName, [domainId], seedServices.slice(0, 2)),
          ]);
          const merged = new Map<string, DocumentationResult>();
          for (const result of [...domainResults, ...topicResults]) {
            merged.set(result.url, result);
          }
          return Array.from(merged.values()).slice(0, 4);
        } catch {
          // Fallback: costruisce documentazione mock basata sui servizi AI
          return seedServices.slice(0, 4).map((service) => ({
            title: `${service} architecture guidance`,
            url: `https://docs.aws.amazon.com/search/doc-search.html?searchPath=documentation-guide&searchQuery=${encodeURIComponent(service)}`,
            snippet: `AWS documentation highlights how ${service} supports generative AI workloads for ${certification.examCode}.`,
            service,
            domain: domainId,
            source: 'aws-docs-mock' as const,
          }));
        }
      }

      private buildSystemPrompt(
        certification: CertificationConfig,
        domainId: string,
        format: QuestionFormat,
        context: DocumentationResult[],
      ): string {
        return `You are an expert AWS certification exam question writer. Generate a single practice exam question for ${certification.id}.

Domain: ${domainId}
Format: ${format}
AWS Documentation Context: ${context.map((entry) => `${entry.title} — ${entry.snippet} (${entry.url})`).join(' | ')}

Generate a realistic, scenario-based question following these rules:
- Stem: 50-200 words of scenario context + 1 clear interrogative
- For single-4: 4 options, exactly 1 correct
- For multi-5: 5 options, exactly 2-3 correct
- For multi-6: 6 options, exactly 2-3 correct
- Each option min 10 words
- Explanation: 50-300 words, mention at least 1 AWS service
- Domain tag: one of ${certification.domains.map((domain) => domain.id).join(', ')}
- Services: 1-3 AWS services most relevant

Respond ONLY with valid JSON matching this schema:
{
  "stem": "...",
  "options": [{"label": "A", "text": "..."}],
  "correctAnswers": ["A"],
  "domain": "...",
  "services": ["EC2"],
  "explanation": "...",
  "format": "single-4",
  "referenceUrl": "https://docs.aws.amazon.com/..."
}`;
      }

      /**
       * Costruisce il prompt di sistema per la generazione di domande a tema AI generativa.
       * Include istruzioni che richiedono riferimenti espliciti ai servizi AI nello stem
       * e nel campo services della domanda generata.
       *
       * @param certification - Configurazione della certificazione
       * @param domainId - Identificatore del dominio target
       * @param format - Formato della domanda (single-4, multi-5, multi-6)
       * @param context - Documentazione contestuale recuperata per i servizi AI
       * @returns Stringa con il prompt di sistema specializzato per topic AI
       */
      private buildAiTopicSystemPrompt(
        certification: CertificationConfig,
        domainId: string,
        format: QuestionFormat,
        context: DocumentationResult[],
      ): string {
        // Istruzione aggiuntiva: la domanda deve menzionare almeno un servizio dalla lista AI
        return `You are an expert AWS certification exam question writer specializing in Generative AI topics. Generate a single practice exam question for ${certification.id}.

Domain: ${domainId}
Format: ${format}
AWS AI Services Documentation Context: ${context.map((entry) => `${entry.title} — ${entry.snippet} (${entry.url})`).join(' | ')}

IMPORTANT AI TOPIC REQUIREMENTS:
- The question MUST reference at least one service from this list in the question stem: ${AI_TOPIC_SERVICES.join(', ')}
- The "services" field in your response MUST include at least one service from: ${AI_TOPIC_SERVICES.join(', ')}
- Focus the scenario on Generative AI use cases (e.g., foundation models, RAG, prompt engineering, AI assistants)

Generate a realistic, scenario-based question following these rules:
- Stem: 50-200 words of scenario context + 1 clear interrogative
- For single-4: 4 options, exactly 1 correct
- For multi-5: 5 options, exactly 2-3 correct
- For multi-6: 6 options, exactly 2-3 correct
- Each option min 10 words
- Explanation: 50-300 words, mention at least 1 AWS AI service
- Domain tag: one of ${certification.domains.map((domain) => domain.id).join(', ')}
- Services: 1-3 AWS services, at least one from: ${AI_TOPIC_SERVICES.join(', ')}

Respond ONLY with valid JSON matching this schema:
{
  "stem": "...",
  "options": [{"label": "A", "text": "..."}],
  "correctAnswers": ["A"],
  "domain": "...",
  "services": ["Amazon Bedrock"],
  "explanation": "...",
  "format": "single-4",
  "referenceUrl": "https://docs.aws.amazon.com/..."
}`;
      }

      private buildUserPrompt(certification: CertificationConfig, domainId: string, format: QuestionFormat): string {
        return `Certification: ${certification.displayName} (${certification.examCode})
Target domain: ${domainId}
Required format: ${format} (${formatInstruction(format)})
Only output JSON.`;
      }

      private buildMockQuestion(
        certification: CertificationConfig,
        domainId: string,
        format: QuestionFormat,
        docs: DocumentationResult[],
      ): GeneratedQuestionDraft {
        const services = docs.map((entry) => entry.service).filter((service, index, list) => list.indexOf(service) === index).slice(0, 3);
        const chosenServices = services.length > 0 ? services : (domainServiceHints[domainId] ?? ['EC2', 'S3']).slice(0, 3);
        const optionCount = FORMAT_OPTION_COUNT[format];
        const labels = QUESTION_LABELS.slice(0, optionCount);
        const stem = [
          `A global enterprise is preparing for the ${certification.examCode} focus area ${domainId} while consolidating multiple AWS accounts, legacy integrations, and strict operational controls across several Regions.`,
          `The platform team must improve resilience, governance, and day-2 operations without introducing manual steps that would slow application delivery for dozens of product teams.`,
          `Architecture decisions must align with AWS best practices referenced in the current documentation set, including ${chosenServices.join(', ')}.`,
          `Which solution should the solutions architect recommend to satisfy the requirements with the LEAST operational overhead?`,
        ].join(' ');
        const optionTemplates = [
          `Use ${chosenServices[0]} with centralized guardrails, automation, and monitoring so each workload inherits consistent controls and scalable operations.`,
          `Deploy a custom management layer on self-managed virtual machines to coordinate all environments and manually approve every infrastructure change.`,
          `Separate production and non-production boundaries while integrating ${chosenServices[1] ?? chosenServices[0]} to improve resilience, observability, and controlled delegation.`,
          `Rely on weekly manual exports and ad hoc scripts without service-native policies, event-driven remediation, or centralized visibility.`,
          `Adopt event-driven workflows that combine ${chosenServices[2] ?? chosenServices[0]} with automated drift detection and repeatable deployment patterns.`,
          `Keep a single shared account for all teams and depend on local administrator access to resolve governance exceptions on demand.`,
        ];
        const correctAnswers = formatCorrectAnswerCount(format).slice(0, format === 'single-4' ? 1 : format === 'multi-5' ? 2 : 3);
        const explanation = `The recommended answer emphasizes managed AWS capabilities and layered governance so the organization can scale securely with less manual effort. Services such as ${chosenServices.join(', ')} help standardize controls, automate operational tasks, and reduce risk compared with custom or manual approaches. AWS documentation consistently favors native automation, delegated administration, and service-integrated observability for architectures in the ${domainId} domain.`;

        return {
          stem,
          options: labels.map((label, index) => ({
            label,
            text: optionTemplates[index] ?? optionTemplates[0]!,
          })),
          correctAnswers,
          domain: domainId,
          services: chosenServices,
          explanation,
          format,
          referenceUrl: docs[0]?.url ?? 'https://docs.aws.amazon.com/',
        };
      }

      /**
       * Valida che almeno un servizio nella domanda corrisponda (case-insensitive)
       * a uno dei servizi nella lista AI_TOPIC_SERVICES.
       *
       * @param question - Draft della domanda generata contenente il campo `services`
       * @returns true se almeno un servizio corrisponde a un entry in AI_TOPIC_SERVICES
       */
      private validateAiTopicServices(question: GeneratedQuestionDraft): boolean {
        // Confronto case-insensitive: converte tutto in lowercase per il match
        const aiServicesLower = AI_TOPIC_SERVICES.map((s) => s.toLowerCase());
        return question.services.some((service) =>
          aiServicesLower.includes(service.toLowerCase()),
        );
      }

      /**
       * Costruisce una domanda mock a tema AI generativa, garantendo che il campo
       * `services` contenga almeno un servizio da AI_TOPIC_SERVICES e che la
       * domanda superi sempre la validazione AI-topic.
       *
       * @param certification - Configurazione della certificazione
       * @param domainId - Identificatore del dominio target
       * @param format - Formato della domanda (single-4, multi-5, multi-6)
       * @returns Draft della domanda mock con servizi AI garantiti
       */
      private buildAiTopicMockQuestion(
        certification: CertificationConfig,
        domainId: string,
        format: QuestionFormat,
      ): GeneratedQuestionDraft {
        // Seleziona servizi dalla lista AI_TOPIC_SERVICES per garantire la validazione
        const chosenServices = AI_TOPIC_SERVICES.slice(0, 3) as unknown as string[];
        const optionCount = FORMAT_OPTION_COUNT[format];
        const labels = QUESTION_LABELS.slice(0, optionCount);

        // Costruisce lo stem con scenario realistico basato su AI generativa
        const stem = [
          `A multinational financial services company is modernizing its ${certification.examCode} platform for the ${domainId} domain by adopting generative AI capabilities.`,
          `The engineering team needs to implement a solution using ${chosenServices[0]} to build intelligent document processing, automated customer support, and knowledge management systems.`,
          `The architecture must integrate with existing data pipelines while maintaining compliance with regulatory requirements across multiple regions.`,
          `Which combination of services and configurations should the solutions architect recommend to meet these requirements with optimal performance and cost efficiency?`,
        ].join(' ');

        // Template delle opzioni che referenziano servizi AI per coerenza tematica
        const optionTemplates = [
          `Deploy ${chosenServices[0]} with custom foundation models, implement RAG using Amazon Kendra for knowledge retrieval, and configure auto-scaling for inference endpoints.`,
          `Use self-managed open-source LLMs on EC2 instances without managed service integration, requiring manual model updates and infrastructure maintenance.`,
          `Implement ${chosenServices[1] ?? chosenServices[0]} for code generation assistance while integrating ${chosenServices[2] ?? chosenServices[0]} for embedding generation and semantic search capabilities.`,
          `Rely on traditional rule-based systems without AI capabilities, manually processing all documents and customer interactions.`,
          `Combine ${chosenServices[0]} agents with ${chosenServices[1] ?? chosenServices[0]} for developer productivity, using serverless architecture for scalable inference.`,
          `Deploy a single large model on dedicated hardware without auto-scaling, failover, or cost optimization strategies.`,
        ];

        // Determina le risposte corrette in base al formato
        const correctAnswers = formatCorrectAnswerCount(format).slice(0, format === 'single-4' ? 1 : format === 'multi-5' ? 2 : 3);

        // Spiegazione che menziona i servizi AI scelti e le best practice
        const explanation = `The recommended approach leverages managed AWS AI services including ${chosenServices.join(', ')} to provide scalable, cost-effective generative AI capabilities. ${chosenServices[0]} offers access to foundation models with built-in security and governance. The architecture follows AWS best practices for the ${domainId} domain by using serverless inference, managed RAG pipelines, and automated scaling to handle variable workloads while maintaining compliance requirements.`;

        return {
          stem,
          options: labels.map((label, index) => ({
            label,
            text: optionTemplates[index] ?? optionTemplates[0]!,
          })),
          correctAnswers,
          domain: domainId,
          services: chosenServices,
          explanation,
          format,
          referenceUrl: 'https://docs.aws.amazon.com/bedrock/',
        };
      }

      private async enforceBedrockDelay(): Promise<void> {
        const delta = Date.now() - this.lastBedrockRequestAt;
        if (delta < BEDROCK_INTER_REQUEST_DELAY_MS) {
          await sleep(BEDROCK_INTER_REQUEST_DELAY_MS - delta);
        }
      }
    }
