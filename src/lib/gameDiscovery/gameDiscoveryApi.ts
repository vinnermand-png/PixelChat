import {
  addDiscoveryQuestion as addDiscoveryQuestionToSession,
  answerDiscoveryQuestion,
  createDiscoveryQuestion,
  createDiscoverySession,
  setDiscoveryStatus,
  updateDiscoveryUnderstanding as updateSessionDiscoveryUnderstanding,
  type CreateGameDiscoveryQuestionInput,
  type GameDiscoveryQuestion,
  type GameDiscoverySession,
  type GameDiscoveryStatus,
  type GameDiscoveryUnderstanding,
} from "./gameDiscovery";
import type { GameFoundation } from "../gameFoundation/gameFoundation";

export interface StartDiscoveryInput {
  id: string;
  foundation: GameFoundation;
  createdAt?: string;
  updatedAt?: string;
}

export type AddDiscoveryQuestionInput = CreateGameDiscoveryQuestionInput;

export function startDiscovery(
  input: StartDiscoveryInput,
): GameDiscoverySession {
  return createDiscoverySession({
    id: input.id,
    gameId: input.foundation.game.id,
    originalConcept: input.foundation.blueprint.concept ?? "",
    status: "active",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

export function hasPendingDiscoveryQuestions(
  session: GameDiscoverySession,
): boolean {
  return session.questions.some((question) => question.status === "pending");
}

export function addDiscoveryQuestion(
  session: GameDiscoverySession,
  input: AddDiscoveryQuestionInput,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  const existingQuestion = session.questions.find(
    (question) => question.id === input.id,
  );

  if (existingQuestion) {
    return session;
  }

  const question = createDiscoveryQuestion(input);
  const updatedSession = addDiscoveryQuestionToSession(
    session,
    question,
    updatedAt,
  );

  return hasPendingDiscoveryQuestions(updatedSession)
    ? setDiscoveryStatus(updatedSession, "waiting_for_user", updatedAt)
    : updatedSession;
}

export function submitDiscoveryAnswer(
  session: GameDiscoverySession,
  questionId: string,
  answer: string,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  const updatedSession = answerDiscoveryQuestion(
    session,
    questionId,
    answer,
    updatedAt,
  );

  return hasPendingDiscoveryQuestions(updatedSession)
    ? updatedSession
    : setDiscoveryStatus(updatedSession, "active", updatedAt);
}

export function updateDiscoveryUnderstanding(
  session: GameDiscoverySession,
  understanding: Partial<GameDiscoveryUnderstanding>,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  return updateSessionDiscoveryUnderstanding(session, understanding, updatedAt);
}

export function completeDiscovery(
  session: GameDiscoverySession,
  updatedAt = new Date().toISOString(),
): GameDiscoverySession {
  if (session.status === "complete") {
    return session;
  }

  if (session.status !== "active") {
    throw new Error(
      `Discovery must be active before it can be completed. Current status: ${session.status}.`,
    );
  }

  return setDiscoveryStatus(session, "complete", updatedAt);
}

export function getDiscoveryStatus(
  session: GameDiscoverySession,
): GameDiscoveryStatus {
  return session.status;
}

export function getDiscoveryQuestions(
  session: GameDiscoverySession,
): GameDiscoveryQuestion[] {
  return session.questions.map((question) => ({ ...question }));
}
