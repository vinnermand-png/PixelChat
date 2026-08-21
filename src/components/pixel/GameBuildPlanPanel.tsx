import { useState } from "react";
import { executeCurrentGameBuildTask } from "@/lib/gameBuildPlanner/gameBuildExecution";
import type { GameBuildPlan } from "@/lib/gameBuildPlanner/gameBuildPlan";

interface GameBuildPlanPanelProps {
  plan: GameBuildPlan | null;
  onGenerate: () => void;
  onAdvance: () => void;
}

export default function GameBuildPlanPanel({ plan, onGenerate, onAdvance }: GameBuildPlanPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const tasks = plan?.phases.flatMap((phase) => phase.tasks) ?? [];
  const currentTask = tasks.find((task) => task.id === plan?.currentTaskId);
  const currentPhase = plan?.phases.find((phase) => phase.tasks.some((task) => task.id === currentTask?.id));
  const isComplete = Boolean(plan && tasks.length && tasks.every((task) => task.status === "complete"));
  const isPlayerEntryTask = currentTask?.title === "Define player entry" || currentTask?.title === "Define player spawn";
  const isCentralGameplayAreaTask = currentTask?.title === "Define central gameplay area";
  const isKeyLocationsTask = currentTask?.title === "Define key locations" || currentTask?.title === "Define key social locations";
  const canExecute = Boolean(
    currentTask
      && (
        currentPhase?.id === "world-structure"
        || currentPhase?.id === "terrain"
        || ((currentPhase?.id === "core-play-area" || currentPhase?.id === "social-hub") && isPlayerEntryTask)
        || (currentPhase?.id === "core-play-area" && isCentralGameplayAreaTask)
        || ((currentPhase?.id === "core-play-area" || currentPhase?.id === "social-hub") && isKeyLocationsTask)
      )
      && !isComplete,
  );

  const handleExecute = () => {
    if (!plan || !canExecute || isExecuting) return;
    setIsExecuting(true);
    setExecutionMessage(null);
    setExecutionError(null);
    try {
      const result = executeCurrentGameBuildTask(plan);
      setExecutionMessage(result.summary);
      onAdvance();
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : "Build task execution failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <section className="border-b border-[#a9df5a]/20 bg-[#0b111c] px-4 py-3">
      <div className="mx-auto max-w-[1800px] rounded border border-[#a9df5a]/20 bg-[#0d1713]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a9df5a]">AI Build Plan</p>
            <p className="mt-1 text-xs text-white/60">{plan ? `BUILD PLAN ${plan.version.toUpperCase()} · ${currentTask ? currentTask.title : "PLAN COMPLETE"}` : "Generate the first structured plan from your Discovery, Foundation and active Game DNA."}</p>
          </div>
          <button type="button" onClick={() => setIsOpen((value) => !value)} className="rounded border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white/70 hover:border-[#a9df5a]/50 hover:text-[#a9df5a]">
            {isOpen ? "HIDE ▲" : "VIEW ▼"}
          </button>
        </div>

        {isOpen ? <div className="border-t border-white/5 px-4 py-4">
          {plan ? <>
            <p className="mb-4 text-xs leading-5 text-white/55">{plan.sourceSummary}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {plan.phases.map((phase) => <article key={phase.id} className="rounded border border-white/10 bg-black/10 p-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6ee7d8]">{phase.title}</h3>
                <div className="mt-3 space-y-2">
                  {phase.tasks.map((task) => <div key={task.id} className={`rounded border px-3 py-2 ${task.status === "current" ? "border-[#a9df5a]/50 bg-[#a9df5a]/5" : task.status === "complete" ? "border-[#6ee7d8]/30 bg-[#6ee7d8]/5" : "border-white/5 bg-black/10"}`}>
                    <div className="flex gap-2"><span className={`text-xs ${task.status === "current" ? "text-[#a9df5a]" : task.status === "complete" ? "text-[#6ee7d8]" : "text-white/35"}`}>{task.status === "complete" ? "✓" : task.status === "current" ? "●" : "○"}</span><div><p className="text-xs font-medium text-white/80">{task.title}</p><p className="mt-1 text-[10px] leading-4 text-white/40">{task.description}</p></div></div>
                  </div>)}
                </div>
              </article>)}
            </div>
            {executionMessage ? <p className="mt-4 rounded border border-[#6ee7d8]/25 bg-[#6ee7d8]/5 px-3 py-2 text-[10px] leading-4 text-[#8ff3e6]">✓ {executionMessage}</p> : null}
            {executionError ? <p className="mt-4 rounded border border-red-400/30 bg-red-400/5 px-3 py-2 text-[10px] leading-4 text-red-200">{executionError}</p> : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
              <p className="text-[10px] uppercase tracking-wide text-white/40">{isComplete ? "Build plan complete" : `${currentPhase?.title ?? "BUILD"} · ${currentTask?.title ?? "Ready"}`}</p>
              {canExecute ? <button type="button" onClick={handleExecute} disabled={isExecuting} className="rounded border border-[#a9df5a] bg-[#172319] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#c8f28d] disabled:cursor-wait disabled:opacity-60">{isExecuting ? "BUILDING..." : "BUILD NEXT STEP"}</button> : <button type="button" disabled className="rounded border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-white/30">{isComplete ? "PLAN COMPLETE" : "EXECUTION COMING NEXT"}</button>}
            </div>
          </> : <button type="button" onClick={onGenerate} className="rounded border border-[#a9df5a] bg-[#172319] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#c8f28d] hover:bg-[#20301f]">GENERATE BUILD PLAN</button>}
        </div> : null}
      </div>
    </section>
  );
}