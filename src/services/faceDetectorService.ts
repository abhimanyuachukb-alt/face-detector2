import { FilesetResolver, FaceDetector as MPFaceDetector } from '@mediapipe/tasks-vision';
import { RectBox } from '../types';

let mpDetectorInstance: MPFaceDetector | null = null;
let initPromise: Promise<MPFaceDetector | null> | null = null;
let lastDetectorTimestamp = 0;

// Native FaceDetector interface for experimental Chromium
interface NativeFaceDetector {
  detect(image: ImageBitmapSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
}
declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetector;
  }
}

let nativeDetectorInstance: NativeFaceDetector | null = null;

export async function getFaceDetector(): Promise<MPFaceDetector | null> {
  if (mpDetectorInstance) {
    return mpDetectorInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      const detector = await MPFaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.45,
      });
      mpDetectorInstance = detector;
      return detector;
    } catch (err) {
      console.warn('Could not initialize MediaPipe FaceDetector (GPU fallback to CPU):', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        const detector = await MPFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.45,
        });
        mpDetectorInstance = detector;
        return detector;
      } catch (cpuErr) {
        console.warn('CPU fallback also failed:', cpuErr);
        if (typeof window !== 'undefined' && window.FaceDetector) {
          try {
            nativeDetectorInstance = new window.FaceDetector({ fastMode: true });
          } catch {
            // ignore
          }
        }
        return null;
      }
    }
  })();

  return initPromise;
}

export async function detectFaces(
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  timestampMs: number
): Promise<RectBox[]> {
  try {
    const detector = await getFaceDetector();
    if (detector) {
      // MediaPipe requires strictly monotonically increasing integer/float timestamps in VIDEO mode
      const safeTimestamp = Math.max(Math.floor(timestampMs), lastDetectorTimestamp + 1);
      lastDetectorTimestamp = safeTimestamp;

      const result = detector.detectForVideo(source, safeTimestamp);
      if (result && result.detections) {
        return result.detections.map((d) => {
          const bb = d.boundingBox;
          if (!bb) {
            return { left: 0, top: 0, right: 0, bottom: 0 };
          }
          return {
            left: bb.originX,
            top: bb.originY,
            right: bb.originX + bb.width,
            bottom: bb.originY + bb.height,
          };
        });
      }
    }

    // Native browser FaceDetector fallback
    if (window.FaceDetector) {
      if (!nativeDetectorInstance) {
        nativeDetectorInstance = new window.FaceDetector({ fastMode: true });
      }
      const detections = await nativeDetectorInstance.detect(source);
      return detections.map((d) => ({
        left: d.boundingBox.left,
        top: d.boundingBox.top,
        right: d.boundingBox.right,
        bottom: d.boundingBox.bottom,
      }));
    }
  } catch (e) {
    console.debug('Face detection pass skipped:', e);
  }

  return [];
}
