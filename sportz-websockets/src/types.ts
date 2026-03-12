import type { MatchStatus } from "./validation/matches";

export type Match = {
  id: number;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
  startTime: Date;
  endTime: Date;
  homeScore: number;
  awayScore: number;
  createdAt: Date;
};
