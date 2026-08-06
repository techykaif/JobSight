import { describe, it, expect, vi } from 'vitest';
import { runAgyTask } from '../lib/agy/runner.js';
import { IntegrationTestSchema } from '../lib/agy/schema.js';
import * as execaModule from 'execa';

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({
    stdout: JSON.stringify({
      structured_output: {
        status: "success",
        worker: "test",
        message: "test",
        items: []
      }
    }),
    stderr: ''
  })
}));

describe('Runner Permission Flag Tests', () => {
  it('does NOT contain --dangerously-skip-permissions by default', async () => {
    const jsonSchemaDef = { type: "object" };
    await runAgyTask({
      prompt: 'test',
      schema: IntegrationTestSchema,
      jsonSchemaDef
    });

    const execaMock = execaModule.execa as any;
    const callArgs = execaMock.mock.calls[execaMock.mock.calls.length - 1][1];
    expect(callArgs).not.toContain('--dangerously-skip-permissions');
  });

  it('DOES contain --dangerously-skip-permissions when explicitly enabled', async () => {
    const jsonSchemaDef = { type: "object" };
    await runAgyTask({
      prompt: 'test',
      schema: IntegrationTestSchema,
      jsonSchemaDef,
      dangerouslySkipPermissions: true
    });

    const execaMock = execaModule.execa as any;
    const callArgs = execaMock.mock.calls[execaMock.mock.calls.length - 1][1];
    expect(callArgs).toContain('--dangerously-skip-permissions');
  });
});
