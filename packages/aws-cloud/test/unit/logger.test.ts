import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, redactSensitiveFields, type StructuredLogEntry } from '../../src/utils/logger.js';

describe('createLogger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function parseLogOutput(spy: ReturnType<typeof vi.spyOn>, callIndex = 0): StructuredLogEntry {
    return JSON.parse(spy.mock.calls[callIndex]![0] as string) as StructuredLogEntry;
  }

  it('should emit INFO level logs via console.log', () => {
    const logger = createLogger('test-function');
    logger.info('test message');

    expect(consoleSpy.log).toHaveBeenCalledOnce();
    const entry = parseLogOutput(consoleSpy.log);
    expect(entry.level).toBe('INFO');
    expect(entry.message).toBe('test message');
    expect(entry.functionName).toBe('test-function');
  });

  it('should emit WARN level logs via console.warn', () => {
    const logger = createLogger('test-function');
    logger.warn('warning message');

    expect(consoleSpy.warn).toHaveBeenCalledOnce();
    const entry = parseLogOutput(consoleSpy.warn);
    expect(entry.level).toBe('WARN');
    expect(entry.message).toBe('warning message');
  });

  it('should emit ERROR level logs via console.error', () => {
    const logger = createLogger('test-function');
    logger.error('error message');

    expect(consoleSpy.error).toHaveBeenCalledOnce();
    const entry = parseLogOutput(consoleSpy.error);
    expect(entry.level).toBe('ERROR');
    expect(entry.message).toBe('error message');
  });

  it('should include valid ISO 8601 timestamp', () => {
    const logger = createLogger('test-function');
    logger.info('test');

    const entry = parseLogOutput(consoleSpy.log);
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it('should default requestId to "unknown"', () => {
    const logger = createLogger('test-function');
    logger.info('test');

    const entry = parseLogOutput(consoleSpy.log);
    expect(entry.requestId).toBe('unknown');
  });

  it('should inject requestId after setRequestId is called', () => {
    const logger = createLogger('test-function');
    logger.setRequestId('req-12345');
    logger.info('test');

    const entry = parseLogOutput(consoleSpy.log);
    expect(entry.requestId).toBe('req-12345');
  });

  it('should propagate the same requestId across all log entries', () => {
    const logger = createLogger('test-function');
    logger.setRequestId('correlation-id-abc');

    logger.info('first');
    logger.warn('second');
    logger.error('third');

    const infoEntry = parseLogOutput(consoleSpy.log);
    const warnEntry = parseLogOutput(consoleSpy.warn);
    const errorEntry = parseLogOutput(consoleSpy.error);

    expect(infoEntry.requestId).toBe('correlation-id-abc');
    expect(warnEntry.requestId).toBe('correlation-id-abc');
    expect(errorEntry.requestId).toBe('correlation-id-abc');
  });

  it('should include metadata in log entry', () => {
    const logger = createLogger('test-function');
    logger.info('test', { operation: 'getBank', bankId: '123' });

    const entry = parseLogOutput(consoleSpy.log);
    expect(entry.metadata).toEqual({ operation: 'getBank', bankId: '123' });
  });

  it('should default metadata to empty object when not provided', () => {
    const logger = createLogger('test-function');
    logger.info('test');

    const entry = parseLogOutput(consoleSpy.log);
    expect(entry.metadata).toEqual({});
  });

  it('should redact sensitive fields in metadata', () => {
    const logger = createLogger('test-function');
    logger.info('login attempt', {
      username: 'user@example.com',
      password: 'secret123',
      token: 'jwt-abc-def',
    });

    const entry = parseLogOutput(consoleSpy.log);
    expect(entry.metadata.username).toBe('user@example.com');
    expect(entry.metadata.password).toBe('[REDACTED]');
    expect(entry.metadata.token).toBe('[REDACTED]');
  });

  it('should output valid JSON string', () => {
    const logger = createLogger('test-function');
    logger.info('test message', { key: 'value' });

    const output = consoleSpy.log.mock.calls[0]![0] as string;
    expect(() => JSON.parse(output)).not.toThrow();
  });
});

describe('redactSensitiveFields', () => {
  it('should redact password fields', () => {
    const result = redactSensitiveFields({ password: 'my-secret' });
    expect(result.password).toBe('[REDACTED]');
  });

  it('should redact token fields', () => {
    const result = redactSensitiveFields({ token: 'abc123' });
    expect(result.token).toBe('[REDACTED]');
  });

  it('should redact secret fields', () => {
    const result = redactSensitiveFields({ secret: 'hidden-value' });
    expect(result.secret).toBe('[REDACTED]');
  });

  it('should redact authorization fields', () => {
    const result = redactSensitiveFields({ authorization: 'Bearer xyz' });
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('should redact accessKey fields', () => {
    const result = redactSensitiveFields({ accessKey: 'AKIA12345' });
    expect(result.accessKey).toBe('[REDACTED]');
  });

  it('should be case-insensitive for key matching', () => {
    const result = redactSensitiveFields({
      PASSWORD: 'val1',
      Token: 'val2',
      SECRET_KEY: 'val3',
      Authorization: 'val4',
      AccessKey: 'val5',
    });
    expect(result.PASSWORD).toBe('[REDACTED]');
    expect(result.Token).toBe('[REDACTED]');
    expect(result.SECRET_KEY).toBe('[REDACTED]');
    expect(result.Authorization).toBe('[REDACTED]');
    expect(result.AccessKey).toBe('[REDACTED]');
  });

  it('should preserve non-sensitive fields', () => {
    const result = redactSensitiveFields({
      username: 'admin',
      operation: 'login',
      password: 'secret',
    });
    expect(result.username).toBe('admin');
    expect(result.operation).toBe('login');
    expect(result.password).toBe('[REDACTED]');
  });

  it('should handle nested objects recursively', () => {
    const result = redactSensitiveFields({
      user: { name: 'test', password: 'hidden' },
    });
    expect(result.user).toEqual({ name: 'test', password: '[REDACTED]' });
  });

  it('should handle arrays with objects', () => {
    const result = redactSensitiveFields({
      items: [{ name: 'a', token: 'secret' }, { name: 'b' }],
    });
    expect(result.items).toEqual([{ name: 'a', token: '[REDACTED]' }, { name: 'b' }]);
  });

  it('should not mutate the original object', () => {
    const original = { password: 'original-value', name: 'test' };
    redactSensitiveFields(original);
    expect(original.password).toBe('original-value');
  });

  it('should handle empty objects', () => {
    const result = redactSensitiveFields({});
    expect(result).toEqual({});
  });
});
