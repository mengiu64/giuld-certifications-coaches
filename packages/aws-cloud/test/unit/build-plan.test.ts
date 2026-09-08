import { describe, it, expect, vi } from 'vitest';
import { handler } from '../../src/orchestration/build-plan.js';

describe('build-plan orchestration Lambda', () => {
  it('genera un piano con il numero corretto di domande per SAP-C02', async () => {
    // SAP-C02 ha totalQuestions = 75
    const result = await handler({ certificationId: 'SAP-C02', bankId: 'test-bank-1' });

    // Verifica che il piano contenga esattamente 75 elementi
    expect(result.plan.length).toBe(75);
    expect(result.totalQuestions).toBe(75);
    expect(result.certificationId).toBe('SAP-C02');
    expect(result.bankId).toBe('test-bank-1');
  });

  it('distribuisce le domande tra i domini secondo le percentuali configurate', async () => {
    // SAP-C02 ha 4 domini: 26%, 29%, 25%, 20% su 75 domande
    const result = await handler({ certificationId: 'SAP-C02', bankId: 'test-bank-2' });

    // Conta le domande per dominio
    const domainCounts = new Map<string, number>();
    for (const item of result.plan) {
      domainCounts.set(item.domainId, (domainCounts.get(item.domainId) ?? 0) + 1);
    }

    // Verifica che la somma totale sia 75
    const total = Array.from(domainCounts.values()).reduce((s, c) => s + c, 0);
    expect(total).toBe(75);

    // Verifica che ogni dominio abbia almeno il floor della percentuale
    // 26% di 75 = 19.5 → almeno 19
    expect(domainCounts.get('design-solutions-organizational-complexity')).toBeGreaterThanOrEqual(19);
    // 29% di 75 = 21.75 → almeno 21
    expect(domainCounts.get('design-new-solutions')).toBeGreaterThanOrEqual(21);
    // 25% di 75 = 18.75 → almeno 18
    expect(domainCounts.get('continuous-improvement-existing-solutions')).toBeGreaterThanOrEqual(18);
    // 20% di 75 = 15 → esattamente 15
    expect(domainCounts.get('accelerate-workload-migration-modernization')).toBeGreaterThanOrEqual(15);
  });

  it('distribuisce i formati secondo la configurazione (70/20/10)', async () => {
    // SAP-C02: singleAnswer4Options=70%, multiAnswer5Options=20%, multiAnswer6Options=10%
    const result = await handler({ certificationId: 'SAP-C02', bankId: 'test-bank-3' });

    // Conta i formati
    const formatCounts = { 'single-4': 0, 'multi-5': 0, 'multi-6': 0 };
    for (const item of result.plan) {
      formatCounts[item.format] += 1;
    }

    // Verifica che la somma sia 75
    expect(formatCounts['single-4'] + formatCounts['multi-5'] + formatCounts['multi-6']).toBe(75);

    // 70% di 75 = 52.5 → 52 o 53
    expect(formatCounts['single-4']).toBeGreaterThanOrEqual(52);
    expect(formatCounts['single-4']).toBeLessThanOrEqual(53);
    // 20% di 75 = 15
    expect(formatCounts['multi-5']).toBeGreaterThanOrEqual(15);
    expect(formatCounts['multi-5']).toBeLessThanOrEqual(15);
    // 10% di 75 = 7.5 → 7 o 8
    expect(formatCounts['multi-6']).toBeGreaterThanOrEqual(7);
    expect(formatCounts['multi-6']).toBeLessThanOrEqual(8);
  });

  it('assegna i topic quando topicDistribution è presente', async () => {
    // SAP-C02 ha topicDistribution: { 'generative-ai': 34 }
    // 34% di 75 = 25.5, ceil = 26 domande con topic
    const result = await handler({ certificationId: 'SAP-C02', bankId: 'test-bank-4' });

    // Conta gli elementi con topic assegnato
    const withTopic = result.plan.filter((item) => item.topic !== undefined);
    expect(withTopic.length).toBe(26);

    // Verifica che tutti i topic assegnati siano 'generative-ai'
    for (const item of withTopic) {
      expect(item.topic).toBe('generative-ai');
    }
  });

  it('non assegna topic quando topicDistribution non è presente', async () => {
    // DVA-C02 non ha topicDistribution
    const result = await handler({ certificationId: 'DVA-C02', bankId: 'test-bank-5' });

    // Verifica che nessun elemento abbia un topic
    const withTopic = result.plan.filter((item) => item.topic !== undefined);
    expect(withTopic.length).toBe(0);

    // Verifica il totale domande per DVA-C02 (65)
    expect(result.plan.length).toBe(65);
    expect(result.totalQuestions).toBe(65);
  });

  it('lancia un errore per certificazioni sconosciute', async () => {
    await expect(
      handler({ certificationId: 'UNKNOWN-999', bankId: 'test-bank-6' })
    ).rejects.toThrow('Certificazione non trovata: UNKNOWN-999');
  });

  it('ogni elemento del piano ha domainId e format validi', async () => {
    const result = await handler({ certificationId: 'SAA-C03', bankId: 'test-bank-7' });

    const validFormats = ['single-4', 'multi-5', 'multi-6'];
    const validDomains = [
      'design-secure-architectures',
      'design-resilient-architectures',
      'design-high-performing-architectures',
      'design-cost-optimized-architectures',
    ];

    for (const item of result.plan) {
      expect(validFormats).toContain(item.format);
      expect(validDomains).toContain(item.domainId);
    }
  });
});
