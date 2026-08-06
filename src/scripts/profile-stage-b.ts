import crypto from 'crypto';
import { runAgyTask } from '../lib/agy/runner.js';
import { StructuringOutputSchema, EXTERNAL_AGY_STRUCTURING_CONTRACT } from '../lib/jobs/extractionSchema.js';

async function main() {
  let sampleMarkdown = '';
  for (let i = 1; i <= 5; i++) {
    sampleMarkdown += `
Company: TechCorp ${i}
Job Title: Software Engineer ${i}
Primary URL: https://techcorp${i}.com/careers/se
Access Status: Accessible
Observed Facts:
- We are looking for a Software Engineer to join our team in India.
- Remote work is allowed globally.
Requirements:
- ${i} years of experience in JavaScript and Node.js.
Compensation:
- Salary: ${i}00,000 INR - ${i+1}00,000 INR per YEAR
Remote / Location Evidence: Remote work allowed globally
Experience Evidence: ${i} years required
Sources: https://techcorp${i}.com/careers/se
Unknown Fields: none
Notes / Inferences: none
`;
  }

  const structurePrompt = `
YOU ARE NOT RESEARCHING.
Use ONLY the supplied research material below.
Do not add outside knowledge.
Do not guess missing fields. Do not infer salary, remote status, or experience unless explicitly stated in the text.
If unsupported: return null.

CRITICAL REQUIREMENT:
You must extract the job opportunities from the Research Material and populate the "candidates" array in the JSON schema. Ensure you return a valid object containing the "candidates" array. If no jobs are found, return {"candidates": []}.

Research Material:
"""
${sampleMarkdown}
"""
  `;

  console.log("=== PROFILING ===");
  console.log(`Prompt Size (chars): ${structurePrompt.length}`);
  console.log(`Estimated Tokens (~chars/4): ${Math.floor(structurePrompt.length / 4)}`);
  console.log(`Markdown Size (chars): ${sampleMarkdown.length}`);
  console.log(`JSON Schema Size (chars): ${JSON.stringify(EXTERNAL_AGY_STRUCTURING_CONTRACT).length}`);
  
  const startTime = Date.now();
  console.log("Launching AGY...");
  try {
    const structuredData = await runAgyTask({
      prompt: structurePrompt,
      schema: StructuringOutputSchema,
      jsonSchemaDef: EXTERNAL_AGY_STRUCTURING_CONTRACT,
      timeoutMs: 90000,
      maxAttempts: 1
    });
    const endTime = Date.now();
    console.log(`Time spent (ms): ${endTime - startTime}`);
    console.log(`Output candidates: ${structuredData.candidates.length}`);
  } catch (err: any) {
    const endTime = Date.now();
    console.log(`Time spent before error (ms): ${endTime - startTime}`);
    console.error("Error:", err.message);
  }
}

main();
