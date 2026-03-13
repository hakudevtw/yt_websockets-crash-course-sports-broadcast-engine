import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { MatchIdParamSchema } from "../validation/matches";
import { CreateCommentarySchema, ListCommentaryQuerySchema } from "../validation/commentary";
import { db } from "../db/db";
import { commentary } from "../db/schema";

const MAX_LIMIT = 100;

export const commentaryRoutes = Router({ mergeParams: true });

commentaryRoutes.get("/", async (req, res) => {
  const paramsResult = MatchIdParamSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ error: "Invalid match ID.", details: paramsResult.error.issues });
  }

  const queryResult = ListCommentaryQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({ error: "Invalid query.", details: queryResult.error.issues });
  }

  try {
    const limit = Math.min(queryResult.data.limit ?? 100, MAX_LIMIT);
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, paramsResult.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json({ data });
  } catch (e) {
    console.error("Failed to list commentary.", e);
    return res.status(500).json({ error: "Failed to list commentary." });
  }
});

commentaryRoutes.post("/", async (req, res) => {
  const paramsResult = MatchIdParamSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ error: "Invalid match ID.", details: paramsResult.error.issues });
  }

  const bodyResult = CreateCommentarySchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid commentary payload.", details: bodyResult.error.issues });
  }

  try {
    const [result] = await db
      .insert(commentary)
      .values({
        matchId: paramsResult.data.id,
        ...bodyResult.data,
      })
      .returning();

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(paramsResult.data.id, result);
    }

    return res.status(201).json({ commentary: result });
  } catch (e) {
    console.error("Failed to create commentary.", e);
    return res.status(500).json({ error: "Failed to create commentary." });
  }
});
