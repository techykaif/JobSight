import { describe, it, expect } from 'vitest';
import { fetchWithTimeout } from '../lib/utils/network.js';

describe('Bounded Execution', () => {
  it('External operation resolves normally before timeout', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      return new Response('ok', { status: 200 });
    };

    const res = await fetchWithTimeout('http://example.com', { timeoutMs: 1000 });
    expect(res.status).toBe(200);

    global.fetch = originalFetch;
  });

  it('External operation exceeds timeout and returns bounded failure', async () => {
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => resolve(new Response('ok')), 2000);
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            const err = new Error('AbortError');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    };

    let error;
    try {
      await fetchWithTimeout('http://example.com', { timeoutMs: 50 });
    } catch (e: any) {
      error = e;
    }
    
    expect(error).toBeDefined();
    expect(error.message).toContain('Request timed out after 50ms');

    global.fetch = originalFetch;
  });
});
