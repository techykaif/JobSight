import { execa } from 'execa';
import { AgyError, AgyErrorCode } from './errors.js';
import { z } from 'zod';

export interface RunAgyTaskOptions<T extends z.ZodType> {
  prompt: string;
  schema: T;
  jsonSchemaDef: object;
  timeoutMs?: number;
  maxAttempts?: number;
  dangerouslySkipPermissions?: boolean;
  abortSignal?: AbortSignal;
}

export async function checkAgyAvailability(): Promise<boolean> {
  try {
    await execa('agy', ['--help'], { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

export async function runAgyTask<T extends z.ZodType>(
  options: RunAgyTaskOptions<T>,
  attempt: number = 1
): Promise<z.infer<T>> {
  const maxAttempts = options.maxAttempts ?? 2;
  const timeoutMs = options.timeoutMs ?? 60000; // 60s default
  
  if (attempt === 1) {
    const isAvailable = await checkAgyAvailability();
    if (!isAvailable) {
      throw new AgyError(AgyErrorCode.AGY_UNAVAILABLE, 'AGY executable is not available on the system.');
    }
  }

  console.log(`[WORKER] Attempt ${attempt}/${maxAttempts}`);

  try {
    const args = [
      '-p', options.prompt,
      '--output-format', 'json',
      '--json-schema', JSON.stringify(options.jsonSchemaDef)
    ];

    if (options.dangerouslySkipPermissions) {
      args.splice(4, 0, '--dangerously-skip-permissions');
    }

    const { stdout, stderr } = await execa('agy', args, {
      timeout: timeoutMs,
      ...(options.abortSignal ? { cancelSignal: options.abortSignal } : {})
    });

    console.log(`[WORKER] Process completed`);

    if (!stdout.trim()) {
      throw new AgyError(AgyErrorCode.AGY_EMPTY_OUTPUT, 'AGY returned empty output.');
    }

    let parsed: any;
    try {
      console.log(`[VALIDATION] Parsing JSON`);
      const rawParsed = JSON.parse(stdout);
      parsed = rawParsed.structured_output !== undefined ? rawParsed.structured_output : rawParsed;
    } catch (e: any) {
      throw new AgyError(AgyErrorCode.AGY_INVALID_JSON, 'Failed to parse AGY output as JSON.', { error: e.message, stdout, stderr });
    }

    const validationResult = options.schema.safeParse(parsed);
    if (!validationResult.success) {
      console.log(`[VALIDATION] Schema validation failed`);
      console.error('[VALIDATION] Actual parsed output:', JSON.stringify(parsed, null, 2));
      throw new AgyError(AgyErrorCode.AGY_SCHEMA_VALIDATION_FAILED, 'Zod schema validation failed.', validationResult.error.format());
    }

    console.log(`[VALIDATION] Schema valid`);
    return validationResult.data;

  } catch (error: any) {
    if (error instanceof AgyError) {
      if (attempt < maxAttempts) {
        if (
          error.code === AgyErrorCode.AGY_INVALID_JSON ||
          error.code === AgyErrorCode.AGY_PROCESS_FAILED ||
          error.code === AgyErrorCode.AGY_EMPTY_OUTPUT
        ) {
          console.log(`[WORKER] Retrying due to ${error.code} in 1s...`);
          await new Promise(res => setTimeout(res, 1000 * attempt));
          return runAgyTask(options, attempt + 1);
        }
      }
      throw error;
    }

    if (error.timedOut) {
      throw new AgyError(AgyErrorCode.AGY_TIMEOUT, `AGY execution timed out after ${timeoutMs}ms.`);
    }

    const failureError = new AgyError(AgyErrorCode.AGY_PROCESS_FAILED, 'AGY process failed to execute successfully.', { message: error.message, exitCode: error.exitCode });
    if (attempt < maxAttempts) {
      console.log(`[WORKER] Retrying due to ${failureError.code} in 1s...`);
      await new Promise(res => setTimeout(res, 1000 * attempt));
      return runAgyTask(options, attempt + 1);
    }
    throw failureError;
  }
}

export interface RunAgyUnstructuredOptions {
  prompt: string;
  timeoutMs?: number;
  maxAttempts?: number;
  dangerouslySkipPermissions?: boolean;
  abortSignal?: AbortSignal;
}

export async function runAgyUnstructured(options: RunAgyUnstructuredOptions): Promise<string> {
  const maxAttempts = options.maxAttempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 120000;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    console.log(`[WORKER_UNSTRUCTURED] Attempt ${attempt}/${maxAttempts}`);
    try {
      const args = ['-p', options.prompt];
      if (options.dangerouslySkipPermissions) {
        args.push('--dangerously-skip-permissions');
      }

      const { stdout } = await execa('agy', args, { 
        timeout: timeoutMs,
        ...(options.abortSignal ? { cancelSignal: options.abortSignal } : {})
      });
      console.log(`[WORKER_UNSTRUCTURED] Process completed`);
      return stdout.trim();
    } catch (e: any) {
      if (e.timedOut) {
        console.error(`[WORKER_UNSTRUCTURED] Timeout`);
        if (attempt === maxAttempts) throw new AgyError(AgyErrorCode.AGY_TIMEOUT, 'AGY execution timed out');
      } else {
        console.error(`[WORKER_UNSTRUCTURED] Failure: ${e.message}`);
        if (attempt === maxAttempts) throw new AgyError(AgyErrorCode.AGY_PROCESS_FAILED, `AGY failure: ${e.message}`);
      }
    }
    attempt++;
  }
  throw new AgyError(AgyErrorCode.AGY_PROCESS_FAILED, 'AGY execution failed');
}
