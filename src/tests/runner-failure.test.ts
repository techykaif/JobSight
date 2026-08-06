import { describe, it, expect } from 'vitest';
import { runAgyTask } from '../lib/agy/runner.js';
import { IntegrationTestSchema } from '../lib/agy/schema.js';
import { AgyError, AgyErrorCode } from '../lib/agy/errors.js';

describe('Runner Failure Handling', () => {
  it('should classify timeout correctly', async () => {
    const jsonSchemaDef = {
      type: "object",
      properties: { status: { type: "string" } }
    };
    
    try {
      await runAgyTask({
        prompt: 'Wait for 5 seconds then reply with a JSON object',
        schema: IntegrationTestSchema,
        jsonSchemaDef,
        timeoutMs: 10,
        maxAttempts: 1
      });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error).toBeInstanceOf(AgyError);
      expect(error.code).toBe(AgyErrorCode.AGY_TIMEOUT);
    }
  });

});
