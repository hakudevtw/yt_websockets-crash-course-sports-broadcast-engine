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

export type Commentary = {
  id: number;
  matchId: number;
  minute: number;
  sequence: number;
  period: string;
  eventType: string;
  actor: string;
  team: string;
  message: string;
};
