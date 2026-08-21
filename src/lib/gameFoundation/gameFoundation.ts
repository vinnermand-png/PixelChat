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

export type WorldSizePreset = "small" | "medium" | "large" | "huge" | "custom";

export interface WorldSizeConfig {
  preset: WorldSizePreset;
  width: number;
  height: number;
}

export const WORLD_SIZE_LIMITS = { min: 16, max: 128 } as const;

export const WORLD_SIZE_PRESETS: Record<Exclude<WorldSizePreset, "custom">, { width: number; height: number }> = {
  small: { width: 20, height: 20 },
  medium: { width: 32, height: 32 },
  large: { width: 48, height: 48 },
  huge: { width: 64, height: 64 },
};

export const DEFAULT_WORLD_SIZE_CONFIG: WorldSizeConfig = {
  preset: "medium",
  width: WORLD_SIZE_PRESETS.medium.width,
  height: WORLD_SIZE_PRESETS.medium.height,
};

export function normalizeWorldSizeConfig(input: unknown): WorldSizeConfig {
  if (!input || typeof input !== "object") return { ...DEFAULT_WORLD_SIZE_CONFIG };
  const value = input as Partial<WorldSizeConfig>;
  const preset = value.preset;
  if (!preset || !(preset in WORLD_SIZE_PRESETS) && preset !== "custom") {
    return { ...DEFAULT_WORLD_SIZE_CONFIG };
  }
  if (preset !== "custom") {
    const dimensions = WORLD_SIZE_PRESETS[preset];
    return { preset, width: dimensions.width, height: dimensions.height };
  }
  if (!Number.isInteger(value.width) || !Number.isInteger(value.height)) {
    throw new Error(`Custom world dimensions must be whole numbers between ${WORLD_SIZE_LIMITS.min} and ${WORLD_SIZE_LIMITS.max}.`);
  }
  if (value.width! < WORLD_SIZE_LIMITS.min || value.width! > WORLD_SIZE_LIMITS.max || value.height! < WORLD_SIZE_LIMITS.min || value.height! > WORLD_SIZE_LIMITS.max) {
    throw new Error(`Custom world dimensions must be between ${WORLD_SIZE_LIMITS.min} and ${WORLD_SIZE_LIMITS.max}.`);
  }
  return { preset: "custom", width: value.width!, height: value.height! };
}

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
  worldSize?: WorldSizeConfig;
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

const FOUNDATION_STATUS_TRANSITIONS: Record<
  GameFoundationStatus,
  readonly GameFoundationStatus[]
> = {
  discovery: ["draft"],
  draft: ["review"],
  review: ["draft", "active"],
  active: ["draft", "review", "active"],
};

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

function withFoundationUpdatedAt(
  foundation: GameFoundation,
  updatedAt: string,
): GameFoundation {
  return {
    ...foundation,
    game: {
      ...foundation.game,
      updatedAt,
    },
  };
}

export function createGameFoundation(
  input: CreateGameFoundationInput,
): GameFoundation {
  const normalizedDna = normalizeDnaVersions(
    input.dnaVersions ?? [],
    input.activeVersionId,
  );

  const status = input.status ?? "discovery";

  if (status === "active" && !normalizedDna.activeVersionId) {
    throw new Error(
      "An active Game Foundation requires exactly one active Game DNA version.",
    );
  }

  return {
    game: { ...input.game },
    blueprint: {
      ...input.blueprint,
      systems: input.blueprint?.systems ?? [],
      openQuestions: input.blueprint?.openQuestions ?? [],
      worldSize: normalizeWorldSizeConfig(input.blueprint?.worldSize),
    },
    dnaVersions: normalizedDna.dnaVersions,
    activeVersionId: normalizedDna.activeVersionId,
    status,
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

export function setFoundationStatus(
  foundation: GameFoundation,
  nextStatus: Exclude<GameFoundationStatus, "active">,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  if (foundation.status === nextStatus) {
    return foundation;
  }

  if (!FOUNDATION_STATUS_TRANSITIONS[foundation.status].includes(nextStatus)) {
    throw new Error(
      `Invalid Game Foundation status transition: ${foundation.status} -> ${nextStatus}.`,
    );
  }

  return {
    ...withFoundationUpdatedAt(foundation, updatedAt),
    status: nextStatus,
  };
}

export function moveToDraft(
  foundation: GameFoundation,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  return setFoundationStatus(foundation, "draft", updatedAt);
}

export function moveToReview(
  foundation: GameFoundation,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  return setFoundationStatus(foundation, "review", updatedAt);
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
    throw new Error(`Game DNA version not found: ${versionId}.`);
  }

  if (
    foundation.activeVersionId === versionId &&
    foundation.status === "active" &&
    targetVersion.status === "active"
  ) {
    return foundation;
  }

  const activatedFoundation = {
    ...foundation,
    dnaVersions: foundation.dnaVersions.map((version) => {
      if (version.id === versionId) {
        return {
          ...version,
          status: "active" as const,
          updatedAt,
        };
      }

      if (version.status === "active") {
        return {
          ...version,
          status: "archived" as const,
          updatedAt,
        };
      }

      return version;
    }),
    activeVersionId: versionId,
  };

  return withFoundationUpdatedAt(activatedFoundation, updatedAt);
}

export function activateGameFoundation(
  foundation: GameFoundation,
  versionId: string,
  updatedAt = new Date().toISOString(),
): GameFoundation {
  if (foundation.status === "active") {
    if (foundation.activeVersionId === versionId) {
      return foundation;
    }

    throw new Error(
      "An active Game Foundation must move to review before activating a different Game DNA version.",
    );
  }

  if (foundation.status !== "review") {
    throw new Error(
      `Invalid Game Foundation status transition: ${foundation.status} -> active.`,
    );
  }

  const targetVersion = foundation.dnaVersions.find(
    (version) => version.id === versionId,
  );

  if (!targetVersion) {
    throw new Error(`Game DNA version not found: ${versionId}.`);
  }

  const activatedFoundation = activateGameDnaVersion(
    foundation,
    versionId,
    updatedAt,
  );

  return {
    ...activatedFoundation,
    status: "active",
  };
}
