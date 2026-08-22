import { useState } from "react";
import { fetchAi } from "../../lib/ai/aiClient";
import {
  createFoundation,
  DEFAULT_WORLD_SIZE_CONFIG,
  normalizeWorldSizeConfig,
  WORLD_SIZE_LIMITS,
  WORLD_SIZE_PRESETS,
  type WorldSizeConfig,
  type WorldSizePreset,
} from "../../lib/gameFoundation/gameFoundationApi";
import type { GameFoundation } from "../../lib/gameFoundation/gameFoundation";
import {
  startDiscovery,
  updateDiscoveryUnderstanding,
} from "../../lib/gameDiscovery/gameDiscoveryApi";
import type { GameDiscoverySession, GameDiscoveryUnderstanding } from "../../lib/gameDiscovery/gameDiscovery";

export interface GameCreationDialogProps {
  onCancel: () => void;
  onGameCreated: (result: {
    foundation: GameFoundation;
    discoverySession: GameDiscoverySession;
  }) => void;
}

type GeneratedGameResponse = {
  game: { name: string };
  blueprint: {
    concept: string;
    coreExperience: string;
    coreLoop: string;
    playerMode: string;
    systems: string[];
    openQuestions: string[];
  };
  discovery: GameDiscoveryUnderstanding;
  dna: {
    creativeAnchor: string;
    coreIdentity: string;
    emotionalIdentity: string;
    worldIdentity: string;
    visualIdentity: string;
    assetIdentity: string;
  };
};

export default function GameCreationDialog({
  onCancel,
  onGameCreated,
}: GameCreationDialogProps) {
  const [gameName, setGameName] = useState("");
  const [gameIdea, setGameIdea] = useState("");
  const [worldSizePreset, setWorldSizePreset] = useState<WorldSizePreset>(DEFAULT_WORLD_SIZE_CONFIG.preset);
  const [customWidth, setCustomWidth] = useState(DEFAULT_WORLD_SIZE_CONFIG.width);
  const [customHeight, setCustomHeight] = useState(DEFAULT_WORLD_SIZE_CONFIG.height);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedWorldSize = (): WorldSizeConfig => normalizeWorldSizeConfig({
    preset: worldSizePreset,
    width: customWidth,
    height: customHeight,
  });

  const handleCreate = async () => {
    const name = gameName.trim();
    const concept = gameIdea.trim();

    if (!name) {
      setError("Game name is required.");
      return;
    }

    if (!concept) {
      setError("Game idea is required.");
      return;
    }

    let worldSize: WorldSizeConfig;
    try {
      worldSize = selectedWorldSize();
    } catch (sizeError) {
      setError(sizeError instanceof Error ? sizeError.message : "Invalid world dimensions.");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetchAi("/api/generate-game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameName: name, concept, worldSize }),
      });

      const payload = (await response.json()) as GeneratedGameResponse | { error?: string };
      if (!response.ok || !payload || "error" in payload) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Unable to generate the game with AI.",
        );
      }

      const timestamp = new Date().toISOString();
      const foundation = createFoundation({
        game: {
          id: crypto.randomUUID(),
          name: payload.game.name,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        blueprint: {
          ...payload.blueprint,
          worldSize,
        },
      });

      const discovery = startDiscovery({
        id: crypto.randomUUID(),
        foundation,
      });
      const discoveryWithAiDraft = updateDiscoveryUnderstanding(
        discovery,
        payload.discovery,
      );

      onGameCreated({
        foundation,
        discoverySession: discoveryWithAiDraft,
      });
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to generate the game.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="border-2 border-[#a9df5a] bg-[#132019] p-4 text-[#d7f5a0]"
      style={{
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 10,
        lineHeight: 1.6,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-creation-title"
    >
      <h2 id="game-creation-title" className="mb-4 text-[#6ee7d8]">
        CREATE GAME
      </h2>

      <label className="mb-4 block">
        <span className="mb-2 block">GAME NAME</span>
        <input
          type="text"
          value={gameName}
          onChange={(event) => setGameName(event.target.value)}
          disabled={isGenerating}
          className="w-full border-2 border-[#a9df5a] bg-[#0b111c] px-3 py-2 text-[#d7f5a0] outline-none disabled:opacity-60"
          aria-label="Game name"
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-2 block">GAME IDEA</span>
        <textarea
          value={gameIdea}
          onChange={(event) => setGameIdea(event.target.value)}
          disabled={isGenerating}
          className="min-h-28 w-full border-2 border-[#a9df5a] bg-[#0b111c] px-3 py-2 text-[#d7f5a0] outline-none disabled:opacity-60"
          aria-label="Game idea"
        />
      </label>

      <div className="mb-4 border-2 border-white/10 bg-[#0b111c] p-3">
        <span className="mb-2 block">WORLD SIZE</span>
        <select
          value={worldSizePreset}
          onChange={(event) => setWorldSizePreset(event.target.value as WorldSizePreset)}
          disabled={isGenerating}
          className="w-full border-2 border-[#a9df5a] bg-[#0b111c] px-3 py-2 text-[#d7f5a0] outline-none"
          aria-label="World size"
        >
          {(["small", "medium", "large", "huge", "custom"] as WorldSizePreset[]).map((preset) => (
            <option key={preset} value={preset}>
              {preset === "custom" ? "Custom" : `${preset[0].toUpperCase()}${preset.slice(1)} · ${WORLD_SIZE_PRESETS[preset as Exclude<WorldSizePreset, "custom">]?.width ?? customWidth}×${WORLD_SIZE_PRESETS[preset as Exclude<WorldSizePreset, "custom">]?.height ?? customHeight}`}
            </option>
          ))}
        </select>
        {worldSizePreset === "custom" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label>
              <span className="mb-2 block">WIDTH</span>
              <input
                type="number"
                min={WORLD_SIZE_LIMITS.min}
                max={WORLD_SIZE_LIMITS.max}
                value={customWidth}
                onChange={(event) => setCustomWidth(Number(event.target.value))}
                disabled={isGenerating}
                className="w-full border-2 border-[#a9df5a] bg-[#0b111c] px-3 py-2 text-[#d7f5a0] outline-none"
              />
            </label>
            <label>
              <span className="mb-2 block">HEIGHT</span>
              <input
                type="number"
                min={WORLD_SIZE_LIMITS.min}
                max={WORLD_SIZE_LIMITS.max}
                value={customHeight}
                onChange={(event) => setCustomHeight(Number(event.target.value))}
                disabled={isGenerating}
                className="w-full border-2 border-[#a9df5a] bg-[#0b111c] px-3 py-2 text-[#d7f5a0] outline-none"
              />
            </label>
          </div>
        ) : null}
        <p className="mt-2 text-white/50">World size affects the playable dimensions and how much exploration space the build plan can support.</p>
      </div>

      {error ? (
        <p className="mb-4 text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isGenerating}
          className="border-2 border-[#6ee7d8] bg-transparent px-3 py-2 text-[#6ee7d8] disabled:opacity-60"
        >
          CANCEL
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isGenerating}
          className="border-2 border-[#a9df5a] bg-[#a9df5a] px-3 py-2 text-[#132019] disabled:cursor-wait disabled:opacity-60"
        >
          {isGenerating ? "CREATING WITH AI..." : "CREATE GAME"}
        </button>
      </div>
    </div>
  );
}
