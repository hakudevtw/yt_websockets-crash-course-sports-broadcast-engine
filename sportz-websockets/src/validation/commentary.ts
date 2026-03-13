import { z } from "zod";

export const ListCommentaryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const CreateCommentarySchema = z.object({
  minute: z.coerce.number().int().nonnegative(),
  sequence: z.coerce.number().int().nonnegative(),
  period: z.string(),
  eventType: z.string(),
  actor: z.string(),
  team: z.string(),
  message: z.string().min(1, "message is required"),
  metadata: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()),
});

export type ListCommentaryQuery = z.infer<typeof ListCommentaryQuerySchema>;
export type CreateCommentary = z.infer<typeof CreateCommentarySchema>;
