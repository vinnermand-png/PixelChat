import { useState } from "react";
import type { GameBuildPlan } from "@/lib/gameBuildPlanner/gameBuildPlan";
import { executeCurrentGameBuildTask } from "@/lib/gameBuildPlanner/gameBuildExecution";

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

  const handleExecute = async () => {
    if (!plan || !currentTask) return;
    setIsExecuting(true); setExecutionError(null); setExecutionMessage(null);
    try {
      const result = executeCurrentGameBuildTask(plan);
      onAdvance();
      setExecutionMessage(result.summary);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : "The build task could not be applied to the GameMaker.");
    } finally { setIsExecuting(false); }
  };

  return <section className="border-b border-[#a9df5a]/20 bg-[#0b111c] px-4 py-3"><div className="mx-auto max-w-[1800px] rounded border border-[#a9df5a]/20 bg-[#0d1713]"><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a9df5a]">AI Build Plan</p><p className="mt-1 text-xs text-white/60">{plan ? `BUILD PLAN ${plan.version.toUpperCase()} · ${currentTask ? currentTask.title : "PLAN COMPLETE"}` : "Generate the first structured plan from your Discovery, Foundation and active Game DNA."}</p></div><button type="button" onClick={() => setIsOpen((value) => !value)} className="rounded border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white/70 hover:border-[#a9df5a]/50 hover:text-[#a9df5a]">{isOpen ? "HIDE ▲" : "VIEW ▼"}</button></div>
    {isOpen ? <div className="border-t border-white/5 px-4 py-4">{plan ? <><p className="mb-4 text-xs leading-5 text-white/55">{plan.sourceSummary}</p>{currentTask && !isComplete ? <div className="mb-4 rounded border border-[#a9df5a]/30 bg-[#a9df5a]/5 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a9df5a]">Current phase · {currentPhase?.title ?? "BUILD"}</p><h3 className="mt-2 text-sm font-semibold text-white">{currentTask.title}</h3><p className="mt-1 text-xs leading-5 text-white/55">{currentTask.description}</p><button type="button" onClick={handleExecute} disabled={isExecuting} className="mt-3 rounded border border-[#a9df5a] bg-[#172319] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#c8f28d] disabled:cursor-wait disabled:opacity-50">{isExecuting ? "BUILDING..." : "BUILD NEXT STEP"}</button>{executionMessage ? <p className="mt-3 text-[10px] leading-4 text-[#6ee7d8]">✓ {executionMessage}</p> : null}{executionError ? <p className="mt-3 text-[10px] leading-4 text-red-300">{executionError}</p> : null}</div> : null}<div className="grid gap-3 lg:grid-cols-2">{plan.phases.map((phase) => <article key={phase.id} className="rounded border border-white/10 bg-black/10 p-3"><h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6ee7d8]">{phase.title}</h3><div className="mt-3 space-y-2">{phase.tasks.map((task) => <div key={task.id} className={`rounded border px-3 py-2 ${task.status === "current" ? "border-[#a9df5a]/50 bg-[#a9df5a]/5" : task.status === "complete" ? "border-[#6ee7d8]/30 bg-[#6ee7d8]/5" : "border-white/5 bg-black/10"}`}><div className="flex gap-2"><span className={`text-xs ${task.status === "current" ? "text-[#a9df5a]" : task.status === "complete" ? "text-[#6ee7d8]" : "text-white/35"}`}>{task.status === "complete" ? "✓" : task.status === "current" ? "●" : "○"}</span><div><p className="text-xs font-medium text-white/80">{task.title}</p><p className="mt-1 text-[10px] leading-4 text-white/40">{task.description}</p></div></div></div>)}</div></article>)}</div><div className="mt-4 border-t border-white/5 pt-3"><p className="text-[10px] uppercase tracking-wide text-white/40">{isComplete ? "Build plan complete" : "A task advances only after its concrete world action succeeds."}</p></div></> : <button type="button" onClick={onGenerate} className="rounded border border-[#a9df5a] bg-[#172319] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#c8f28d] hover:bg-[#20301f]">GENERATE BUILD PLAN</button>}</div> : null}</div></section>;
}
