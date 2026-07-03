import type { CertificationConfig, GenerationStatus, Question, QuestionBank, QuestionBankSummary } from '@aws-exam-generator/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const apiClient = {
  getCertifications: () => request<Record<'professional' | 'associate' | 'specialty', CertificationConfig[]>>('/certifications'),
  generateExam: (certificationId?: string) =>
    request<GenerationStatus>('/exams/generate', {
      method: 'POST',
      body: JSON.stringify(certificationId ? { certificationId } : {}),
    }),
  getGenerationStatus: () => request<GenerationStatus>('/exams/generate/status'),
  getBanks: () => request<QuestionBankSummary[]>('/banks'),
  getBank: (bankId: string) => request<QuestionBank>(`/banks/${bankId}`),
  saveQuestion: (question: Question, certificationId?: string) =>
    request<Question>(`/questions${certificationId ? `?certificationId=${encodeURIComponent(certificationId)}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(question),
    }),
  getQuestions: (certificationId?: string) =>
    request<Question[]>(`/questions${certificationId ? `?cert=${encodeURIComponent(certificationId)}` : ''}`),
};
