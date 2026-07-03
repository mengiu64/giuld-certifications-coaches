import type { DocumentationResult } from '@aws-exam-generator/shared';

const DOMAIN_SNIPPETS: Record<string, DocumentationResult[]> = {
  'design-new-solutions': [
    {
      title: 'AWS Well-Architected Framework operational excellence design principles',
      url: 'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html',
      snippet: 'Design new workloads with automation, perform architecture reviews early, and favor managed services to reduce operational burden at scale.',
      service: 'Well-Architected',
      domain: 'design-new-solutions',
      source: 'aws-docs-mock',
    },
    {
      title: 'AWS Organizations multi-account strategy',
      url: 'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices.html',
      snippet: 'Use multiple accounts, delegated administrators, and SCP guardrails to isolate environments and scale governance safely.',
      service: 'Organizations',
      domain: 'design-new-solutions',
      source: 'aws-docs-mock',
    },
  ],
  'continuous-improvement-existing-solutions': [
    {
      title: 'AWS Trusted Advisor operational checks',
      url: 'https://docs.aws.amazon.com/awssupport/latest/user/trusted-advisor.html',
      snippet: 'Trusted Advisor helps identify cost, performance, resilience, and service limit improvements for running production environments.',
      service: 'Trusted Advisor',
      domain: 'continuous-improvement-existing-solutions',
      source: 'aws-docs-mock',
    },
    {
      title: 'CloudWatch dashboards and alarms',
      url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html',
      snippet: 'Dashboards, metrics, and composite alarms improve visibility into bottlenecks and guide iterative optimization decisions.',
      service: 'CloudWatch',
      domain: 'continuous-improvement-existing-solutions',
      source: 'aws-docs-mock',
    },
  ],
  'accelerate-workload-migration-modernization': [
    {
      title: 'Migration Hub and application migration strategies',
      url: 'https://docs.aws.amazon.com/migrationhub/latest/ug/whatishub.html',
      snippet: 'Plan migrations with discovery data, wave-based cutovers, and dependency visibility to reduce business disruption.',
      service: 'Migration Hub',
      domain: 'accelerate-workload-migration-modernization',
      source: 'aws-docs-mock',
    },
    {
      title: 'AWS Application Migration Service cutover best practices',
      url: 'https://docs.aws.amazon.com/mgn/latest/ug/what-is-application-migration-service.html',
      snippet: 'Use staging areas, non-disruptive testing, and post-launch automation to modernize servers with repeatable guardrails.',
      service: 'MGN',
      domain: 'accelerate-workload-migration-modernization',
      source: 'aws-docs-mock',
    },
  ],
  'security': [
    {
      title: 'AWS KMS key policies and grants',
      url: 'https://docs.aws.amazon.com/kms/latest/developerguide/key-policies.html',
      snippet: 'Combine key policies, grants, and IAM conditions to segment administrative and cryptographic access safely.',
      service: 'KMS',
      domain: 'security',
      source: 'aws-docs-mock',
    },
    {
      title: 'AWS WAF web ACL design',
      url: 'https://docs.aws.amazon.com/waf/latest/developerguide/web-acl.html',
      snippet: 'Use managed rule groups, labels, and rate-based rules to protect internet-facing applications with centralized governance.',
      service: 'WAF',
      domain: 'security',
      source: 'aws-docs-mock',
    },
  ],
  'network-design': [
    {
      title: 'Transit Gateway design patterns',
      url: 'https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html',
      snippet: 'Use Transit Gateway route tables and attachment segmentation to isolate domains and simplify multi-VPC or hybrid routing.',
      service: 'Transit Gateway',
      domain: 'network-design',
      source: 'aws-docs-mock',
    },
    {
      title: 'Direct Connect resiliency toolkit',
      url: 'https://docs.aws.amazon.com/directconnect/latest/UserGuide/disaster-recovery-resiliency.html',
      snippet: 'Follow maximum resiliency or high resiliency models with diverse locations and BGP failover testing.',
      service: 'Direct Connect',
      domain: 'network-design',
      source: 'aws-docs-mock',
    },
  ],
};

const DEFAULT_RESULTS: DocumentationResult[] = [
  {
    title: 'AWS whitepapers and implementation guides',
    url: 'https://docs.aws.amazon.com/whitepapers/latest/',
    snippet: 'AWS documentation emphasizes designing for security, reliability, performance efficiency, operational excellence, and cost optimization.',
    service: 'AWS',
    domain: 'general',
    source: 'aws-docs-mock',
  },
];

export const searchByDomain = (domain: string, topic?: string): DocumentationResult[] => {
  const normalizedDomain = domain.trim().toLowerCase();
  const results = DOMAIN_SNIPPETS[normalizedDomain] ?? DEFAULT_RESULTS;
  if (!topic) {
    return results;
  }
  const normalizedTopic = topic.toLowerCase();
  const filtered = results.filter((result) =>
    result.title.toLowerCase().includes(normalizedTopic) ||
    result.snippet.toLowerCase().includes(normalizedTopic) ||
    result.service.toLowerCase().includes(normalizedTopic),
  );
  return filtered.length > 0 ? filtered : results;
};
