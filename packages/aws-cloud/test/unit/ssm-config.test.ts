import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Crea il mock della funzione send prima dell'hoisting di vi.mock
const mockSend = vi.hoisted(() => vi.fn());

// Mock del modulo @aws-sdk/client-ssm
vi.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: vi.fn(() => ({ send: mockSend })),
  GetParameterCommand: vi.fn((input: { Name: string; WithDecryption: boolean }) => input),
}));

import { loadConfig, _resetConfigCache, type AppConfig } from '../../src/utils/ssm-config.js';

describe('loadConfig', () => {
  beforeEach(() => {
    // Resetta la cache prima di ogni test per garantire isolamento
    _resetConfigCache();
    mockSend.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load all config values from SSM', async () => {
    // Simula risposte SSM valide per tutti i parametri
    mockSend
      .mockResolvedValueOnce({ Parameter: { Value: 'anthropic.claude-3-haiku-20240307-v1:0' } })
      .mockResolvedValueOnce({ Parameter: { Value: '45000' } })
      .mockResolvedValueOnce({ Parameter: { Value: '3000' } })
      .mockResolvedValueOnce({ Parameter: { Value: '50' } });

    const config = await loadConfig('dev');

    expect(config).toEqual({
      bedrockModelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      bedrockTimeoutMs: 45000,
      interRequestDelayMs: 3000,
      apiRateLimitRps: 50,
    } satisfies AppConfig);
  });

  it('should use correct SSM parameter paths for the given environment', async () => {
    mockSend.mockResolvedValue({ Parameter: { Value: 'test-value' } });

    await loadConfig('staging');

    // Verifica che i percorsi SSM siano costruiti con l'ambiente corretto
    expect(mockSend).toHaveBeenCalledTimes(4);

    // Verifica che i comandi contengano i percorsi corretti
    const commandArgs = mockSend.mock.calls.map((call) => call[0] as { Name: string });
    const paths = commandArgs.map((cmd) => cmd.Name);

    expect(paths).toContain('/aws-exam-generator/staging/bedrock-model-id');
    expect(paths).toContain('/aws-exam-generator/staging/bedrock-timeout-ms');
    expect(paths).toContain('/aws-exam-generator/staging/inter-request-delay-ms');
    expect(paths).toContain('/aws-exam-generator/staging/api-rate-limit-rps');
  });

  it('should fall back to defaults when SSM calls fail', async () => {
    // Simula errore SSM per tutti i parametri
    mockSend.mockRejectedValue(new Error('ParameterNotFound'));

    const config = await loadConfig('dev');

    expect(config).toEqual({
      bedrockModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      bedrockTimeoutMs: 30000,
      interRequestDelayMs: 2000,
      apiRateLimitRps: 100,
    } satisfies AppConfig);
  });

  it('should fall back to defaults when SSM returns null Value', async () => {
    // Simula risposte SSM senza valore
    mockSend.mockResolvedValue({ Parameter: { Value: undefined } });

    const config = await loadConfig('dev');

    expect(config).toEqual({
      bedrockModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      bedrockTimeoutMs: 30000,
      interRequestDelayMs: 2000,
      apiRateLimitRps: 100,
    } satisfies AppConfig);
  });

  it('should cache the config and not call SSM again on subsequent calls', async () => {
    mockSend.mockResolvedValue({ Parameter: { Value: 'cached-model' } });

    // Prima chiamata: carica da SSM
    const first = await loadConfig('dev');
    // Seconda chiamata: deve restituire la cache
    const second = await loadConfig('dev');

    expect(first).toBe(second); // Stesso riferimento in memoria
    expect(mockSend).toHaveBeenCalledTimes(4); // Solo 4 chiamate (dalla prima invocazione)
  });

  it('should log ERROR when SSM retrieval fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    mockSend.mockRejectedValue(new Error('AccessDenied'));

    await loadConfig('prod');

    // Verifica che l'errore sia stato loggato con il percorso del parametro
    expect(consoleSpy).toHaveBeenCalled();
    const errorCalls = consoleSpy.mock.calls;
    // Almeno una chiamata contiene il percorso SSM
    const hasPathInLog = errorCalls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('/aws-exam-generator/prod/'),
    );
    expect(hasPathInLog).toBe(true);
  });

  it('should handle partial SSM failures with fallback for failed parameters only', async () => {
    // Il primo parametro (model-id) ha successo, gli altri falliscono
    mockSend
      .mockResolvedValueOnce({ Parameter: { Value: 'custom-model-id' } })
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ Parameter: { Value: '200' } });

    const config = await loadConfig('dev');

    expect(config.bedrockModelId).toBe('custom-model-id'); // Da SSM
    expect(config.bedrockTimeoutMs).toBe(30000); // Default (fallback)
    expect(config.interRequestDelayMs).toBe(2000); // Default (fallback)
    expect(config.apiRateLimitRps).toBe(200); // Da SSM
  });

  it('should reset cache when _resetConfigCache is called', async () => {
    mockSend.mockResolvedValue({ Parameter: { Value: 'value-1' } });
    await loadConfig('dev');

    // Resetta la cache
    _resetConfigCache();

    // Configura nuove risposte diverse
    mockSend.mockResolvedValue({ Parameter: { Value: 'value-2' } });
    const config = await loadConfig('dev');

    expect(config.bedrockModelId).toBe('value-2'); // Nuovo valore, non dalla cache
    expect(mockSend).toHaveBeenCalledTimes(8); // 4 + 4 chiamate
  });
});
