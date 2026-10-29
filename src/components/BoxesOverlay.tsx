import React, { useEffect, useRef } from 'react';
import { FaceResult } from '../types';

interface BoxesOverlayProps {
  result: FaceResult | null;
  containerWidth: number;
  containerHeight: number;
}

export const BoxesOverlay: React.FC<BoxesOverlayProps> = ({
  result,
  containerWidth,
  containerHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset and clear canvas
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    if (!result || !result.boxes || result.boxes.length === 0 || !result.width || !result.height) {
      return;
    }

    // Mirroring Android PreviewView FILL_CENTER:
    // scale to cover, crop the overflow equally
    const scale = Math.max(containerWidth / result.width, containerHeight / result.height);
    const dx = (containerWidth - result.width * scale) / 2;
    const dy = (containerHeight - result.height * scale) / 2;

    ctx.strokeStyle = '#4FC3F7';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';

    result.boxes.forEach((b) => {
      let left = b.left * scale + dx;
      let right = b.right * scale + dx;

      if (result.mirrored) {
        const l = containerWidth - right;
        right = containerWidth - left;
        left = l;
      }

      const top = b.top * scale + dy;
      const bottom = b.bottom * scale + dy;
      const boxWidth = right - left;
      const boxHeight = bottom - top;

      if (boxWidth > 0 && boxHeight > 0) {
        // Draw the bounding box
        ctx.strokeRect(left, top, boxWidth, boxHeight);

        // Add a subtle corner accent effect for high-definition feel
        const cornerLen = Math.min(16, boxWidth / 4, boxHeight / 4);
        ctx.fillStyle = '#4FC3F7';
        // Top-left
        ctx.fillRect(left - 2, top - 2, cornerLen, 4);
        ctx.fillRect(left - 2, top - 2, 4, cornerLen);
        // Top-right
        ctx.fillRect(right - cornerLen + 2, top - 2, cornerLen, 4);
        ctx.fillRect(right - 2, top - 2, 4, cornerLen);
        // Bottom-left
        ctx.fillRect(left - 2, bottom - 2, cornerLen, 4);
        ctx.fillRect(left - 2, bottom - cornerLen + 2, 4, cornerLen);
        // Bottom-right
        ctx.fillRect(right - cornerLen + 2, bottom - 2, cornerLen, 4);
        ctx.fillRect(right - 2, bottom - cornerLen + 2, 4, cornerLen);
      }
    });
  }, [result, containerWidth, containerHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth}
      height={containerHeight}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
