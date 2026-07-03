const COMMON_FORMAT_DISTRIBUTION = {
    singleAnswer4Options: 70,
    multiAnswer5Options: 20,
    multiAnswer6Options: 10,
};
const CERTIFICATIONS = [
    {
        id: 'SAP-C02',
        displayName: 'AWS Certified Solutions Architect - Professional',
        examCode: 'SAP-C02',
        level: 'professional',
        totalQuestions: 75,
        timeLimitMinutes: 180,
        formatDistribution: { ...COMMON_FORMAT_DISTRIBUTION },
        domains: [
            { id: 'design-solutions-organizational-complexity', name: 'Design Solutions for Organizational Complexity', percentage: 26 },
            { id: 'design-new-solutions', name: 'Design New Solutions', percentage: 29 },
            { id: 'continuous-improvement-existing-solutions', name: 'Continuous Improvement for Existing Solutions', percentage: 25 },
            { id: 'accelerate-workload-migration-modernization', name: 'Accelerate Workload Migration and Modernization', percentage: 20 },
        ],
    },
    {
        id: 'SAA-C03',
        displayName: 'AWS Certified Solutions Architect - Associate',
        examCode: 'SAA-C03',
        level: 'associate',
        totalQuestions: 65,
        timeLimitMinutes: 130,
        formatDistribution: { ...COMMON_FORMAT_DISTRIBUTION },
        domains: [
            { id: 'design-secure-architectures', name: 'Design Secure Architectures', percentage: 30 },
            { id: 'design-resilient-architectures', name: 'Design Resilient Architectures', percentage: 26 },
            { id: 'design-high-performing-architectures', name: 'Design High-Performing Architectures', percentage: 24 },
            { id: 'design-cost-optimized-architectures', name: 'Design Cost-Optimized Architectures', percentage: 20 },
        ],
    },
    {
        id: 'DVA-C02',
        displayName: 'AWS Certified Developer - Associate',
        examCode: 'DVA-C02',
        level: 'associate',
        totalQuestions: 65,
        timeLimitMinutes: 130,
        formatDistribution: { ...COMMON_FORMAT_DISTRIBUTION },
        domains: [
            { id: 'development-with-aws-services', name: 'Development with AWS Services', percentage: 32 },
            { id: 'security', name: 'Security', percentage: 26 },
            { id: 'deployment', name: 'Deployment', percentage: 24 },
            { id: 'troubleshooting-optimization', name: 'Troubleshooting and Optimization', percentage: 18 },
        ],
    },
    {
        id: 'SOA-C02',
        displayName: 'AWS Certified SysOps Administrator - Associate',
        examCode: 'SOA-C02',
        level: 'associate',
        totalQuestions: 65,
        timeLimitMinutes: 130,
        formatDistribution: { ...COMMON_FORMAT_DISTRIBUTION },
        domains: [
            { id: 'monitoring-reporting-logging', name: 'Monitoring, Logging, and Remediation', percentage: 20 },
            { id: 'reliability-business-continuity', name: 'Reliability and Business Continuity', percentage: 16 },
            { id: 'deployment-provisioning-automation', name: 'Deployment, Provisioning, and Automation', percentage: 18 },
            { id: 'security-compliance-governance', name: 'Security and Compliance', percentage: 16 },
            { id: 'networking-content-delivery', name: 'Networking and Content Delivery', percentage: 18 },
            { id: 'cost-performance-optimization', name: 'Cost and Performance Optimization', percentage: 12 },
        ],
    },
    {
        id: 'MLS-C01',
        displayName: 'AWS Certified Machine Learning - Specialty',
        examCode: 'MLS-C01',
        level: 'specialty',
        totalQuestions: 65,
        timeLimitMinutes: 180,
        formatDistribution: { ...COMMON_FORMAT_DISTRIBUTION },
        domains: [
            { id: 'data-engineering', name: 'Data Engineering', percentage: 20 },
            { id: 'exploratory-data-analysis', name: 'Exploratory Data Analysis', percentage: 24 },
            { id: 'modeling', name: 'Modeling', percentage: 36 },
            { id: 'ml-implementation-operations', name: 'Machine Learning Implementation and Operations', percentage: 20 },
        ],
    },
    {
        id: 'SCS-C02',
        displayName: 'AWS Certified Security - Specialty',
        examCode: 'SCS-C02',
        level: 'specialty',
        totalQuestions: 65,
        timeLimitMinutes: 180,
        formatDistribution: { ...COMMON_FORMAT_DISTRIBUTION },
        domains: [
            { id: 'threat-detection-incident-response', name: 'Threat Detection and Incident Response', percentage: 14 },
            { id: 'security-logging-monitoring', name: 'Security Logging and Monitoring', percentage: 18 },
            { id: 'infrastructure-security', name: 'Infrastructure Security', percentage: 20 },
            { id: 'identity-access-management', name: 'Identity and Access Management', percentage: 16 },
            { id: 'data-protection', name: 'Data Protection', percentage: 18 },
            { id: 'management-security-governance', name: 'Management and Security Governance', percentage: 14 },
        ],
    },
    {
        id: 'ANS-C01',
        displayName: 'AWS Certified Advanced Networking - Specialty',
        examCode: 'ANS-C01',
        level: 'specialty',
        totalQuestions: 65,
        timeLimitMinutes: 170,
        formatDistribution: { ...COMMON_FORMAT_DISTRIBUTION },
        domains: [
            { id: 'network-design', name: 'Network Design', percentage: 30 },
            { id: 'network-implementation', name: 'Network Implementation', percentage: 26 },
            { id: 'network-management-operations', name: 'Network Management and Operation', percentage: 20 },
            { id: 'network-security-compliance', name: 'Network Security, Compliance, and Governance', percentage: 24 },
        ],
    },
];
export class CertificationRegistryImpl {
    byId = new Map(CERTIFICATIONS.map((config) => [config.id, config]));
    getAll() {
        return {
            professional: CERTIFICATIONS.filter((config) => config.level === 'professional'),
            associate: CERTIFICATIONS.filter((config) => config.level === 'associate'),
            specialty: CERTIFICATIONS.filter((config) => config.level === 'specialty'),
        };
    }
    getById(id) {
        return this.byId.get(id) ?? null;
    }
    getByLevel(level) {
        return CERTIFICATIONS.filter((config) => config.level === level);
    }
}
export const certificationRegistry = new CertificationRegistryImpl();
export const certificationCatalog = CERTIFICATIONS;
//# sourceMappingURL=certification-registry.js.map