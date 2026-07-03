import type { DocumentationResult } from '@aws-exam-generator/shared';
import { searchByDomain } from './search-by-domain.js';
import { searchByService, serviceCatalog } from './search-by-service.js';

export const searchByTopic = (query: string, domains?: string[], services?: string[]): DocumentationResult[] => {
  const normalizedQuery = query.toLowerCase();
  const domainResults = (domains ?? []).flatMap((domain) => searchByDomain(domain, query));
  const explicitServices = services?.length ? services : serviceCatalog.filter((service) => normalizedQuery.includes(service));
  const serviceResults = explicitServices.flatMap((service) => searchByService(service, query));
  const fallbackResults = domainResults.length === 0 && serviceResults.length === 0
    ? [
        ...searchByDomain('design-new-solutions', query),
        ...searchByService('ec2', query),
      ]
    : [];

  const unique = new Map<string, DocumentationResult>();
  for (const result of [...domainResults, ...serviceResults, ...fallbackResults]) {
    unique.set(result.url, result);
  }

  return Array.from(unique.values()).slice(0, 5);
};
