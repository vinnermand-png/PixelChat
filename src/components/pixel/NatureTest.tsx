import { useEffect, useRef } from "react";
import { VIEW_H, VIEW_W } from "./world";
import { drawNatureTest } from "./nature";

export default function NatureTest() {
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
      aria-label="Pixel Chat Nature Test v3.1"
    >
      <div className="w-full max-w-[980px]">
        <div
          className="mb-3 border-2 border-[#a9df5a] bg-[#132019] px-3 py-2 text-[#d7f5a0]"
          style={{ fontFamily: '"Press Start 2P", "Courier New", monospace', fontSize: 10, lineHeight: 1.4 }}
        >
          NATURE TEST v3.1 <span className="text-[#6ee7d8]">// NATURAL DISTRIBUTION</span>
        </div>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="pixelated block w-full"
          style={{ height: "auto", imageRendering: "pixelated" }}
          aria-label="Standalone nature and terrain asset test"
        />
      </div>
    </main>
  );
}
