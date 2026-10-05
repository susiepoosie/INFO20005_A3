// Face detection and alignment.
// Uses MediaPipe Face Landmarker in the browser, so photographs never leave the device.

const VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Every face is warped into the same frame: eyes level, the facial midline at x = FACE_W / 2.
export const FACE_W = 512;
export const FACE_H = 640;
const EYE_Y = 270;
const EYE_DIST = 176;

// Landmark indices from the MediaPipe face mesh.
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const EYE_IMAGE_LEFT = [33, 133, 159, 145];
const EYE_IMAGE_RIGHT = [263, 362, 386, 374];
const MIDLINE = [10, 151, 9, 168, 6, 197, 195, 5, 4, 1, 164, 0, 17, 18, 200, 199, 175, 152];

const MAX_SOURCE_SIDE = 1600;

export class FaceError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
  }
}

let landmarkerPromise = null;

export function loadDetector() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null;
      throw new FaceError(
        'detector',
        'The face detector could not be loaded. Check your internet connection and try again.',
        { cause: err },
      );
    });
  }
  return landmarkerPromise;
}

async function createLandmarker() {
  const { FilesetResolver, FaceLandmarker } = await import(`${VISION_BASE}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${VISION_BASE}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'IMAGE',
    numFaces: 5,
  });
  try {
    return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    return FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

// Decode an uploaded file into a canvas (EXIF orientation applied, large photos scaled down).
export async function loadImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new FaceError('type', 'That file is not an image. Please choose a photograph.');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new FaceError('decode', 'This photograph could not be opened. Try a JPEG or PNG.');
    }
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const mean = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

// Detect the most prominent face in `source` and return it aligned into the standard frame.
export async function extractFace(source) {
  const landmarker = await loadDetector();
  const { faceLandmarks } = landmarker.detect(source);
  if (!faceLandmarks || faceLandmarks.length === 0) {
    throw new FaceError(
      'no-face',
      'No face found. Try a well-lit photograph where the face looks straight at the camera.',
    );
  }

  const faces = faceLandmarks.map((lm) => lm.map((p) => ({ x: p.x * source.width, y: p.y * source.height })));
  const area = (pts) => {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  };
  const pts = faces.reduce((best, f) => (area(f) > area(best) ? f : best));

  const eyeL = mean(EYE_IMAGE_LEFT.map((i) => pts[i]));
  const eyeR = mean(EYE_IMAGE_RIGHT.map((i) => pts[i]));
  const angle = Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);
  const scale = EYE_DIST / Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y);
  const eyeMid = { x: (eyeL.x + eyeR.x) / 2, y: (eyeL.y + eyeR.y) / 2 };

  let matrix = new DOMMatrix()
    .translate(FACE_W / 2, EYE_Y)
    .rotate((-angle * 180) / Math.PI)
    .scale(scale)
    .translate(-eyeMid.x, -eyeMid.y);

  // Centre on the facial midline rather than the eyes, which helps with slightly turned heads.
  const midX = mean(MIDLINE.map((i) => matrix.transformPoint(pts[i]))).x;
  matrix = new DOMMatrix().translate(FACE_W / 2 - midX, 0).multiply(matrix);

  const canvas = document.createElement('canvas');
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(matrix);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const oval = FACE_OVAL.map((i) => matrix.transformPoint(pts[i]));
  const mask = ovalMask(oval);

  // Eye centres in the aligned frame, as seen in the photograph.
  const eyes = {
    left: matrix.transformPoint(eyeL),
    right: matrix.transformPoint(eyeR),
  };

  return {
    canvas,
    mask,
    oval,
    eyes,
    tone: meanTone(canvas, mask),
    faceCount: faces.length,
  };
}

// Soft-edged alpha mask covering the face oval, slightly enlarged.
function ovalMask(oval) {
  const c = document.createElement('canvas');
  c.width = FACE_W;
  c.height = FACE_H;
  const ctx = c.getContext('2d');
  const centre = mean(oval);
  const grow = 1.06;
  const offset = FACE_W * 2;
  // Draw the shape off-canvas and keep only its blurred shadow: a feather that works in every browser.
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = offset;
  ctx.beginPath();
  oval.forEach((p, i) => {
    const x = centre.x + (p.x - centre.x) * grow - offset;
    const y = centre.y + (p.y - centre.y) * grow;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  return c;
}

function meanTone(canvas, mask) {
  const px = canvas.getContext('2d').getImageData(0, 0, FACE_W, FACE_H).data;
  const m = mask.getContext('2d').getImageData(0, 0, FACE_W, FACE_H).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 16) {
    if (m[i + 3] > 200 && px[i + 3] > 0) {
      r += px[i];
      g += px[i + 1];
      b += px[i + 2];
      n++;
    }
  }
  return n ? { r: r / n, g: g / n, b: b / n } : { r: 180, g: 140, b: 110 };
}
