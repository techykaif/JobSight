import { runAgyTask } from '../lib/agy/runner.js';
import * as schemas from '../lib/agy/probeSchema.js';
import fs from 'fs';
import { zodToJsonSchema } from 'zod-to-json-schema';

async function generateSchemaDef(schema: any) {
  const jsonSchema = zodToJsonSchema(schema, 'Schema');
  return (jsonSchema as any).definitions.Schema;
}

async function runProbes() {
  const results: Record<string, any> = {};

  console.log('--- STARTING MILESTONE 2 CAPABILITY PROBES ---');

  // 1. Web Search Test
  console.log('\n[PROBE] 1. Web Search Test');
  try {
    const jsonDef = await generateSchemaDef(schemas.WebSearchSchema);
    const result = await runAgyTask({
      prompt: "Search the web for the current CEO of Microsoft. Return their name, the URL where you found the information, the source type (e.g., 'search snippet', 'direct page'), and the retrieval status ('SUCCESS' or 'FAILURE').",
      schema: schemas.WebSearchSchema,
      jsonSchemaDef: jsonDef,
      timeoutMs: 60000,
      maxAttempts: 1,
      dangerouslySkipPermissions: true
    });
    results.webSearch = result;
    console.log('Result:', result);
  } catch (e: any) {
    console.error('Failed:', e.message);
    results.webSearch = { error: e.message };
  }

  // 2. Direct URL Test (Static)
  console.log('\n[PROBE] 2. Direct URL Test');
  try {
    const jsonDef = await generateSchemaDef(schemas.DirectUrlSchema);
    const result = await runAgyTask({
      prompt: "Access the URL https://example.com/ and extract the main heading and the exact source URL you read. Status should be SUCCESS or FAILURE.",
      schema: schemas.DirectUrlSchema,
      jsonSchemaDef: jsonDef,
      timeoutMs: 60000,
      maxAttempts: 1,
      dangerouslySkipPermissions: true
    });
    results.directUrl = result;
    console.log('Result:', result);
  } catch (e: any) {
    console.error('Failed:', e.message);
    results.directUrl = { error: e.message };
  }

  // 3. ATS Job Search -> Open -> Extract Test
  console.log('\n[PROBE] 3. ATS Job Search & Extract');
  try {
    const jsonDef = await generateSchemaDef(schemas.ATSJobSchema);
    const result = await runAgyTask({
      prompt: "Search the web for a recent software engineering job posting on Greenhouse (boards.greenhouse.io). Once you find one, open the ACTUAL job page. Extract the company, job title, location, remote status, employment type, experience requirements, salary if stated, application URL, and the source URL. For evidence_type, state whether you got this from a DIRECT_PAGE, SEARCH_SNIPPET, INFERENCE, or UNKNOWN. If a field is not stated, return null.",
      schema: schemas.ATSJobSchema,
      jsonSchemaDef: jsonDef,
      timeoutMs: 120000, // May take longer
      maxAttempts: 1,
      dangerouslySkipPermissions: true
    });
    results.atsJob = result;
    console.log('Result:', result);
  } catch (e: any) {
    console.error('Failed:', e.message);
    results.atsJob = { error: e.message };
  }

  // 4. Hallucination Resistance
  console.log('\n[PROBE] 4. Hallucination Resistance');
  try {
    const jsonDef = await generateSchemaDef(schemas.HallucinationSchema);
    const result = await runAgyTask({
      prompt: "Access the URL https://example.com/ and extract the 'salary', 'experience requirements', and 'remote status'. If they are not present on the page, return null. DO NOT invent information. Return status SUCCESS or FAILURE.",
      schema: schemas.HallucinationSchema,
      jsonSchemaDef: jsonDef,
      timeoutMs: 60000,
      maxAttempts: 1,
      dangerouslySkipPermissions: true
    });
    results.hallucination = result;
    console.log('Result:', result);
  } catch (e: any) {
    console.error('Failed:', e.message);
    results.hallucination = { error: e.message };
  }

  // 5. Invalid URL Test
  console.log('\n[PROBE] 5. Invalid URL Test');
  try {
    const jsonDef = await generateSchemaDef(schemas.InvalidUrlSchema);
    const result = await runAgyTask({
      prompt: "Access the URL https://this-is-a-completely-invalid-domain-123456789.com/ and describe what happened. Return status as 'ACCESS_FAILED' or similar, and put the error in error_message.",
      schema: schemas.InvalidUrlSchema,
      jsonSchemaDef: jsonDef,
      timeoutMs: 60000,
      maxAttempts: 1,
      dangerouslySkipPermissions: true
    });
    results.invalidUrl = result;
    console.log('Result:', result);
  } catch (e: any) {
    console.error('Failed:', e.message);
    results.invalidUrl = { error: e.message };
  }

  fs.writeFileSync('m2-probe-results.json', JSON.stringify(results, null, 2));
  console.log('\n[DONE] Saved results to m2-probe-results.json');
}

runProbes().catch(console.error);
