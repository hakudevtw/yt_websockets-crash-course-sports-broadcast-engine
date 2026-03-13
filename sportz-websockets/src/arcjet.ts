// Use @arcjet/node if you want to use Arcjet with Node.js
import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/bun";
import type { NextFunction, Response, Request, RequestHandler } from "express";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";

// if (!arcjetKey) {
//   throw new Error("ARCJET_KEY is required");
// }

export const httpArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({
          // Prevent from most common attacks e.g. XSS, SQL injection, etc.
          mode: arcjetMode,
        }),
        detectBot({
          // Prevent from bot attacks, but allow search engines and previews.
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({
          // Prevent from DDoS attacks.
          mode: arcjetMode,
          interval: "10s",
          max: 50, // count of requests in the interval
        }),
      ],
    })
  : null;

export const wsArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({
          // Prevent from most common attacks e.g. XSS, SQL injection, etc.
          mode: arcjetMode,
        }),
        detectBot({
          // Prevent from bot attacks, but allow search engines and previews.
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({
          // Only allow 5 connections per 2 seconds
          mode: arcjetMode,
          interval: "2s",
          max: 5,
        }),
      ],
    })
  : null;

export function securityMiddleware(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!httpArcjet) return next();

    try {
      const decision = await httpArcjet.protect(req as any);

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return res.status(429).json({ error: "Too many requests" });
        }

        return res.status(403).json({ error: "Forbidden" });
      }

      next();
    } catch (error) {
      console.error("Arcjet middleware error:", error);
      return res.status(503).json({ error: "Service unavailable" });
    }
  };
}
