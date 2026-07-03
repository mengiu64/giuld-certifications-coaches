import { v4 as uuidv4 } from 'uuid';
    import {
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

      async generateQuestion(certification: CertificationConfig, domainId: string, format: QuestionFormat): Promise<Question> {
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

      private async enforceBedrockDelay(): Promise<void> {
        const delta = Date.now() - this.lastBedrockRequestAt;
        if (delta < BEDROCK_INTER_REQUEST_DELAY_MS) {
          await sleep(BEDROCK_INTER_REQUEST_DELAY_MS - delta);
        }
      }
    }
