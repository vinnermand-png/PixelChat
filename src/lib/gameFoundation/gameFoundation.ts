export type GameFoundationStatus =
  | "discovery"
  | "draft"
  | "review"
  | "active";

export type GameDnaVersionStatus =
  | "draft"
  | "review"
  | "active"
  | "archived";

export interface GameIdentity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameBlueprint {
  concept?: string;
  coreExperience?: string;
  coreLoop?: string;
  playerMode?: string;
  systems: string[];
  openQuestions: string[];
}

export interface GameDnaContent {
  creativeAnchor?: string;
  coreIdentity?: string;
  emotionalIdentity?: string;
  worldIdentity?: string;
  visualIdentity?: string;
  assetIdentity?: string;
}

export interface GameDnaVersion extends GameDnaContent {
  id: string;
  version: string;
  status: GameDnaVersionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GameFoundationReadiness {
  blueprint?: number;
  dna?: number;
  knownInformation: string[];
  openQuestions: string[];
}

export interface GameFoundation {
  game: GameIdentity;
  blueprint: GameBlueprint;
  dnaVersions: GameDnaVersion[];
  activeVersionId?: string;
  status: GameFoundationStatus;
  readiness: GameFoundationReadiness;
}

export interface CreateGameFoundationInput {
  game: GameIdentity;
  blueprint?: Partial<GameBlueprint>;
  dnaVersions?: GameDnaVersion[];
  activeVersionId?: string;
  status?: GameFoundationStatus;
  readiness?: Partial<GameFoundationReadiness>;
}

export interface CreateGameDnaVersionInput extends GameDnaContent {
  id: string;
  version: string;
  status?: GameDnaVersionStatus;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeDnaVersions(
  dnaVersions: GameDnaVersion[],
  activeVersionId?: string,
): { dnaVersions: GameDnaVersion[]; activeVersionId?: string } {
  const requestedActive = activeVersionId
    ? dnaVersions.find((version) => version.id === activeVersionId)
    : dnaVersions.find((version) => version.status === "active");

  if (!requestedActive) {
    return {
      dnaVersions: dnaVersions.map((version) => ({ ...version })),
      activeVersionId: undefined,
    };
  }

  return {
    dnaVersions: dnaVersions.map((version) => {
      if (version.id === requestedActive.id) {
        return { ...version, status: "active" };
      }

      return version.status === "active"
        ? { ...version, status: "archived" }
        : { ...version };
    }),
    activeVersionId: requestedActive.id,
  };
}

export function createGameFoundation(
  input: CreateGameFoundationInput,
): GameFoundation {
  const normalizedDna = normalizeDnaVersions(
    input.dnaVersions ?? [],
    input.activeVersionId,
  );

  return {
    game: { ...input.game },
    blueprint: {
      ...input.blueprint,
      systems: input.blueprint?.systems ?? [],
      openQuestions: input.blueprint?.openQuestions ?? [],
    },
    dnaVersions: normalizedDna.dnaVersions,
    activeVersionId: normalizedDna.activeVersionId,
    status: input.status ?? "discovery",
    readiness: {
      blueprint: input.readiness?.blueprint,
      dna: input.readiness?.dna,
      knownInformation: input.readiness?.knownInformation ?? [],
      openQuestions: input.readiness?.openQuestions ?? [],
    },
  };
}

export function createGameDnaVersion(
  input: CreateGameDnaVersionInput,
): GameDnaVersion {
  const timestamp = input.createdAt ?? new Date().toISOString();

  return {
    ...input,
    status: input.status ?? "draft",
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
}

export function getActiveGameDna(
  foundation: GameFoundation,
): GameDnaVersion | undefined {
  if (!foundation.activeVersionId) {
    return undefined;
  }

  return foundation.dnaVersions.find(
    (version) => version.id === foundation.activeVersionId,
  );
}

export function activateGameDnaVersion(
  foundation: GameFoundation,
  versionId: string,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  const targetVersion = foundation.dnaVersions.find(
    (version) => version.id === versionId,
  );

  if (!targetVersion) {
    return foundation;
  }

  return {
    ...foundation,
    dnaVersions: foundation.dnaVersions.map((version) => {
      if (version.id === versionId) {
        return {
          ...version,
          status: "active",
          updatedAt,
        };
      }

      if (version.status === "active") {
        return {
          ...version,
          status: "archived",
          updatedAt,
        };
      }

      return version;
    }),
    activeVersionId: versionId,
  };
}
