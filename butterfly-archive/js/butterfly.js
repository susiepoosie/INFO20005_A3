// Composes a black-and-white, stippled swallowtail specimen from two aligned faces (see faces.js).
//   left wing  ← left half of the mother's face
//   right wing ← right half of the user's face
//   body       ← the two remaining halves, cross-faded on top of each other
// "Left" and "right" are as seen in the photograph, matching the wings as seen on the display.
//
// Everything is first drawn as a greyscale "tone" image, then turned into ink dots on paper.

import { FACE_W, FACE_H } from './faces.js';

export const SPECIMEN_W = 1000;
export const SPECIMEN_H = 900;
const CX = SPECIMEN_W / 2;
const HALF = FACE_W / 2;

const INK = [24, 22, 26];
const PAPER = [251, 251, 249];

// ---- Geometry ----------------------------------------------------------------
// Right-hand wings as cubic segments, where x is the distance from the body's centre line.
// The left wings are the same shapes mirrored.

const FOREWING = [
  [16, 250],
  [[70, 160], [240, 70], [430, 52]],
  [[452, 50], [462, 72], [452, 92]],
  [[430, 190], [400, 290], [380, 372]],
  [[260, 380], [120, 350], [18, 320]],
];
const HINDWING = [
  [18, 315],
  [[140, 330], [300, 360], [372, 392]],
  [[410, 430], [400, 520], [350, 580]],
  [[322, 612], [300, 630], [284, 650]],
  [[300, 720], [318, 790], [306, 806]],
  [[296, 818], [276, 812], [268, 796]],
  [[256, 740], [248, 700], [236, 668]],
  [[180, 680], [90, 640], [50, 560]],
  [[28, 500], [18, 420], [18, 315]],
];
// Segments along the outer edge, where the dark band and its pale spots go.
const FORE_MARGIN = [2, 3];
const HIND_MARGIN = [2, 3];
const HIND_TAIL = [4, 5, 6];
const FORE_CENTRE = [230, 230];
const HIND_CENTRE = [200, 500];

// Where each half-face sits on the wing (local coordinates) and which rows of the aligned
// face it uses: an eye lands on the forewing, the mouth on the hindwing.
const WING_FACE = { src: { y: 60, h: 580 }, dst: { x: 6, y: -53, w: 400, h: 754 } };

function segmentsToPath(segments, path = new Path2D()) {
  const [start, ...curves] = segments;
  path.moveTo(...start);
  for (const [c1, c2, end] of curves) path.bezierCurveTo(...c1, ...c2, ...end);
  path.closePath();
  return path;
}

const segmentStart = (segments, i) => (i === 1 ? segments[0] : segments[i - 1][2]);

function openPath(segments, indices, path = new Path2D()) {
  path.moveTo(...segmentStart(segments, indices[0]));
  for (const i of indices) {
    const [c1, c2, end] = segments[i];
    path.bezierCurveTo(...c1, ...c2, ...end);
  }
  return path;
}

// Evenly spaced points along segments, each with a unit normal pointing into the wing.
function samplePoints(segments, indices, count, centre) {
  const pts = [];
  for (const i of indices) {
    const p0 = segmentStart(segments, i);
    const [c1, c2, p3] = segments[i];
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count;
      const u = 1 - t;
      const at = (j) => u * u * u * p0[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p3[j];
      const d = (j) => 3 * u * u * (c1[j] - p0[j]) + 6 * u * t * (c2[j] - c1[j]) + 3 * t * t * (p3[j] - c2[j]);
      const x = at(0);
      const y = at(1);
      const len = Math.hypot(d(0), d(1)) || 1;
      let nx = -d(1) / len;
      let ny = d(0) / len;
      if (nx * (centre[0] - x) + ny * (centre[1] - y) < 0) {
        nx = -nx;
        ny = -ny;
      }
      pts.push({ x, y, nx, ny });
    }
  }
  return pts;
}

const FORE_PATH = segmentsToPath(FOREWING);
const HIND_PATH = segmentsToPath(HINDWING);

function bodyPath() {
  const p = new Path2D();
  p.moveTo(CX, 228);
  p.bezierCurveTo(CX + 62, 228, CX + 90, 280, CX + 88, 350);
  p.bezierCurveTo(CX + 86, 420, CX + 70, 470, CX + 56, 520);
  p.bezierCurveTo(CX + 44, 580, CX + 22, 650, CX, 684);
  p.bezierCurveTo(CX - 22, 650, CX - 44, 580, CX - 56, 520);
  p.bezierCurveTo(CX - 70, 470, CX - 86, 420, CX - 88, 350);
  p.bezierCurveTo(CX - 90, 280, CX - 62, 228, CX, 228);
  p.closePath();
  return p;
}

