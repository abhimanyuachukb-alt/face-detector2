import React, { useState, useEffect, useRef } from 'react';
import { CameraView } from './components/CameraView';
import { LiveDemoView } from './components/LiveDemoView';
import { BoxesOverlay } from './components/BoxesOverlay';
import { FaceResult } from './types';
import { Camera, CameraOff, AlertCircle, Sparkles, Video } from 'lucide-react';

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean>(true);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [permissionErrorDetail, setPermissionErrorDetail] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState<boolean>(true);
  const [cameraKey, setCameraKey] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [showSettingsInfo, setShowSettingsInfo] = useState<boolean>(false);

  // Interactive Virtual Camera / Photo Upload mode
  const [demoMode, setDemoMode] = useState<boolean>(false);

  // Viewport/container measurement for overlay coordinate translation
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 360,
    height: 480,
  });

  // Check camera permission state on load
  useEffect(() => {
    async function checkInitialPermission() {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (status.state === 'denied') {
            setHasPermission(false);
            setPermissionDenied(true);
          } else if (status.state === 'granted') {
            setHasPermission(true);
            setPermissionDenied(false);
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              setHasPermission(true);
              setPermissionDenied(false);
              setError(null);
              setPermissionErrorDetail(null);
            } else if (status.state === 'denied') {
              setHasPermission(false);
              setPermissionDenied(true);
            }
          };
        }
      } catch (e) {
        console.debug('Permission query not supported on this platform:', e);
      }
    }
    checkInitialPermission();
  }, []);

  // Check available camera devices
  useEffect(() => {
    async function checkDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
        }
      } catch (e) {
        console.debug('enumerateDevices check skipped:', e);
      }
    }
    checkDevices();
  }, []);

  // Update container size dynamically on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Request camera permission explicitly via user click gesture
  const requestPermission = async () => {
    setError(null);
    setPermissionErrorDetail(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
      });
      // Release test stream track so CameraView can bind cleanly
      stream.getTracks().forEach((t) => t.stop());
      setHasPermission(true);
      setPermissionDenied(false);
      setDemoMode(false);
      setCameraOn(true);
      setCameraKey((k) => k + 1);
    } catch (err: unknown) {
      console.warn('Camera permission request denied/blocked:', err);
      setHasPermission(false);
      setPermissionDenied(true);
      setShowSettingsInfo(true);

      if (err instanceof Error) {
        if (/policy|disallowed/i.test(err.message)) {
          setPermissionErrorDetail(
            'Camera policy was just updated. Please reload the browser page (F5 / Cmd+R) to allow the camera prompt, or use the Virtual Camera below.'
          );
        } else if (/not found|requested device not found/i.test(err.message)) {
          setPermissionErrorDetail(
            'No physical webcam was detected on this device. You can use the Virtual Camera below to test face detection.'
          );
        } else {
          setPermissionErrorDetail(
            'Browser suppressed the camera prompt. Click the Camera/Lock icon in your browser address bar to set Camera to "Allow", or refresh the page.'
          );
        }
      }
    }
  };

  const handlePermissionDenied = () => {
    setHasPermission(false);
    setPermissionDenied(true);
    setError(null);
    setResult(null);
  };

  const count = cameraOn && result?.boxes ? result.boxes.length : 0;

  return (
    <div className="min-h-screen bg-[#F4F7FC] flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 font-sans select-none max-w-lg mx-auto w-full">
      {/* Header */}
      <header className="w-full text-center mb-3">
        <h1 className="text-2xl sm:text-[28px] font-bold text-[#0D2B5C] tracking-tight">
          Face Detector
        </h1>
        <p className="text-[15px] font-medium text-[#2F6FED] mt-0.5">
          Real-time face detection
        </p>

        {/* Source Switcher: Physical Webcam vs Virtual Camera / Upload */}
        <div className="mt-2.5 inline-flex items-center p-1 rounded-xl bg-slate-200/80 border border-slate-300/60">
          <button
            type="button"
            onClick={() => {
              setDemoMode(false);
              setCameraOn(true);
              setResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              !demoMode
                ? 'bg-[#0D2B5C] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0D2B5C]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Webcam</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDemoMode(true);
              setCameraOn(true);
              setError(null);
              setResult(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              demoMode
                ? 'bg-[#2F6FED] text-white shadow-xs'
                : 'text-slate-600 hover:text-[#0D2B5C]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Virtual Camera / Upload</span>
          </button>
        </div>
      </header>

      {/* Viewfinder Container */}
      <main
        ref={containerRef}
        className="relative w-full flex-1 min-h-[360px] max-h-[540px] rounded-[24px] bg-[#0D2B5C] overflow-hidden shadow-xl flex items-center justify-center border border-slate-800/10"
      >
        {!hasPermission && !demoMode ? (
          <div className="flex flex-col items-center justify-center text-center p-6 text-white max-w-xs z-20">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
            <p className="text-sm sm:text-base font-medium leading-relaxed text-slate-100 mb-2">
              {permissionDenied
                ? 'Camera permission was denied. Face detection needs the camera to work.'
                : 'Waiting for camera permission…'}
            </p>

            {permissionErrorDetail && (
              <p className="text-xs text-amber-200/95 bg-amber-500/15 border border-amber-400/30 rounded-xl p-2.5 mb-3 leading-relaxed">
                {permissionErrorDetail}
              </p>
            )}

            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={requestPermission}
                className="w-full py-2.5 px-4 bg-[#2F6FED] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Grant permission</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDemoMode(true);
                  setCameraOn(true);
                  setError(null);
                }}
                className="w-full py-2.5 px-4 bg-white/15 hover:bg-white/25 active:scale-[0.98] text-[#4FC3F7] font-semibold rounded-xl text-sm transition-all border border-[#4FC3F7]/40 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Start Virtual Camera</span>
              </button>

              {permissionDenied && (
                <button
                  type="button"
                  onClick={() => setShowSettingsInfo((s) => !s)}
                  className="w-full py-1.5 px-4 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                >
                  {showSettingsInfo ? 'Hide settings help' : 'Open settings help'}
                </button>
              )}

              {showSettingsInfo && (
                <div className="bg-white/10 rounded-xl p-3 text-left text-[11px] text-slate-200 leading-snug border border-white/20 mt-1 space-y-1.5">
                  <p className="font-semibold text-white">How to enable webcam:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Click the <strong>Tune / Lock icon</strong> on the left side of your browser address bar.
                    </li>
                    <li>
                      Toggle <strong>Camera</strong> to <strong>Allow</strong>.
                    </li>
                    <li>
                      Refresh the page and click <strong>Grant permission</strong>.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        ) : error && !demoMode ? (
          <div className="flex flex-col items-center justify-center text-center p-6 text-white max-w-xs z-20">
            <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
            <p className="text-sm leading-relaxed text-slate-100 mb-4">{error}</p>
            <div className="flex flex-col gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCameraKey((k) => k + 1);
                }}
                className="w-full py-2.5 px-4 bg-[#2F6FED] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setDemoMode(true);
                }}
                className="py-2 px-3 text-xs font-semibold text-[#4FC3F7] hover:underline"
              >
                Switch to Virtual Camera
              </button>
            </div>
          </div>
        ) : !cameraOn ? (
          <div className="flex flex-col items-center justify-center text-center p-6 text-white z-20">
            <CameraOff className="w-12 h-12 text-slate-400 mb-3" />
            <p className="text-base font-medium text-slate-200">Camera is stopped.</p>
            <p className="text-xs text-slate-400 mt-1">Press Start Camera below to resume</p>
          </div>
        ) : demoMode ? (
          <LiveDemoView
            onResult={(res) => {
              setResult(res);
              setError(null);
            }}
            onExitDemo={() => {
              setDemoMode(false);
              setResult(null);
              setCameraKey((k) => k + 1);
            }}
          />
        ) : (
          <CameraView
            key={cameraKey}
            onResult={(res) => {
              setResult(res);
              setError(null);
            }}
            onError={(err) => {
              setError(err);
              setResult(null);
            }}
            onPermissionDenied={handlePermissionDenied}
            facingMode={facingMode}
            hasMultipleCameras={hasMultipleCameras}
            onToggleFacingMode={() =>
              setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))
            }
          />
        )}

        {/* Real-time Bounding Boxes Overlay */}
        {cameraOn && result && (
          <BoxesOverlay
            result={result}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        )}
      </main>

      {/* Status Card */}
      <section className="w-full mt-3.5">
        <div className="bg-white rounded-[20px] p-4 text-center shadow-sm border border-slate-100/80">
          <p
            className={`text-[16px] font-semibold transition-colors duration-200 ${
              cameraOn && count > 0 ? 'text-[#2F6FED]' : 'text-[#0D2B5C]'
            }`}
          >
            {!hasPermission && !demoMode
              ? 'Camera permission needed'
              : error && !demoMode
              ? 'Camera error'
              : !cameraOn
              ? 'Camera stopped'
              : count > 0
              ? 'Face detected'
              : 'No face detected'}
          </p>
          <p className="text-[22px] font-bold text-[#0D2B5C] mt-0.5 tracking-tight">
            Faces detected: {count}
          </p>
        </div>
      </section>

      {/* Camera Toggle Button */}
      <div className="w-full mt-3">
        <button
          type="button"
          disabled={!hasPermission && !demoMode}
          onClick={() => {
            setCameraOn((prev) => !prev);
            setResult(null);
            setError(null);
          }}
          className={`w-full h-[52px] rounded-[16px] font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-sm ${
            !hasPermission && !demoMode
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : cameraOn
              ? 'bg-[#2F6FED] hover:bg-[#255ecf] active:scale-[0.99] text-white shadow-blue-500/20'
              : 'bg-[#2F6FED] hover:bg-[#255ecf] active:scale-[0.99] text-white'
          }`}
        >
          {cameraOn ? (
            <>
              <CameraOff className="w-5 h-5" />
              <span>Stop Camera</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              <span>Start Camera</span>
            </>
          )}
        </button>
      </div>

      {/* On-device Privacy Disclaimer */}
      <footer className="w-full mt-2 text-center">
        <p className="text-[12px] text-gray-500 leading-relaxed max-w-sm mx-auto">
          Detects faces on your device only. It does not identify people, and no images are saved or uploaded.
        </p>
      </footer>
    </div>
  );
}
