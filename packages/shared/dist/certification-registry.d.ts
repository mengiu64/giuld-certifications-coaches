import type { CertificationConfig, CertificationLevel, CertificationRegistry as CertificationRegistryContract } from './types.js';
export declare class CertificationRegistryImpl implements CertificationRegistryContract {
    private readonly byId;
    getAll(): Record<CertificationLevel, CertificationConfig[]>;
    getById(id: string): CertificationConfig | null;
    getByLevel(level: CertificationLevel): CertificationConfig[];
}
export declare const certificationRegistry: CertificationRegistryImpl;
export declare const certificationCatalog: CertificationConfig[];