function antennae(ctx) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.5;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(CX + dir * 30, 246);
    ctx.quadraticCurveTo(CX + dir * 66, 170, CX + dir * 118, 104);
    ctx.stroke();
  }
}

// ---- Canvas helpers ----------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const grey = (v) => `rgb(${v | 0}, ${v | 0}, ${v | 0})`;

// ---- Faces as tone -----------------------------------------------------------
// A face becomes a pale engraving: skin goes to paper white, features stay dark,
// and the edges fade out through the soft face-oval mask.

function toneFace(face) {
  const c = makeCanvas(FACE_W, FACE_H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(face.canvas, 0, 0);
  const img = ctx.getImageData(0, 0, FACE_W, FACE_H);
  const px = img.data;
  const mask = face.mask.getContext('2d').getImageData(0, 0, FACE_W, FACE_H).data;

  const lum = new Float32Array(FACE_W * FACE_H);
  const inside = [];
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    lum[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (mask[i + 3] > 200 && (j & 3) === 0) inside.push(lum[j]);
  }
  inside.sort((a, b) => a - b);
  const pct = (p) => inside[Math.min(inside.length - 1, Math.floor(p * inside.length))] ?? 128;
  const black = pct(0.02);
  const white = Math.max(black + 20, pct(0.7));

  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const t = Math.min(1, Math.max(0, (lum[j] - black) / (white - black)));
    const tone = 255 * Math.pow(t, 1.35);
    const a = mask[i + 3] / 255;
    px[i] = px[i + 1] = px[i + 2] = 255 - (255 - tone) * a;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// One half of a toned face, flipped if needed so the facial midline is at x = 0.
// side: 'left' | 'right' (as seen in the photograph).
function halfMidlineFirst(toned, side) {
  const c = makeCanvas(HALF, FACE_H);
  const ctx = c.getContext('2d');
  if (side === 'left') {
    ctx.translate(HALF, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(toned, 0, 0, HALF, FACE_H, 0, 0, HALF, FACE_H);
  } else {
    ctx.drawImage(toned, HALF, 0, HALF, FACE_H, 0, 0, HALF, FACE_H);
  }
  return c;
}

// The halves left over from the wings (the user's left, the mother's right), laid on top of
// each other at half strength. Returned with the midline at x = 0, like halfMidlineFirst.
function crossFadedHalf(motherToned, selfToned) {
  const c = makeCanvas(HALF, FACE_H);
  const ctx = c.getContext('2d');
  ctx.drawImage(halfMidlineFirst(selfToned, 'left'), 0, 0);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(halfMidlineFirst(motherToned, 'right'), 0, 0);
  return c;
}

// ---- Drawing the tone image --------------------------------------------------

function drawWingTone(ctx, half) {
  const path = new Path2D();
  path.addPath(FORE_PATH);
  path.addPath(HIND_PATH);

  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, CX, SPECIMEN_H);

  const { src, dst } = WING_FACE;
  ctx.drawImage(half, 0, src.y, HALF, src.h, dst.x, dst.y, dst.w, dst.h);

  // Soft grey dusting at the wing base.
  ctx.globalCompositeOperation = 'multiply';
  const base = ctx.createRadialGradient(0, 300, 0, 0, 300, 170);
  base.addColorStop(0, grey(150));
  base.addColorStop(1, grey(255));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, CX, SPECIMEN_H);
  ctx.globalCompositeOperation = 'source-over';

  drawForewingPattern(ctx);
  drawHindwingPattern(ctx);
  ctx.restore();
}

function drawForewingPattern(ctx) {
  ctx.save();
  ctx.clip(FORE_PATH);
  // Dark outer band, deepest at the apex.
  ctx.strokeStyle = grey(0);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 150;
  ctx.stroke(openPath(FOREWING, FORE_MARGIN));
  ctx.lineWidth = 18;
  ctx.stroke(openPath(FOREWING, [1]));

  ctx.fillStyle = grey(255);
  // A row of pale oval cells inside the band.
  for (const p of samplePoints(FOREWING, [3], 6, FORE_CENTRE)) {
    ctx.save();
    ctx.translate(p.x + p.nx * 42, p.y + p.ny * 42);
    ctx.rotate(Math.atan2(p.ny, p.nx));
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Comb-like pale notches along the very edge.
  ctx.strokeStyle = grey(255);
  ctx.lineWidth = 9;
  ctx.lineCap = 'butt';
  for (const p of samplePoints(FOREWING, [3], 11, FORE_CENTRE)) {
    ctx.beginPath();
    ctx.moveTo(p.x - p.nx * 4, p.y - p.ny * 4);
    ctx.lineTo(p.x + p.nx * 18, p.y + p.ny * 18);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHindwingPattern(ctx) {
  ctx.save();
  ctx.clip(HIND_PATH);
  ctx.strokeStyle = grey(0);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 120;
  ctx.stroke(openPath(HINDWING, HIND_MARGIN));
  ctx.lineWidth = 80;
  ctx.stroke(openPath(HINDWING, HIND_TAIL));
  ctx.lineWidth = 50;
  ctx.stroke(openPath(HINDWING, [7]));

  ctx.fillStyle = grey(255);
  // Chain of pale cells inside the band.
  for (const p of samplePoints(HINDWING, HIND_MARGIN, 4, HIND_CENTRE)) {
    ctx.save();
    ctx.translate(p.x + p.nx * 34, p.y + p.ny * 34);
    ctx.rotate(Math.atan2(p.ny, p.nx));
    ctx.fillRect(-10, -12, 20, 24);
    ctx.restore();
  }
  // Pale crescents at the scalloped edge.
  ctx.strokeStyle = grey(255);
  ctx.lineWidth = 5;
  for (const p of samplePoints(HINDWING, HIND_MARGIN, 3, HIND_CENTRE)) {
    const a = Math.atan2(p.ny, p.nx);
    ctx.beginPath();
    ctx.arc(p.x + p.nx * 2, p.y + p.ny * 2, 14, a - 1.1, a + 1.1);
    ctx.stroke();
  }
  // A pale streak down the tail.
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(278, 690);
  ctx.quadraticCurveTo(286, 750, 288, 790);
  ctx.stroke();
  ctx.restore();
}

function drawBodyTone(ctx, half) {
  const path = bodyPath();
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = grey(200);
  ctx.fillRect(CX - 100, 200, 200, 500);

  // Soften the cut edges of the half face so no hard line shows on the body.
  const faded = makeCanvas(HALF, FACE_H);
  const fctx = faded.getContext('2d');
  fctx.fillStyle = '#fff';
  fctx.fillRect(0, 0, HALF, FACE_H);
  const soft = makeCanvas(HALF, FACE_H);
  const sctx = soft.getContext('2d');
  sctx.drawImage(half, 0, 0);
  sctx.globalCompositeOperation = 'destination-in';
  const g = sctx.createLinearGradient(0, 0, HALF, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.25, '#000');
  g.addColorStop(0.8, '#000');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, HALF, FACE_H);
  fctx.drawImage(soft, 0, 0);

  // The cross-faded half face, placed so its single eye sits on the centre line.
  const sx = 0.8;
  const sy = 0.8;
  const eyeFromMidline = 88;
  const eyeY = 345;
  ctx.globalCompositeOperation = 'multiply';
  ctx.save();
  ctx.translate(CX + eyeFromMidline * sx, eyeY - 270 * sy);
  ctx.scale(-sx, sy);
  // Twice, so the features stand out against the body's grey.
  ctx.drawImage(faded, 0, 0);
  ctx.drawImage(faded, 0, 0);
  ctx.restore();

  // Lighter in the middle, darker at the rim, as on a rounded body.
  ctx.globalCompositeOperation = 'screen';
  const light = ctx.createRadialGradient(CX, 380, 10, CX, 390, 100);
  light.addColorStop(0, grey(60));
  light.addColorStop(1, grey(0));
  ctx.fillStyle = light;
  ctx.fillRect(CX - 100, 200, 200, 500);
  ctx.globalCompositeOperation = 'multiply';
  const rim = ctx.createRadialGradient(CX, 390, 60, CX, 420, 270);
  rim.addColorStop(0, grey(255));
  rim.addColorStop(1, grey(60));
  ctx.fillStyle = rim;
  ctx.fillRect(CX - 100, 200, 200, 500);
  ctx.restore();
}

// ---- Stippling ---------------------------------------------------------------

let noiseField = null;

// A threshold field mixing fine and slightly clumped noise, so dots cluster like printed grain.
function thresholds(w, h) {
  if (noiseField && noiseField.length === w * h) return noiseField;
  const coarse = makeCanvas(Math.ceil(w / 2), Math.ceil(h / 2));
  const cctx = coarse.getContext('2d');
  const cimg = cctx.createImageData(coarse.width, coarse.height);
  for (let i = 0; i < cimg.data.length; i += 4) {
    cimg.data[i] = Math.random() * 255;
    cimg.data[i + 3] = 255;
  }
  cctx.putImageData(cimg, 0, 0);
  const up = makeCanvas(w, h);
  const uctx = up.getContext('2d', { willReadFrequently: true });
  uctx.drawImage(coarse, 0, 0, w, h);
  const smooth = uctx.getImageData(0, 0, w, h).data;
  noiseField = new Float32Array(w * h);
  for (let j = 0; j < w * h; j++) {
    const v = 0.55 * (smooth[j * 4] / 255) + 0.45 * Math.random();
    // Stretch back towards an even spread after mixing.
    noiseField[j] = Math.min(1, Math.max(0, (v - 0.5) * 1.45 + 0.5));
  }
  return noiseField;
}

function stipple(tone, silhouette) {
  const w = tone.width;
  const h = tone.height;
  const t = tone.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const s = silhouette.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const field = thresholds(w, h);
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const px = img.data;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const alpha = s[i + 3];
    if (alpha === 0) continue;
    const darkness = 1 - t[i] / 255;
    const c = darkness > 0.97 || darkness > field[j] ? INK : PAPER;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = alpha;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// ---- Public API --------------------------------------------------------------

export function renderSpecimen(mother, self) {
  const motherToned = toneFace(mother);
  const selfToned = toneFace(self);

  const tone = makeCanvas(SPECIMEN_W, SPECIMEN_H);
  const ctx = tone.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SPECIMEN_W, SPECIMEN_H);

  // Left wing: drawn mirrored, with the half pre-flipped so the face keeps its orientation.
  ctx.save();
  ctx.translate(CX, 0);
  ctx.scale(-1, 1);
  drawWingTone(ctx, halfMidlineFirst(motherToned, 'left'));
  ctx.restore();

  ctx.save();
  ctx.translate(CX, 0);
  drawWingTone(ctx, halfMidlineFirst(selfToned, 'right'));
  ctx.restore();

  drawBodyTone(ctx, crossFadedHalf(motherToned, selfToned));
  ctx.strokeStyle = grey(0);
  antennae(ctx);

  // Silhouette: wherever there is wing, body or antenna, there is paper.
  const silhouette = makeCanvas(SPECIMEN_W, SPECIMEN_H);
  const sctx = silhouette.getContext('2d', { willReadFrequently: true });
  sctx.fillStyle = '#000';
  sctx.strokeStyle = '#000';
  for (const dir of [-1, 1]) {
    sctx.save();
    sctx.translate(CX, 0);
    sctx.scale(dir, 1);
    sctx.fill(FORE_PATH);
    sctx.fill(HIND_PATH);
    sctx.lineWidth = 2;
    sctx.stroke(FORE_PATH);
    sctx.stroke(HIND_PATH);
    sctx.restore();
  }
  sctx.fill(bodyPath());
  antennae(sctx);

  return stipple(tone, silhouette);
}

// A preview of how a face will be divided, for the upload steps.
// role: 'mother' (left half → left wing) or 'self' (right half → right wing).
export function renderSplitPreview(face, role) {
  const c = makeCanvas(FACE_W, FACE_H);
  const ctx = c.getContext('2d');
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(face.canvas, 0, 0);
  ctx.filter = 'none';
  const wingSide = role === 'mother' ? 0 : HALF;
  const bodySide = role === 'mother' ? HALF : 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(bodySide, 0, HALF, FACE_H);
  ctx.fillStyle = '#111';
  ctx.fillRect(HALF - 1.5, 0, 3, FACE_H);
  ctx.font = '500 22px Jost, "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  const tag = (text, x) => {
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - w / 2, FACE_H - 58, w, 36);
    ctx.fillStyle = '#111';
    ctx.fillText(text, x, FACE_H - 32);
  };
  tag(role === 'mother' ? 'LEFT WING' : 'RIGHT WING', wingSide + HALF / 2);
  tag('BODY', bodySide + HALF / 2);
  return c;
}
