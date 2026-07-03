const SERVICE_SNIPPETS = {
    ec2: {
        domain: 'compute',
        entries: [
            {
                title: 'Amazon EC2 Auto Scaling best practices',
                url: 'https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-benefits.html',
                snippet: 'Use dynamic scaling policies with warm pools and lifecycle hooks to improve resilience and reduce scale-out latency for bursty workloads.',
            },
            {
                title: 'EC2 instance purchasing options',
                url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-purchasing-options.html',
                snippet: 'Blend On-Demand, Savings Plans, and Spot Instances to meet availability targets while optimizing steady-state and interruptible capacity.',
            },
        ],
    },
    s3: {
        domain: 'storage',
        entries: [
            {
                title: 'Amazon S3 data protection and versioning',
                url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html',
                snippet: 'Enable versioning, MFA delete, and lifecycle rules to protect data durability and automate retention across multiple access patterns.',
            },
            {
                title: 'Amazon S3 performance guidelines',
                url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html',
                snippet: 'Distribute requests across prefixes and use multipart uploads or S3 Transfer Acceleration for globally distributed clients.',
            },
        ],
    },
    iam: {
        domain: 'security',
        entries: [
            {
                title: 'IAM policy evaluation logic',
                url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html',
                snippet: 'Explicit denies override allows across identity-based, resource-based, SCP, and permissions boundary policy evaluation.',
            },
            {
                title: 'IAM best practices',
                url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
                snippet: 'Use temporary credentials, enforce least privilege, and validate access with IAM Access Analyzer before production rollout.',
            },
        ],
    },
    lambda: {
        domain: 'serverless',
        entries: [
            {
                title: 'Lambda scaling and concurrency',
                url: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html',
                snippet: 'Reserve concurrency for critical functions and monitor downstream dependencies when traffic spikes or retry storms occur.',
            },
            {
                title: 'Lambda event source mapping behavior',
                url: 'https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html',
                snippet: 'Batching windows, partial batch responses, and retry controls influence throughput and error isolation for stream consumers.',
            },
        ],
    },
    vpc: {
        domain: 'networking',
        entries: [
            {
                title: 'VPC route tables and hybrid connectivity',
                url: 'https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html',
                snippet: 'Propagated routes, more-specific prefixes, and inspection VPC patterns affect transit gateway and Direct Connect routing decisions.',
            },
            {
                title: 'Security group and network ACL comparison',
                url: 'https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html',
                snippet: 'Stateful security groups and stateless network ACLs should be combined to enforce layered controls without breaking asymmetric flows.',
            },
        ],
    },
    rds: {
        domain: 'databases',
        entries: [
            {
                title: 'Amazon RDS Multi-AZ deployments',
                url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
                snippet: 'Multi-AZ improves availability with synchronous replication and automated failover but does not scale read traffic on its own.',
            },
            {
                title: 'RDS read replicas and scaling',
                url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html',
                snippet: 'Read replicas support read scaling, cross-Region reporting, and disaster recovery strategies with eventual consistency considerations.',
            },
        ],
    },
    dynamodb: {
        domain: 'databases',
        entries: [
            {
                title: 'DynamoDB partition key design',
                url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html',
                snippet: 'Choose high-cardinality partition keys and distribute traffic evenly to avoid hot partitions in spiky write workloads.',
            },
            {
                title: 'DynamoDB global tables considerations',
                url: 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html',
                snippet: 'Global tables replicate data across Regions with last-writer-wins conflict resolution and multi-Region active-active patterns.',
            },
        ],
    },
    cloudfront: {
        domain: 'content-delivery',
        entries: [
            {
                title: 'CloudFront caching and origin failover',
                url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/high_availability_origin_failover.html',
                snippet: 'Origin groups and cache policies can improve resilience while preserving viewer performance for multi-origin architectures.',
            },
            {
                title: 'CloudFront signed URLs and cookies',
                url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html',
                snippet: 'Use signed URLs or signed cookies to restrict private content distribution without exposing origin infrastructure publicly.',
            },
        ],
    },
};
const toResult = (serviceName, domain, entry) => ({
    title: entry.title,
    url: entry.url,
    snippet: entry.snippet,
    service: serviceName,
    domain,
    source: 'aws-docs-mock',
});
export const searchByService = (serviceName, topic) => {
    const normalizedService = serviceName.trim().toLowerCase();
    const match = SERVICE_SNIPPETS[normalizedService] ?? SERVICE_SNIPPETS.ec2;
    const filteredEntries = match.entries.filter((entry) => {
        if (!topic) {
            return true;
        }
        const normalizedTopic = topic.toLowerCase();
        return entry.title.toLowerCase().includes(normalizedTopic) || entry.snippet.toLowerCase().includes(normalizedTopic);
    });
    const entries = filteredEntries.length > 0 ? filteredEntries : match.entries;
    return entries.map((entry) => toResult(serviceName.toUpperCase(), match.domain, entry));
};
export const serviceCatalog = Object.keys(SERVICE_SNIPPETS);
//# sourceMappingURL=search-by-service.js.map