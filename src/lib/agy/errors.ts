export enum AgyErrorCode {
  AGY_UNAVAILABLE = 'AGY_UNAVAILABLE',
  AGY_PROCESS_FAILED = 'AGY_PROCESS_FAILED',
  AGY_TIMEOUT = 'AGY_TIMEOUT',
  AGY_EMPTY_OUTPUT = 'AGY_EMPTY_OUTPUT',
  AGY_INVALID_JSON = 'AGY_INVALID_JSON',
  AGY_SCHEMA_VALIDATION_FAILED = 'AGY_SCHEMA_VALIDATION_FAILED'
}

export class AgyError extends Error {
  constructor(public code: AgyErrorCode, message: string, public details?: any) {
    super(`[${code}] ${message}`);
    this.name = 'AgyError';
  }
}
