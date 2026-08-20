import React, { useEffect } from "react";
import GameMaker from "./GameMaker";

/**
 * Foundation surfaces are gameplay terrain, not visible editor cells.
 * GameMaker's legacy renderer draws a 1px stroke around every 32x16 cell.
 * That creates seams between filled foundation tiles. While this editor is
 * mounted, suppress only those legacy 1px terrain strokes; selection/hover
 * strokes use 2px and remain visible.
 */
export default function GameMakerPatched() {
  useEffect(() => {
    const proto = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & {
      __pixelChatOriginalStroke?: typeof CanvasRenderingContext2D.prototype.stroke;
    };

    const original = proto.__pixelChatOriginalStroke ?? proto.stroke;
    if (!proto.__pixelChatOriginalStroke) proto.__pixelChatOriginalStroke = original;

    proto.stroke = function patchedStroke(...args: Parameters<typeof original>) {
      if (this.lineWidth === 1) return;
      return original.apply(this, args);
    };

    return () => {
      proto.stroke = original;
    };
  }, []);

  return <GameMaker />;
}
