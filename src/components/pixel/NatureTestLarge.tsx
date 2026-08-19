import { useEffect, useRef } from "react";
import { NATURE_VIEW_H, NATURE_VIEW_W, drawNatureTest } from "./nature";

export default function NatureTestLarge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    const loop = (now: number) => {
      drawNatureTest(ctx, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-[#0b111c] p-4"
      aria-label="Pixel Chat Nature Test v4 Large Natural World Layout"
    >
      <div className="w-full max-w-[1120px]">
        <div
          className="mb-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2 text-[#d7f5a0]"
          style={{ fontFamily: '\"Press Start 2P\", \"Courier New\", monospace', fontSize: 10, lineHeight: 1.4 }}
        >
          NATURE TEST v4 <span className="text-[#6ee7d8]">// LARGE NATURAL WORLD LAYOUT</span>
        </div>
        <canvas
          ref={canvasRef}
          width={NATURE_VIEW_W}
          height={NATURE_VIEW_H}
          className="pixelated block w-full"
          style={{ height: "auto", imageRendering: "pixelated" }}
          aria-label="Large standalone nature world asset test"
        />
      </div>
    </main>
  );
}
