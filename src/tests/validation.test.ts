import { describe, it, expect } from 'vitest';
import { IntegrationTestSchema } from '../lib/agy/schema.js';

describe('Validation Tests', () => {
  it('should accept valid data', () => {
    const validData = {
      status: 'success',
      worker: 'integration-test',
      message: 'Hello',
      items: [{ name: 'test', value: '1' }]
    };
    
    console.log('[VALIDATION_TEST] Supplying valid result');
    const result = IntegrationTestSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject malformed data', () => {
    const invalidData = {
      status: 'failure',
      worker: 'test',
      items: [{ name: 'no value' }]
    };
    
    console.log('[VALIDATION_TEST] Supplying invalid result');
    const result = IntegrationTestSchema.safeParse(invalidData);
    console.log('[VALIDATION_TEST] Correctly rejected');
    
    expect(result.success).toBe(false);
  });
});
