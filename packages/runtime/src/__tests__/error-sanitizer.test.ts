import { describe, it, expect } from 'vitest';
import { sanitizeError, ErrorCategory } from '../utils/errorSanitizer.js';

describe('sanitizeError', () => {
  describe('API key / auth errors', () => {
    it('should sanitize OpenAI 401 errors and never leak the API key', () => {
      const error = new Error(
        '401 Incorrect API key provided: "sk-test123". You can find your API key at https://platform.openai.com/account/api-keys.'
      );
      Object.assign(error, { status: 401 });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Auth);
      expect(result.message).not.toContain('sk-test123');
      expect(result.message).not.toContain('platform.openai.com');
      expect(result.message).toContain('Authentication failed');
    });

    it('should classify 403 errors as auth', () => {
      const error = new Error('Forbidden');
      Object.assign(error, { status: 403 });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Auth);
      expect(result.message).not.toBe('Forbidden');
    });

    it('should classify errors with "api key" in message as auth', () => {
      const error = new Error('Invalid API key provided');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Auth);
    });
  });

  describe('rate limit errors', () => {
    it('should classify 429 errors as rate_limit', () => {
      const error = new Error('Rate limit exceeded, please retry after 30s');
      Object.assign(error, { status: 429 });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.RateLimit);
      expect(result.message).not.toContain('30s');
    });

    it('should classify errors with "too many requests" as rate_limit', () => {
      const error = new Error('Too many requests');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.RateLimit);
    });

    it('should classify errors with "quota" as rate_limit', () => {
      const error = new Error('You have exceeded your quota');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.RateLimit);
    });
  });

  describe('timeout errors', () => {
    it('should classify timeout messages', () => {
      const error = new Error('Request timed out');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Timeout);
    });
  });

  describe('network errors', () => {
    it('should classify ECONNREFUSED as network', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:3000');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Network);
      expect(result.message).not.toContain('127.0.0.1');
    });

    it('should classify ENOTFOUND as network', () => {
      const error = new Error('getaddrinfo ENOTFOUND api.example.com');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Network);
    });

    it('should classify "fetch failed" as network', () => {
      const error = new Error('fetch failed');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Network);
    });
  });

  describe('server errors', () => {
    it('should classify 500 status as server', () => {
      const error = new Error('Internal Server Error');
      Object.assign(error, { status: 500 });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Server);
    });

    it('should classify 503 status as server', () => {
      const error = new Error('Service Unavailable');
      Object.assign(error, { statusCode: 503 });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Server);
    });
  });

  describe('validation errors', () => {
    it('should classify 400 as validation', () => {
      const error = new Error('Bad Request');
      Object.assign(error, { status: 400 });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Validation);
    });
  });

  describe('internal Hexos error codes', () => {
    it('should preserve messages for known internal codes', () => {
      const error = new Error('Rate limit exceeded. Retry after 1000ms.');
      Object.assign(error, { code: 'RATE_LIMIT_EXCEEDED' });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.RateLimit);
      expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
      // Internal errors keep their original message
      expect(result.message).toBe('Rate limit exceeded. Retry after 1000ms.');
    });

    it('should preserve messages for CONVERSATION_BUSY', () => {
      const error = new Error('Conversation already has an active stream (limit 1).');
      Object.assign(error, { code: 'CONVERSATION_BUSY' });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.RateLimit);
      expect(result.code).toBe('CONVERSATION_BUSY');
      expect(result.message).toBe('Conversation already has an active stream (limit 1).');
    });

    it('should preserve messages for TOOL_TIMEOUT', () => {
      const error = new Error('Tool execution timed out after 60000ms');
      Object.assign(error, { code: 'TOOL_TIMEOUT' });

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Timeout);
      expect(result.code).toBe('TOOL_TIMEOUT');
    });
  });

  describe('fallback code', () => {
    it('should use fallbackCode when error has no code', () => {
      const error = new Error('Something went wrong');

      const result = sanitizeError(error, 'MCP_TIMEOUT');

      expect(result.code).toBe('MCP_TIMEOUT');
      expect(result.category).toBe(ErrorCategory.Timeout);
    });
  });

  describe('unknown errors', () => {
    it('should classify unrecognized errors as unknown', () => {
      const error = new Error('Something completely unexpected happened');

      const result = sanitizeError(error);

      expect(result.category).toBe(ErrorCategory.Unknown);
      expect(result.message).toBe('Something went wrong. Please try again.');
    });

    it('should handle non-Error values', () => {
      const result = sanitizeError('string error');

      expect(result.category).toBe(ErrorCategory.Unknown);
      expect(result.message).toBe('Something went wrong. Please try again.');
    });

    it('should handle null/undefined', () => {
      const result = sanitizeError(null);

      expect(result.category).toBe(ErrorCategory.Unknown);
    });
  });

  describe('security', () => {
    it('should never include raw error messages from external sources', () => {
      const sensitiveErrors = [
        new Error('401 Incorrect API key provided: "sk-abc123xyz"'),
        new Error('Error connecting to database at postgres://user:pass@host:5432/db'),
        new Error('ECONNREFUSED 192.168.1.100:5432'),
        Object.assign(new Error('Internal: stack trace with file paths'), { status: 500 }),
      ];

      for (const error of sensitiveErrors) {
        const result = sanitizeError(error);
        expect(result.message).not.toContain('sk-abc123');
        expect(result.message).not.toContain('postgres://');
        expect(result.message).not.toContain('192.168.1.100');
        expect(result.message).not.toContain('stack trace');
      }
    });
  });
});
