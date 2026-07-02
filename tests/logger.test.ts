import { describe, it, expect } from 'vitest';
import { Logger } from '../src/services/logger.service';

describe('Logger', () => {
  it('should create logger without errors', () => {
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it('should log info without throwing', () => {
    const logger = new Logger();
    expect(() => logger.info('test info')).not.toThrow();
  });

  it('should log warn without throwing', () => {
    const logger = new Logger();
    expect(() => logger.warn('test warn')).not.toThrow();
  });

  it('should log error without throwing', () => {
    const logger = new Logger();
    expect(() => logger.error('test error')).not.toThrow();
  });

  it('should accept metadata', () => {
    const logger = new Logger();
    expect(() => logger.info('with meta', { userId: 123 })).not.toThrow();
  });
});
