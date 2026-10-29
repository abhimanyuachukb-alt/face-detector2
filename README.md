# Face Detector (React Web Application)

Real-time on-device face detection application ported from Android (Jetpack Compose + ML Kit) to React + TypeScript + Vite.

## Features Ported

- **On-Device Face Detection**: Performs client-side, zero-latency face detection with MediaPipe / BlazeFace (the web equivalent of Google's ML Kit Face Detection), with native Shape Detection fallback.
- **Dynamic Bounding Box Overlay**: Accurately scales and positions cyan bounding boxes (`#4FC3F7`) on detected faces, preserving aspect ratio cover fitting (`FILL_CENTER`) and mirroring user-facing camera feeds.
- **Camera Controls**:
  - Start / Stop camera toggling.
  - Multi-camera device switching (Front / Back facing mode).
  - Sample photo preview mode for testing in browser sandboxes without active camera hardware.
- **Status Dashboard**: Real-time status display ("Face detected", "No face detected", "Camera stopped", "Camera permission needed") and detected face counter.
- **Privacy First**: Fully private and runs 100% on-device; no frames or data are saved or uploaded.

## Tech Stack

- React 18 & TypeScript
- Vite
- Tailwind CSS
- MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)
- Lucide React Icons
