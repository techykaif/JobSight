export async function fetchWithTimeout(url: string | URL | Request, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
