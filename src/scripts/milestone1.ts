import { runAgyTask, checkAgyAvailability } from '../lib/agy/runner.js';
import { IntegrationTestSchema } from '../lib/agy/schema.js';
import process from 'process';

async function main() {
  console.log('[PRECHECK] Checking AGY...');
  const available = await checkAgyAvailability();
  if (available) {
    console.log('[PRECHECK] AGY_AVAILABLE\n');
  } else {
    console.log('[PRECHECK] AGY_UNAVAILABLE');
    process.exit(1);
  }

  console.log('[WORKER] Starting integration-test');
  
  const prompt = "Please respond with a JSON object that has status 'success', worker 'integration-test', message 'Hello from AGY', and a list of items with name and value strings (at least two). Output ONLY valid JSON.";

  try {
    const jsonSchemaDef = {
      type: "object",
      properties: {
        status: { type: "string", enum: ["success"] },
        worker: { type: "string" },
        message: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" }
            },
            required: ["name", "value"]
          }
        }
      },
      required: ["status", "worker", "message", "items"]
    };

    const result = await runAgyTask({
      prompt,
      schema: IntegrationTestSchema,
      jsonSchemaDef,
      timeoutMs: 120000,
      maxAttempts: 2
    });

    console.log('\n[MILESTONE_1] PASS\n');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('\n[MILESTONE_1] FAIL\n');
    console.error(error);
    process.exit(1);
  }
}

main();
