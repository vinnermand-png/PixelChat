import type { WorldSizeConfig } from "@/lib/gameFoundation/gameFoundation";

export type GameBuildTaskStatus = "pending" | "current" | "complete";

export interface GameBuildTask {
  id: string;
  title: string;
  description: string;
  status: GameBuildTaskStatus;
}

export interface GameBuildPhase {
  id: string;
  title: string;
  tasks: GameBuildTask[];
}

export interface GameBuildPlan {
  id: string;
  version: "v1";
  gameId: string;
  gameName: string;
  sourceSummary: string;
  worldSize?: WorldSizeConfig;
  phases: GameBuildPhase[];
  currentTaskId?: string;
  createdAt: string;
  updatedAt: string;
}
