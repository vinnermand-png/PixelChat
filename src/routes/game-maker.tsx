import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import GameCreationDialog from "@/components/pixel/GameCreationDialog";
import GameDiscoveryPanel from "@/components/pixel/GameDiscoveryPanel";
import GameFoundationInspector from "@/components/pixel/GameFoundationInspector";
import GameMakerV2 from "@/components/pixel/GameMakerV2";
import {
  addDiscoveryQuestion,
  completeDiscovery,
  startDiscovery,
  submitDiscoveryAnswer,
  updateDiscoveryUnderstanding,
} from "@/lib/gameDiscovery/gameDiscoveryApi";
import type {
  GameDiscoveryQuestionCategory,
  GameDiscoverySession,
  GameDiscoveryUnderstanding,
} from "@/lib/gameDiscovery/gameDiscovery";
import {
  createFoundationDnaVersion,
  moveFoundationToDraft,
  moveFoundationToReview,
  updateFoundationBlueprint,
} from "@/lib/gameFoundation/gameFoundationApi";
import type { GameFoundation } from "@/lib/gameFoundation/gameFoundation";

const DISCOVERY_CATEGORY_TO_UNDERSTANDING_FIELD = {
  game_type: "gameType",
  core_experience: "coreExperience",
  player_activity: "playerActivity",
  world: "worldConcept",
  social: "socialInteraction",
  progression: "progression",
  goals: "gameplayGoals",
} as const satisfies Partial<
  Record<
    GameDiscoveryQuestionCategory,
    keyof Omit<GameDiscoveryUnderstanding, "additionalNotes">
  >
>;

const DIRECT_DISCOVERY_CATEGORY_LABELS: Record<
  Exclude<GameDiscoveryQuestionCategory, "visual_direction">,
  string
> = {
  game_type: "Game Type",
  core_experience: "Core Experience",
  player_activity: "Player Activity",
  world: "World Concept",
  social: "Social Interaction",
  progression: "Progression",
  goals: "Gameplay Goals",
  other: "Additional Notes",
};

type DiscoveryUnderstandingField =
  (typeof DISCOVERY_CATEGORY_TO_UNDERSTANDING_FIELD)[keyof typeof DISCOVERY_CATEGORY_TO_UNDERSTANDING_FIELD];

function normalizeDiscoveryCategory(
  category: GameDiscoveryQuestionCategory | string,
): GameDiscoveryQuestionCategory | undefined {
  const normalized = category
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "game_type": return "game_type";
    case "core_experience": return "core_experience";
    case "player_activity": return "player_activity";
    case "world":
    case "world_concept": return "world";
    case "social":
    case "social_interaction": return "social";
    case "progression": return "progression";
    case "goals":
    case "gameplay_goals": return "goals";
    case "visual_direction": return "visual_direction";
    case "other":
    case "additional_notes": return "other";
    default: return undefined;
  }
}

function joinDiscoveryAnswers(session: GameDiscoverySession, category: GameDiscoveryQuestionCategory): string | undefined {
  const answers = session.questions
    .filter((question) => normalizeDiscoveryCategory(question.category) === category && question.status === "answered" && question.answer?.trim())
    .map((question) => question.answer!.trim());
  return answers.length > 0 ? answers.join("\n") : undefined;
}

function buildDiscoveryUnderstanding(session: GameDiscoverySession): Partial<GameDiscoveryUnderstanding> {
  const understanding: Partial<GameDiscoveryUnderstanding> = {};
  for (const [category, field] of Object.entries(DISCOVERY_CATEGORY_TO_UNDERSTANDING_FIELD) as [GameDiscoveryQuestionCategory, DiscoveryUnderstandingField][]) {
    const answer = joinDiscoveryAnswers(session, category);
    if (answer) understanding[field] = answer;
  }
  const notes = [
    joinDiscoveryAnswers(session, "visual_direction") ? `Visual Direction: ${joinDiscoveryAnswers(session, "visual_direction")}` : undefined,
    joinDiscoveryAnswers(session, "other") ? `Additional Notes: ${joinDiscoveryAnswers(session, "other")}` : undefined,
  ].filter((note): note is string => Boolean(note));
  if (notes.length > 0) understanding.additionalNotes = notes.join("\n\n");
  return understanding;
}

