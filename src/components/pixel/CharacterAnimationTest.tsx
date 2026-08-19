import { useEffect, useMemo, useState } from "react";

const DIRS = [
  { key: "south", label: "SOUTH" },
  { key: "southwest", label: "SOUTH-WEST" },
  { key: "west", label: "WEST" },
  { key: "northwest", label: "NORTH-WEST" },
  { key: "north", label: "NORTH" },
  { key: "northeast", label: "NORTH-EAST" },
  { key: "east", label: "EAST" },
  { key: "southeast", label: "SOUTH-EAST" },
] as const;

type Dir = (typeof DIRS)[number]["key"];

function framePath(dir: Dir, frame: number) {
  const fileDir = dir.replaceAll("_", "");
  const suffix = fileDir;
  return `/player01/sprites/walk/${fileDir === "south" ? "south" : fileDir === "southwest" ? "south_west" : fileDir === "west" ? "west" : fileDir === "northwest" ? "north_west" : fileDir === "north" ? "north" : fileDir === "northeast" ? "north_east" : fileDir === "east" ? "east" : "south_east"}/player01_walk_${suffix}_${String(frame).padStart(2, "0")}.png`;
}

export default function CharacterAnimationTest() {
  const [direction, setDirection] = useState<Dir>("south");
  const [frame, setFrame] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(10);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrame((value) => (value % 8) + 1);
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [playing, fps]);

  const src = useMemo(() => framePath(direction, frame), [direction, frame]);

  return (
    <main className="min-h-screen bg-[#080d16] p-6 text-[#d7f5a0]" style={{ fontFamily: '"Courier New", monospace' }}>
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-4 border-2 border-[#a9df5a] bg-[#132019] px-4 py-3">
          <div className="text-lg font-bold">PIXELCHAT PLAYER 01 // ANIMATION TEST</div>
          <div className="text-xs text-[#6ee7d8]">ONE DIRECTION AT A TIME // 48×64 // 8 FRAMES</div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="flex min-h-[520px] items-center justify-center border-2 border-[#324159] bg-[#101826] p-8">
            <div className="relative grid place-items-center border-2 border-[#324159] bg-[#0b111c] p-16">
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(#1b2534 1px, transparent 1px), linear-gradient(90deg, #1b2534 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <img src={src} alt="Player 01 animation frame" width={192} height={256} style={{ imageRendering: "pixelated" }} />
                <div className="border-2 border-[#324159] bg-[#0b111c] px-3 py-2 text-xs">
                  {DIRS.find((item) => item.key === direction)?.label} · FRAME {frame}/8
                </div>
              </div>
            </div>
          </div>

          <aside className="border-2 border-[#324159] bg-[#101826] p-4">
            <div className="mb-3 text-xs text-[#6ee7d8]">DIRECTION</div>
            <div className="grid grid-cols-2 gap-2">
              {DIRS.map((item) => (
                <button key={item.key} onClick={() => { setDirection(item.key); setFrame(1); }} className={`border-2 px-2 py-2 text-[10px] ${direction === item.key ? "bg-[#a9df5a] text-[#0b111c]" : "bg-[#0b111c]"}`}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-[#324159] pt-4 text-xs">
              <div className="mb-2 text-[#6ee7d8]">PLAYBACK</div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <button onClick={() => setPlaying((v) => !v)} className="border-2 bg-[#0b111c] px-2 py-2">{playing ? "PAUSE" : "PLAY"}</button>
                <button onClick={() => setFrame((v) => (v % 8) + 1)} className="border-2 bg-[#0b111c] px-2 py-2">NEXT FRAME</button>
              </div>
              <label className="block border-2 border-[#324159] p-2">
                FPS: {fps}
                <input className="mt-2 w-full" type="range" min={4} max={16} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
              </label>
            </div>

            <div className="mt-4 border-t border-[#324159] pt-4 text-[10px] leading-4 text-[#9eb0c8]">
              This test intentionally removes movement, collision and the world map. We are only checking whether the provided 8-frame walk cycle itself looks smooth.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
