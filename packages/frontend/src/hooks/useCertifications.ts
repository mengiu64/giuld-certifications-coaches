import { useEffect, useMemo, useState } from 'react';
import type { CertificationConfig } from '@aws-exam-generator/shared';
import { apiClient } from '../services/api-client';
import { getSelectedCertification, setSelectedCertification } from '../utils/localStorage';

export const useCertifications = () => {
  const [certifications, setCertifications] = useState<Record<'professional' | 'associate' | 'specialty', CertificationConfig[]> | null>(null);
  const [selectedCertificationId, setSelectedCertificationId] = useState<string>(getSelectedCertification() ?? 'SAP-C02');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const result = await apiClient.getCertifications();
        setCertifications(result);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load certifications.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setSelectedCertification(selectedCertificationId);
  }, [selectedCertificationId]);

  const flatCertifications = useMemo(() => {
    if (!certifications) {
      return [] as CertificationConfig[];
    }
    return [...certifications.professional, ...certifications.associate, ...certifications.specialty];
  }, [certifications]);

  return {
    certifications,
    flatCertifications,
    selectedCertificationId,
    setSelectedCertificationId,
    loading,
    error,
  };
};