function joinDefined(values: Array<string | undefined>): string | undefined {
  const defined = values.filter((value): value is string => Boolean(value?.trim()));
  return defined.length > 0 ? defined.join("\n\n") : undefined;
}

function buildInitialGameDna(foundation: GameFoundation, session: GameDiscoverySession) {
  const understanding = session.understanding;
  const visualDirection = joinDiscoveryAnswers(session, "visual_direction");
  return {
    id: crypto.randomUUID(),
    version: "v1.0",
    creativeAnchor: foundation.blueprint.concept ?? session.originalConcept,
    coreIdentity: joinDefined([understanding.gameType, understanding.coreExperience, foundation.blueprint.coreExperience]),
    emotionalIdentity: joinDefined([understanding.gameplayGoals, foundation.blueprint.coreLoop]),
    worldIdentity: understanding.worldConcept,
    visualIdentity: visualDirection,
    assetIdentity: joinDefined([understanding.playerActivity, understanding.socialInteraction, understanding.progression]),
  };
}

function upsertDirectDiscoveryAnswer(
  session: GameDiscoverySession,
  category: Exclude<GameDiscoveryQuestionCategory, "visual_direction">,
  answer: string,
): GameDiscoverySession {
  const existingQuestion = session.questions.find(
    (question) => normalizeDiscoveryCategory(question.category) === category,
  );
  const trimmedAnswer = answer.trim();

  if (!existingQuestion && !trimmedAnswer) return session;

  if (existingQuestion) {
    return submitDiscoveryAnswer(session, existingQuestion.id, answer);
  }

  const sessionWithQuestion = addDiscoveryQuestion(session, {
    id: crypto.randomUUID(),
    category,
    question: DIRECT_DISCOVERY_CATEGORY_LABELS[category],
    importance: "required",
  });

  return submitDiscoveryAnswer(
    sessionWithQuestion,
    sessionWithQuestion.questions.at(-1)!.id,
    answer,
  );
}

