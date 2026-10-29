import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceResult } from '../types';
import { detectFaces } from '../services/faceDetectorService';
import { RefreshCw, SwitchCamera } from 'lucide-react';

interface CameraViewProps {
  onResult: (result: FaceResult) => void;
  onError: (error: string) => void;
  onPermissionDenied?: () => void;
  facingMode: 'user' | 'environment';
  onToggleFacingMode?: () => void;
  hasMultipleCameras?: boolean;
  initialStream?: MediaStream | null;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onResult,
  onError,
  onPermissionDenied,
  facingMode,
  onToggleFacingMode,
  hasMultipleCameras,
  initialStream,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const isDisposedRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const startStream = useCallback(async () => {
    setIsLoading(true);
    isDisposedRef.current = false;

    try {
      let stream: MediaStream | null = null;

      // Reuse already-acquired live stream from user click gesture if active
      if (
        initialStream &&
        initialStream.active &&
        initialStream.getVideoTracks().some((t) => t.readyState === 'live')
      ) {
        stream = initialStream;
      } else {
        // Stop any existing stale stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera is not supported on this browser or context.');
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch (firstErr: unknown) {
          // If it's a constraint issue rather than permission denial, fallback to basic { video: true }
          const isPermErr =
            (firstErr instanceof DOMException &&
              (firstErr.name === 'NotAllowedError' || firstErr.name === 'SecurityError')) ||
            (firstErr instanceof Error && /permission|denied|not allowed/i.test(firstErr.message));
          if (isPermErr) {
            throw firstErr;
          }
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
          });
        }
      }

      if (isDisposedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsLoading(false);
      }
    } catch (err: unknown) {
      const isPermissionDenied =
        (err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'SecurityError')) ||
        (err instanceof Error && /permission|denied|not allowed|policy/i.test(err.message));

      if (isPermissionDenied) {
        if (onPermissionDenied) {
          onPermissionDenied();
        } else {
          onError('Camera permission was denied. Face detection needs the camera to work.');
        }
      } else {
        onError('Could not start the camera. It may be in use by another app.');
      }
      setIsLoading(false);
    }
  }, [facingMode, initialStream, onError, onPermissionDenied]);

  // Detection loop
  useEffect(() => {
    isDisposedRef.current = false;
    let isActive = true;

    const processFrame = async () => {
      if (!isActive || isDisposedRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused && !video.ended) {
        const now = performance.now();
        // 80ms throttle matching original Android ImageAnalysis interval
        if (now - lastTimeRef.current >= 80) {
          lastTimeRef.current = now;
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          if (videoWidth > 0 && videoHeight > 0) {
            try {
              const boxes = await detectFaces(video, now);
              if (isActive && !isDisposedRef.current) {
                onResult({
                  boxes,
                  width: videoWidth,
                  height: videoHeight,
                  mirrored: facingMode === 'user',
                });
              }
            } catch {
              // ignore transient frame error
            }
          }
        }
      }

      if (isActive && !isDisposedRef.current) {
        animFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    startStream().then(() => {
      animFrameRef.current = requestAnimationFrame(processFrame);
    });

    return () => {
      isActive = false;
      isDisposedRef.current = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [startStream, onResult, facingMode]);

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-[#0D2B5C]">
      {/* Video element with FILL_CENTER cover scaling */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
      />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[#4FC3F7] mb-3" />
          <p className="text-sm font-medium text-slate-200">Starting camera preview...</p>
        </div>
      )}

      {/* Switch Camera Button (if multiple cameras available) */}
      {hasMultipleCameras && onToggleFacingMode && !isLoading && (
        <button
          type="button"
          onClick={onToggleFacingMode}
          aria-label="Switch camera"
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/40 hover:bg-black/60 active:scale-95 text-white backdrop-blur-md transition-all shadow-md"
          title={`Switch to ${facingMode === 'user' ? 'back' : 'front'} camera`}
        >
          <SwitchCamera className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
};
