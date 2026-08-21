import {
  activateGameFoundation,
  createGameDnaVersion,
  createGameFoundation,
  getActiveGameDna,
  moveToDraft,
  moveToReview,
  type CreateGameDnaVersionInput,
  type CreateGameFoundationInput,
  type GameBlueprint,
  type GameDnaVersion,
  type GameFoundation,
} from "./gameFoundation";

export function createFoundation(
  input: CreateGameFoundationInput,
): GameFoundation {
  return createGameFoundation(input);
}

export function updateFoundationBlueprint(
  foundation: GameFoundation,
  blueprint: Partial<GameBlueprint>,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  return {
    ...foundation,
    game: {
      ...foundation.game,
      updatedAt,
    },
    blueprint: {
      ...foundation.blueprint,
      ...blueprint,
      systems: blueprint.systems ?? foundation.blueprint.systems,
      openQuestions:
        blueprint.openQuestions ?? foundation.blueprint.openQuestions,
    },
  };
}

export type CreateFoundationDnaVersionInput = Omit<
  CreateGameDnaVersionInput,
  "status"
>;

export function createFoundationDnaVersion(
  foundation: GameFoundation,
  input: CreateFoundationDnaVersionInput,
): GameFoundation {
  const dnaVersion = createGameDnaVersion({
    ...input,
    status: "active",
  });

  return {
    ...foundation,
    game: {
      ...foundation.game,
      updatedAt: dnaVersion.updatedAt,
    },
    dnaVersions: foundation.dnaVersions.map((version) =>
      version.status === "active"
        ? { ...version, status: "archived" as const, updatedAt: dnaVersion.updatedAt }
        : version,
    ).concat(dnaVersion),
    activeVersionId: dnaVersion.id,
  };
}

export function getFoundationActiveGameDna(
  foundation: GameFoundation,
): GameDnaVersion | undefined {
  return getActiveGameDna(foundation);
}

export function calculateFoundationReadiness(foundation: GameFoundation): {
  score: number;
  completedStages: number;
  totalStages: number;
  label: string;
} {
  const stages = [
    Boolean(foundation.game.id && foundation.game.name.trim()),
    foundation.status !== "discovery",
    foundation.status === "draft" || foundation.status === "review" || foundation.status === "active",
    foundation.dnaVersions.length > 0,
    foundation.status === "active",
    Boolean(getActiveGameDna(foundation)),
  ];
  const completedStages = stages.filter(Boolean).length;
  const totalStages = stages.length;
  const score = Math.round((completedStages / totalStages) * 100);

  return {
    score,
    completedStages,
    totalStages,
    label: score === 100 ? "Ready for build" : score >= 67 ? "Definition in progress" : "Game definition in progress",
  };
}

export function moveFoundationToDraft(
  foundation: GameFoundation,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  return moveToDraft(foundation, updatedAt);
}

export function moveFoundationToReview(
  foundation: GameFoundation,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  return moveToReview(foundation, updatedAt);
}

export function activateFoundationDnaVersion(
  foundation: GameFoundation,
  versionId: string,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  return activateGameFoundation(foundation, versionId, updatedAt);
}
