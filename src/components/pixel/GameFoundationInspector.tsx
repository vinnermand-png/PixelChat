import { getActiveGameDna, type GameFoundation } from "@/lib/gameFoundation/gameFoundation";
import { calculateFoundationReadiness } from "@/lib/gameFoundation/gameFoundationApi";

export interface GameFoundationInspectorProps {
  foundation: GameFoundation | null;
  onClose: () => void;
}

function formatStatus(status: string) {
  return status.replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function GameFoundationInspector({ foundation, onClose }: GameFoundationInspectorProps) {
  if (!foundation) {
    return <section className="border-2 border-[#a9df5a] bg-[#132019] p-4 text-[#d7f5a0]"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-sm font-semibold">GAME FOUNDATION</h2><button type="button" onClick={onClose} className="border border-[#6ee7d8] px-2 py-1 text-xs text-[#6ee7d8]">CLOSE</button></div><p className="text-sm">No active game yet.</p></section>;
  }

  const activeDna = getActiveGameDna(foundation);
  const latestDna = foundation.dnaVersions[foundation.dnaVersions.length - 1];
  const readiness = calculateFoundationReadiness(foundation);

  return <section className="max-h-[80vh] overflow-y-auto border-2 border-[#a9df5a] bg-[#132019] p-4 text-[#d7f5a0]"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-sm font-semibold">GAME FOUNDATION</h2><button type="button" onClick={onClose} className="border border-[#6ee7d8] px-2 py-1 text-xs text-[#6ee7d8]">CLOSE</button></div><div className="space-y-4 text-sm">
    <div><p className="mb-1 text-xs uppercase text-[#6ee7d8]">Game</p><p>{foundation.game.name}</p></div>
    <div><p className="mb-1 text-xs uppercase text-[#6ee7d8]">Game Idea</p><p>{foundation.blueprint.concept || "Not defined yet."}</p></div>
    <div><p className="mb-1 text-xs uppercase text-[#6ee7d8]">Foundation Status</p><p>{formatStatus(foundation.status)}</p></div>
    <div><p className="mb-1 text-xs uppercase text-[#6ee7d8]">Game DNA</p>{foundation.dnaVersions.length === 0 ? <p>Game DNA has not been defined yet.</p> : <p>{formatStatus(activeDna?.status ?? latestDna?.status ?? "draft")} • {foundation.dnaVersions.length} version(s)</p>}</div>
    <div><p className="mb-1 text-xs uppercase text-[#6ee7d8]">Active DNA Version</p><p>{activeDna ? `${activeDna.version} (${formatStatus(activeDna.status)})` : "None"}</p></div>
    <div><p className="mb-1 text-xs uppercase text-[#6ee7d8]">Readiness</p><p className="text-base font-semibold text-[#d7f5a0]">{readiness.score}%</p><p className="mt-1 text-xs text-white/60">{readiness.label} • {readiness.completedStages}/{readiness.totalStages} lifecycle/data checks complete</p></div>
  </div></section>;
}
