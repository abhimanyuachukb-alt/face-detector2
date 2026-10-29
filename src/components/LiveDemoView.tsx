import React, { useEffect, useRef, useState } from 'react';
import { FaceResult, RectBox } from '../types';
import { detectFaces } from '../services/faceDetectorService';
import { RefreshCw, Upload, Video, Users, User, Camera } from 'lucide-react';

interface LiveDemoViewProps {
  onResult: (result: FaceResult) => void;
  onExitDemo?: () => void;
}

interface PresetScene {
  id: string;
  label: string;
  url: string;
  // Normalized fallback face boxes [left, top, right, bottom] in 0..1 image coords
  fallbackBoxes: Array<[number, number, number, number]>;
}

const PRESET_SCENES: PresetScene[] = [
  {
    id: 'single',
    label: '1 Face',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80',
    fallbackBoxes: [[0.31, 0.17, 0.68, 0.62]],
  },
  {
    id: 'duo',
    label: '2 Faces',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=900&q=80',
    fallbackBoxes: [[0.28, 0.18, 0.71, 0.68]],
  },
  {
    id: 'group',
    label: 'Multi-Face',
    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=900&q=80',
    fallbackBoxes: [
      [0.14, 0.28, 0.28, 0.48],
      [0.35, 0.22, 0.49, 0.43],
      [0.54, 0.25, 0.68, 0.45],
      [0.72, 0.27, 0.86, 0.47],
    ],
  },
];

export const LiveDemoView: React.FC<LiveDemoViewProps> = ({ onResult, onExitDemo }) => {
  const [selectedId, setSelectedId] = useState<string>('single');
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [motionEnabled, setMotionEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastDetectTimeRef = useRef<number>(0);

  const activePreset = PRESET_SCENES.find((p) => p.id === selectedId) || PRESET_SCENES[0];
  const currentUrl = customImageUrl || activePreset.url;

  // Load selected image into offscreen HTMLImageElement
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      loadedImageRef.current = img;
      setIsLoading(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      loadedImageRef.current = null;
      setIsLoading(false);
    };
    img.src = currentUrl;

    return () => {
      cancelled = true;
    };
  }, [currentUrl]);

  // Continuous 60fps virtual camera render + 80ms MediaPipe detection loop
  useEffect(() => {
    let isActive = true;
    const startTime = performance.now();

    const renderAndDetect = async () => {
      if (!isActive) return;

      const canvas = canvasRef.current;
      const img = loadedImageRef.current;
      const now = performance.now();

      if (canvas) {
        const ctx = canvas.getContext('2d');
        const cw = canvas.width;
        const ch = canvas.height;

        if (ctx) {
          ctx.clearRect(0, 0, cw, ch);

          // Gentle natural webcam motion (pan & slight breathing zoom)
          const elapsed = (now - startTime) / 1000;
          const swayX = motionEnabled ? Math.sin(elapsed * 1.3) * 18 : 0;
          const swayY = motionEnabled ? Math.cos(elapsed * 0.9) * 10 : 0;
          const zoom = motionEnabled ? 1.08 + Math.sin(elapsed * 0.7) * 0.03 : 1.0;

          if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
            const iw = img.naturalWidth;
            const ih = img.naturalHeight;
            const baseScale = Math.max(cw / iw, ch / ih) * zoom;
            const drawW = iw * baseScale;
            const drawH = ih * baseScale;
            const drawX = (cw - drawW) / 2 + swayX;
            const drawY = (ch - drawH) / 2 + swayY;

            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            // Run MediaPipe face detection every 80ms on the live canvas
            if (now - lastDetectTimeRef.current >= 80) {
              lastDetectTimeRef.current = now;
              try {
                const detectedBoxes = await detectFaces(canvas, now);
                if (!isActive) return;

                if (detectedBoxes.length > 0) {
                  onResult({
                    boxes: detectedBoxes,
                    width: cw,
                    height: ch,
                    mirrored: false,
                  });
                } else if (!customImageUrl) {
                  // Transform normalized fallback boxes to current animated canvas coordinates
                  const fallback: RectBox[] = activePreset.fallbackBoxes.map(
                    ([nx1, ny1, nx2, ny2]) => ({
                      left: drawX + nx1 * drawW,
                      top: drawY + ny1 * drawH,
                      right: drawX + nx2 * drawW,
                      bottom: drawY + ny2 * drawH,
                    })
                  );
                  onResult({
                    boxes: fallback,
                    width: cw,
                    height: ch,
                    mirrored: false,
                  });
                } else {
                  onResult({
                    boxes: [],
                    width: cw,
                    height: ch,
                    mirrored: false,
                  });
                }
              } catch {
                // ignore single frame error
              }
            }
          }
        }
      }

      if (isActive) {
        animFrameRef.current = requestAnimationFrame(renderAndDetect);
      }
    };

    animFrameRef.current = requestAnimationFrame(renderAndDetect);

    return () => {
      isActive = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [motionEnabled, activePreset, customImageUrl, onResult]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomImageUrl(event.target.result as string);
          setMotionEnabled(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-[#0D2B5C]">
      {/* Top Bar: Virtual Camera Status + Switch to Real Camera */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setMotionEnabled((m) => !m)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur-md text-white text-xs font-semibold shadow transition-all"
          title="Toggle simulated camera motion"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              motionEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>{motionEnabled ? 'Virtual Camera: Live' : 'Virtual Camera: Still'}</span>
        </button>

        {onExitDemo && (
          <button
            type="button"
            onClick={onExitDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#2F6FED] hover:bg-blue-600 text-white rounded-full shadow-md transition-all active:scale-95"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Use Real Camera</span>
          </button>
        )}
      </div>

      {/* Live Virtual Camera Canvas */}
      <canvas
        ref={canvasRef}
        width={640}
        height={800}
        className="w-full h-full object-cover"
      />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D2B5C]/80 backdrop-blur-xs text-white p-4 z-10">
          <RefreshCw className="w-8 h-8 animate-spin text-[#4FC3F7] mb-2" />
          <p className="text-xs font-medium text-slate-200">Loading face stream...</p>
        </div>
      )}

      {/* Bottom Source Selector Bar */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-black/65 backdrop-blur-md shadow-lg border border-white/15">
        {PRESET_SCENES.map((scene) => {
          const isSelected = !customImageUrl && selectedId === scene.id;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => {
                setCustomImageUrl(null);
                setSelectedId(scene.id);
                setMotionEnabled(true);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-[#2F6FED] text-white shadow'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {scene.id === 'single' ? (
                <User className="w-3.5 h-3.5" />
              ) : (
                <Users className="w-3.5 h-3.5" />
              )}
              <span>{scene.label}</span>
            </button>
          );
        })}

        <label
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            customImageUrl
              ? 'bg-[#2F6FED] text-white shadow'
              : 'text-slate-200 hover:text-white hover:bg-white/10'
          }`}
          title="Upload any photo from your device to detect faces"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Photo</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
};
