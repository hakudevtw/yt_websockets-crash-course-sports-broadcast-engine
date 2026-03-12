import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema, type MatchStatus } from "../validation/matches";
import { db } from "../db/db";
import { matches } from "../db/schema";
import { getMatchStatus } from "../utils/match-status";
import { desc } from "drizzle-orm";
import { z } from "zod";

const MAX_LIMIT = 100;

export const matchesRouter = Router();

matchesRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.body);
  console.log(parsed);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query.", details: parsed.error.issues });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const data = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);
    res.status(200).json({ data });
  } catch (e) {
    return res.status(500).json({ error: "Failed to list matches." });
  }

  res.status(200).json({ matches: [] });
});

matchesRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload.", details: parsed.error.issues });
  }

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        homeScore: parsed.data.homeScore ?? 0,
        awayScore: parsed.data.awayScore ?? 0,
        status: getMatchStatus(parsed.data.startTime, parsed.data.endTime) as MatchStatus,
      })
      .returning();

    res.status(201).json({ match: event });
  } catch (e) {
    return res.status(500).json({ error: "Failed to create match." });
  }
});
