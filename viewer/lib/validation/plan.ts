import { z } from 'zod';

const coords = z.object({
  lat: z.number(),
  lon: z.number(),
});

export const planRequestSchema = z.object({
  from: coords,
  to: coords,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'expected HH:MM'),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;
