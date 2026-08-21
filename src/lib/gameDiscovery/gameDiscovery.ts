export type GameDiscoveryStatus =
  | "draft"
  | "active"
  | "waiting_for_user"
  | "complete";

export type GameDiscoveryQuestionCategory =
  | "game_type"
  | "core_experience"
  | "player_activity"
  | "world"
  | "social"
  | "progression"
  | "goals"
  | "visual_direction"
  | "other";

export type GameDiscoveryQuestionImportance =
  | "required"
  | "recommended"
  | "optional";

export type GameDiscoveryQuestionStatus = "pending" | "answered";

export interface GameDiscoveryUnderstanding {
  gameType?: string;
  coreExperience?: string;
  playerActivity?: string;
  worldConcept?: string;
  socialInteraction?: string;
  progression?: string;
  gameplayGoals?: string;
  visualIdentity?: string;
  additionalNotes?: string;
}

export interface GameDiscoveryQuestion {
  id: string;
  category: GameDiscoveryQuestionCategory;
  question: string;
  importance: GameDiscoveryQuestionImportance;
  status: GameDiscoveryQuestionStatus;
  answer?: string;
}

export interface GameDiscoverySession {
  id: string;
  gameId: string;
  status: GameDiscoveryStatus;
  originalConcept: string;
  understanding: GameDiscoveryUnderstanding;
  questions: GameDiscoveryQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameDiscoverySessionInput {
  id: string;
  gameId: string;
  originalConcept: string;
  status?: GameDiscoveryStatus;
  understanding?: GameDiscoveryUnderstanding;
  questions?: GameDiscoveryQuestion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateGameDiscoveryQuestionInput {
  id: string;
  category: GameDiscoveryQuestionCategory;
  question: string;
  importance: GameDiscoveryQuestionImportance;
  status?: GameDiscoveryQuestionStatus;
  answer?: string;
}

export function createDiscoverySession(
  input: CreateGameDiscoverySessionInput,
): GameDiscoverySession {
  const timestamp = input.createdAt ?? new Date().toISOString();

  return {
    id: input.id,
    gameId: input.gameId,
    status: input.status ?? "draft",
    originalConcept: input.originalConcept,
    understanding: { ...input.understanding },
    questions: input.questions?.map((question) => ({ ...question })) ?? [],
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
}

export function createDiscoveryQuestion(
  input: CreateGameDiscoveryQuestionInput,
): GameDiscoveryQuestion {
  const status = input.status ?? (input.answer ? "answered" : "pending");

  return {
    ...input,
    status,
    ...(status === "pending" ? { answer: undefined } : {}),
  };
}

export function addDiscoveryQuestion(
  session: GameDiscoverySession,
  question: GameDiscoveryQuestion,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  return {
    ...session,
    questions: [...session.questions, { ...question }],
    updatedAt,
  };
}

export function answerDiscoveryQuestion(
  session: GameDiscoverySession,
  questionId: string,
  answer: string,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  const question = session.questions.find(
    (currentQuestion) => currentQuestion.id === questionId,
  );

  if (!question) {
    throw new Error(`Game Discovery question not found: ${questionId}.`);
  }

  return {
    ...session,
    questions: session.questions.map((currentQuestion) =>
      currentQuestion.id === questionId
        ? {
            ...currentQuestion,
            answer,
            status: "answered" as const,
          }
        : { ...currentQuestion },
    ),
    updatedAt,
  };
}

export function updateDiscoveryUnderstanding(
  session: GameDiscoverySession,
  understanding: Partial<GameDiscoveryUnderstanding>,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  return {
    ...session,
    understanding: {
      ...session.understanding,
      ...understanding,
    },
    updatedAt,
  };
}

export function setDiscoveryStatus(
  session: GameDiscoverySession,
  status: GameDiscoveryStatus,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  if (session.status === status) {
    return session;
  }

  return {
    ...session,
    status,
    updatedAt,
  };
}
