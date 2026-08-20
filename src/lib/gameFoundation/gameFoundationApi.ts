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
    status: "draft",
  });

  return {
    ...foundation,
    dnaVersions: [...foundation.dnaVersions, dnaVersion],
  };
}

export function getFoundationActiveGameDna(
  foundation: GameFoundation,
): GameDnaVersion | undefined {
  return getActiveGameDna(foundation);
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