function GameMakerRoute() {
  const [isCreateGameOpen, setIsCreateGameOpen] = useState(false);
  const [isFoundationInspectorOpen, setIsFoundationInspectorOpen] = useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [activeFoundation, setActiveFoundation] = useState<GameFoundation | null>(null);
  const [discoverySession, setDiscoverySession] = useState<GameDiscoverySession | null>(null);

  const handleStartDiscovery = () => {
    if (!activeFoundation) return;
    if (discoverySession) {
      setIsDiscoveryOpen(true);
      return;
    }
    const session = startDiscovery({ id: crypto.randomUUID(), foundation: activeFoundation });
    setDiscoverySession(session);
    setIsDiscoveryOpen(true);
  };

  const handleCompleteDiscovery = () => {
    if (!discoverySession || !activeFoundation) return;
    if (discoverySession.questions.some((question) => question.status === "pending")) return;

    const understanding = buildDiscoveryUnderstanding(discoverySession);
    const sessionWithUnderstanding = updateDiscoveryUnderstanding(discoverySession, understanding);
    const completedSession = completeDiscovery(sessionWithUnderstanding);
    const updatedFoundation = updateFoundationBlueprint(activeFoundation, {
      concept: sessionWithUnderstanding.originalConcept,
      coreExperience: sessionWithUnderstanding.understanding.coreExperience,
      coreLoop: sessionWithUnderstanding.understanding.gameplayGoals,
      playerMode: sessionWithUnderstanding.understanding.playerActivity,
    });

    setDiscoverySession(completedSession);
    setActiveFoundation(updatedFoundation.status === "discovery" ? moveFoundationToDraft(updatedFoundation) : updatedFoundation);
    setIsDiscoveryOpen(false);
  };

  const handleGenerateGameDna = () => {
    if (!activeFoundation || !discoverySession) return;
    if (discoverySession.status !== "complete" || activeFoundation.status !== "draft" || activeFoundation.dnaVersions.length > 0) return;
    const foundationWithDna = createFoundationDnaVersion(activeFoundation, buildInitialGameDna(activeFoundation, discoverySession));
    setActiveFoundation(moveFoundationToReview(foundationWithDna));
  };

  const isDiscoveryComplete = discoverySession?.status === "complete";
  const latestDna = activeFoundation?.dnaVersions.at(-1);
  const canGenerateGameDna = Boolean(isDiscoveryComplete && activeFoundation?.status === "draft" && activeFoundation.dnaVersions.length === 0);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0b111c] px-4 py-3 text-white">
        <div className="text-sm font-semibold">{activeFoundation ? `Game: ${activeFoundation.game.name}` : "No Game Selected"}</div>
        <div className="flex flex-wrap items-center gap-2">
          {isDiscoveryComplete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#a9df5a]">{latestDna ? "GAME DNA GENERATED · FOUNDATION READY FOR REVIEW" : "DISCOVERY COMPLETE · FOUNDATION READY FOR GAME DNA"}</span>
              <button type="button" onClick={() => setIsFoundationInspectorOpen(true)} className="rounded border border-[#a9df5a] px-3 py-2 text-xs font-semibold text-[#a9df5a]">REVIEW FOUNDATION</button>
              {canGenerateGameDna ? <button type="button" onClick={handleGenerateGameDna} className="rounded border border-[#fbbf24] bg-[#3a2b0b] px-3 py-2 text-xs font-semibold text-[#fbbf24]">GENERATE GAME DNA</button> : null}
            </div>
          ) : null}
          <button type="button" onClick={handleStartDiscovery} disabled={!activeFoundation} className="rounded border border-[#c084fc] px-3 py-2 text-xs font-semibold text-[#c084fc] disabled:cursor-not-allowed disabled:opacity-40">{discoverySession ? "OPEN DISCOVERY" : "START DISCOVERY"}</button>
          <button type="button" onClick={() => setIsFoundationInspectorOpen(true)} className="rounded border border-[#6ee7d8] px-3 py-2 text-xs font-semibold text-[#6ee7d8]">GAME FOUNDATION</button>
          <button type="button" onClick={() => setIsCreateGameOpen(true)} className="rounded border border-[#a9df5a] px-3 py-2 text-xs font-semibold text-[#a9df5a]">CREATE GAME</button>
        </div>
      </div>

      {latestDna ? (
        <section className="border-b border-[#fbbf24]/30 bg-[#151109] px-4 py-3 text-[#f8edc2]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xs font-semibold">GAME DNA · {latestDna.version}</h2><span className="text-[10px] uppercase tracking-wide text-[#fbbf24]">{latestDna.status}</span></div>
          <div className="grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-3">
            <p><span className="text-[#fbbf24]">Creative Anchor:</span> {latestDna.creativeAnchor || "Not defined yet."}</p>
            <p><span className="text-[#fbbf24]">Core Identity:</span> {latestDna.coreIdentity || "Not defined yet."}</p>
            <p><span className="text-[#fbbf24]">Emotional Identity:</span> {latestDna.emotionalIdentity || "Not defined yet."}</p>
            <p><span className="text-[#fbbf24]">World Identity:</span> {latestDna.worldIdentity || "Not defined yet."}</p>
            <p><span className="text-[#fbbf24]">Visual Identity:</span> {latestDna.visualIdentity || "Not defined yet."}</p>
            <p><span className="text-[#fbbf24]">Asset Identity:</span> {latestDna.assetIdentity || "Not defined yet."}</p>
          </div>
        </section>
      ) : null}

      <GameMakerV2 />

      {isCreateGameOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><GameCreationDialog onCancel={() => setIsCreateGameOpen(false)} onGameCreated={(foundation) => { setActiveFoundation(foundation); setDiscoverySession(null); setIsDiscoveryOpen(false); setIsCreateGameOpen(false); }} /></div> : null}
      {isFoundationInspectorOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><GameFoundationInspector foundation={activeFoundation} onClose={() => setIsFoundationInspectorOpen(false)} /></div> : null}
      {isDiscoveryOpen && activeFoundation && discoverySession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <GameDiscoveryPanel
            foundation={activeFoundation}
            session={discoverySession}
            onUpdateCategoryAnswer={(category, answer) => {
              if (category === "visual_direction") return;
              setDiscoverySession((current) => current ? upsertDirectDiscoveryAnswer(current, category, answer) : current);
            }}
            onComplete={handleCompleteDiscovery}
            onClose={() => setIsDiscoveryOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/game-maker")({
  head: () => ({
    meta: [
      { title: "PixelChat Game Maker V2" },
      { name: "description", content: "PixelChat isometric world editor V2." },
    ],
  }),
  component: GameMakerRoute,
});
