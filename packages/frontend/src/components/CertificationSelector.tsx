import type { CertificationConfig } from '@aws-exam-generator/shared';

export function CertificationSelector({
  certifications,
  selectedCertificationId,
  onChange,
}: {
  certifications: CertificationConfig[];
  selectedCertificationId: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 600 }}>
      Certification
      <select
        value={selectedCertificationId}
        onChange={(event) => onChange(event.target.value)}
        style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db' }}
      >
        {certifications.map((certification) => (
          <option key={certification.id} value={certification.id}>
            {certification.displayName} ({certification.examCode})
          </option>
        ))}
      </select>
    </label>
  );
}
