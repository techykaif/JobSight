import { z } from 'zod';

export const IntegrationTestSchema = z.object({
  status: z.literal('success'),
  worker: z.string(),
  message: z.string(),
  items: z.array(z.object({
    name: z.string(),
    value: z.string()
  }))
});

export type IntegrationTestResult = z.infer<typeof IntegrationTestSchema>;
