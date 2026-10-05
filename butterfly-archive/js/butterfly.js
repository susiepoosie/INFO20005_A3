// Composes a butterfly specimen from two aligned faces (see faces.js).
//   left wing  ← left half of the mother's face
//   right wing ← right half of the user's face
//   body       ← the two remaining halves merged into one face
// "Left" and "right" are as seen in the photograph, matching the wings as seen on the board.

import { FACE_W, FACE_H } from './faces.js';

export const SPECIMEN_W = 900;
export const SPECIMEN_H = 700;
const CX = SPECIMEN_W / 2;
const HALF = FACE_W / 2;

// Wing outlines for the right-hand side as cubic segments, in coordinates where x is the
// distance from the body's centre line. The left wing is drawn mirrored.
const FOREWING = [
  [14, 215],
  [[70, 120], [220, 40], [380, 38]],
  [[420, 38], [432, 70], [418, 100]],
  [[395, 175], [352, 262], [300, 318]],
  [[220, 332], [110, 322], [16, 300]],
];
const HINDWING = [
  [16, 300],
  [[130, 300], [272, 318], [334, 366]],
  [[380, 406], [364, 482], [324, 532]],
  [[288, 582], [222, 628], [160, 624]],
  [[98, 618], [48, 562], [30, 482]],
  [[20, 422], [14, 360], [16, 300]],
];
// Segments that form the outer margin, used to place the marginal spots.
const FORE_MARGIN = [2, 3];
const HIND_MARGIN = [2, 3];

// Discal cells and veins, as [from, to] lines.
const FORE_CELL = [[22, 250], [[110, 196], [195, 172]], [[214, 248]], [[120, 262], [22, 262]]];
const HIND_CELL = [[24, 318], [[120, 330], [190, 380]], [[170, 440]], [[90, 410], [24, 330]]];
const VEINS = [
  [[60, 228], [150, 66]],
  [[195, 172], [272, 44]],
  [[198, 182], [362, 40]],
  [[203, 198], [412, 88]],
  [[207, 214], [404, 146]],
  [[211, 232], [372, 212]],
  [[214, 248], [334, 278]],
  [[168, 257], [292, 318]],
  [[40, 262], [222, 326]],
  [[110, 326], [322, 370]],
  [[190, 380], [362, 452]],
  [[186, 398], [334, 524]],
  [[178, 420], [272, 592]],
  [[170, 440], [190, 622]],
  [[132, 428], [112, 606]],
  [[60, 360], [44, 520]],
];

// Where each half-face is laid over the wing (local coordinates), and which rows of the
// aligned face to use, so that an eye lands on the forewing and the mouth on the hindwing.
const WING_FACE_RECT = { x: 4, y: 30, w: 410, h: 600 };
const WING_FACE_SRC = { y: 70, h: 570 };

function segmentsToPath(segments, path = new Path2D()) {
  const [start, ...curves] = segments;
  path.moveTo(...start);
  for (const [c1, c2, end] of curves) path.bezierCurveTo(...c1, ...c2, ...end);
  path.closePath();
  return path;
}

function bezierPoint(p0, [c1, c2, p3], t) {
  const u = 1 - t;
  const f = (i) => u * u * u * p0[i] + 3 * u * u * t * c1[i] + 3 * u * t * t * c2[i] + t * t * t * p3[i];
  return [f(0), f(1)];
}

function marginPoints(segments, indices, perSegment) {
  const points = [];
  for (const i of indices) {
    const p0 = i === 1 ? segments[0] : segments[i - 1][2];
    for (let k = 0; k < perSegment; k++) points.push(bezierPoint(p0, segments[i], (k + 0.5) / perSegment));
  }
  return points;
}

const WING_PATH = (() => {
  const path = segmentsToPath(FOREWING);
  return segmentsToPath(HINDWING, path);
})();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const clamp = (v) => Math.max(0, Math.min(255, v));
const rgb = ({ r, g, b }, a = 1) => `rgba(${clamp(r) | 0}, ${clamp(g) | 0}, ${clamp(b) | 0}, ${a})`;
const mix = (a, b, t) => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const INK = { r: 34, g: 22, b: 14 };
const PAPER = { r: 236, g: 222, b: 192 };

let grainCanvas = null;
function grain() {
  if (!grainCanvas) {
    grainCanvas = makeCanvas(96, 96);
    const ctx = grainCanvas.getContext('2d');
    const img = ctx.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 150 + Math.random() * 105;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  return grainCanvas;
}

// The face, cut out with its soft oval mask.
function maskedFace(face) {
  const c = makeCanvas(FACE_W, FACE_H);
  const ctx = c.getContext('2d');
  ctx.drawImage(face.canvas, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(face.mask, 0, 0);
  return c;
}

// One half of a masked face. side: 'left' | 'right' (as seen in the photograph).
// With `midlineFirst`, the half is flipped if needed so that the facial midline is at x = 0.
function halfFace(masked, side, { midlineFirst = false } = {}) {
  const c = makeCanvas(HALF, FACE_H);
  const ctx = c.getContext('2d');
  const sx = side === 'left' ? 0 : HALF;
  if (midlineFirst && side === 'left') {
    ctx.translate(HALF, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(masked, sx, 0, HALF, FACE_H, 0, 0, HALF, FACE_H);
  return c;
}

// Shift a canvas's colours towards a target tone, so two people's skin blends at the seam.
function shiftTone(canvas, from, to, strength) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const dr = (to.r - from.r) * strength;
  const dg = (to.g - from.g) * strength;
  const db = (to.b - from.b) * strength;
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] += dr;
    img.data[i + 1] += dg;
    img.data[i + 2] += db;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// The halves that are not used on the wings, joined at the midline with a soft seam:
// the user's left half beside the mother's right half.
function mergedFace(mother, self) {
  const middle = mix(mother.tone, self.tone, 0.5);
  const motherFace = shiftTone(maskedFace(mother), mother.tone, middle, 0.6);
  const selfFace = shiftTone(maskedFace(self), self.tone, middle, 0.6);

  const seam = 28;
  const fade = makeCanvas(FACE_W, FACE_H);
  const fctx = fade.getContext('2d');
  fctx.drawImage(selfFace, 0, 0);
  const g = fctx.createLinearGradient(HALF - seam, 0, HALF + seam, 0);
  g.addColorStop(0, '#000');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  fctx.globalCompositeOperation = 'destination-in';
  fctx.fillStyle = g;
  fctx.fillRect(0, 0, FACE_W, FACE_H);

  const c = makeCanvas(FACE_W, FACE_H);
  const ctx = c.getContext('2d');
  ctx.drawImage(motherFace, HALF, 0, HALF, FACE_H, HALF, 0, HALF, FACE_H);
  // Extend the mother's half a little past the midline so the seam blends rather than gaps.
  ctx.drawImage(motherFace, HALF - seam, 0, seam, FACE_H, HALF - seam, 0, seam, FACE_H);
  ctx.drawImage(fade, 0, 0);
  return c;
}

function cellPath([start, curve1, corner, curve2]) {
  const p = new Path2D();
  p.moveTo(...start);
  p.quadraticCurveTo(...curve1[0], ...curve1[1]);
  p.lineTo(...corner[0]);
  p.quadraticCurveTo(...curve2[0], ...curve2[1]);
  p.closePath();
  return p;
}
const CELLS = [cellPath(FORE_CELL), cellPath(HIND_CELL)];

function drawVeins(ctx, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;
  for (const cell of CELLS) ctx.stroke(cell);
  for (const [[x0, y0], [x1, y1]] of VEINS) {
    const bend = 0.08;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(
      (x0 + x1) / 2 - (y1 - y0) * bend,
      (y0 + y1) / 2 + (x1 - x0) * bend,
      x1,
      y1,
    );
    ctx.stroke();
  }
}

// The outer edge of the wings only, for the dark marginal band.
const MARGIN_PATH = (() => {
  const p = new Path2D();
  for (const [segments, indices] of [[FOREWING, FORE_MARGIN], [HINDWING, HIND_MARGIN]]) {
    const first = indices[0];
    p.moveTo(...(first === 1 ? segments[0] : segments[first - 1][2]));
    for (const i of indices) {
      const [c1, c2, end] = segments[i];
      p.bezierCurveTo(...c1, ...c2, ...end);
    }
  }
  return p;
})();

// Draw one wing pair in local coordinates (x = distance from the body). The caller sets up mirroring.
function drawWing(ctx, half, tone) {
  const ground = mix(mix(tone, INK, 0.55), { r: 120, g: 70, b: 30 }, 0.2);
  const dark = mix(tone, INK, 0.85);

  ctx.save();
  ctx.clip(WING_PATH);

  // Ground colour, darker at the base like many real wings.
  const g = ctx.createRadialGradient(10, 300, 20, 10, 300, 430);
  g.addColorStop(0, rgb(dark));
  g.addColorStop(0.35, rgb(ground));
  g.addColorStop(1, rgb(mix(ground, dark, 0.4)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPECIMEN_W / 2, SPECIMEN_H);

  // The half face.
  ctx.save();
  ctx.filter = 'saturate(0.85) contrast(1.05)';
  const r = WING_FACE_RECT;
  ctx.drawImage(half, 0, WING_FACE_SRC.y, HALF, WING_FACE_SRC.h, r.x, r.y, r.w, r.h);
  ctx.restore();

  // Scales and age.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = ctx.createPattern(grain(), 'repeat');
  ctx.fillRect(0, 0, SPECIMEN_W / 2, SPECIMEN_H);
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgb(PAPER, 0.35);
  ctx.fillRect(0, 0, SPECIMEN_W / 2, SPECIMEN_H);

  drawVeins(ctx, rgb(INK, 0.45));
  ctx.globalCompositeOperation = 'source-over';

  // Dark marginal band with a row of pale spots.
  ctx.strokeStyle = rgb(dark, 0.9);
  ctx.lineWidth = 50;
  ctx.lineJoin = 'round';
  ctx.stroke(MARGIN_PATH);
  ctx.strokeStyle = rgb(dark, 0.45);
  ctx.lineWidth = 12;
  ctx.stroke(WING_PATH);
  ctx.fillStyle = rgb(mix(PAPER, tone, 0.25), 0.85);
  const centroids = { fore: [210, 190], hind: [180, 440] };
  const spots = [
    ...marginPoints(FOREWING, FORE_MARGIN, 4).map((p) => [p, centroids.fore]),
    ...marginPoints(HINDWING, HIND_MARGIN, 4).map((p) => [p, centroids.hind]),
  ];
  for (const [[x, y], [cx, cy]] of spots) {
    const d = Math.hypot(cx - x, cy - y);
    ctx.beginPath();
    ctx.arc(x + ((cx - x) / d) * 12, y + ((cy - y) / d) * 12, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = rgb(INK, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke(WING_PATH);
}

function bodyPath() {
  const p = new Path2D();
  p.ellipse(CX, 196, 24, 24, 0, 0, Math.PI * 2);
  p.ellipse(CX, 272, 30, 76, 0, 0, Math.PI * 2);
  p.ellipse(CX, 446, 21, 126, 0, 0, Math.PI * 2);
  return p;
}

function drawAntenna(ctx, dir) {
  ctx.strokeStyle = rgb(INK);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX + dir * 8, 178);
  ctx.bezierCurveTo(CX + dir * 20, 120, CX + dir * 60, 70, CX + dir * 118, 36);
  ctx.stroke();
  ctx.fillStyle = rgb(INK);
  ctx.beginPath();
  ctx.ellipse(CX + dir * 121, 34, 9, 5, dir * -0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawBody(ctx, merged, tone) {
  const path = bodyPath();
  drawAntenna(ctx, -1);
  drawAntenna(ctx, 1);

  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = rgb(mix(tone, INK, 0.75));
  ctx.fillRect(CX - 40, 150, 80, 450);

  // The merged face, squeezed onto head, thorax and abdomen.
  ctx.save();
  ctx.filter = 'saturate(0.85) contrast(1.05)';
  ctx.drawImage(merged, 40, 60, FACE_W - 80, FACE_H - 60, CX - 34, 168, 68, 360);
  ctx.restore();

  // Rounded shading and abdominal segments.
  ctx.globalCompositeOperation = 'multiply';
  const shade = ctx.createLinearGradient(CX - 30, 0, CX + 30, 0);
  shade.addColorStop(0, rgb(INK, 0.85));
  shade.addColorStop(0.3, 'rgba(255,255,255,0)');
  shade.addColorStop(0.7, 'rgba(255,255,255,0)');
  shade.addColorStop(1, rgb(INK, 0.85));
  ctx.fillStyle = shade;
  ctx.fillRect(CX - 40, 150, 80, 450);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = ctx.createPattern(grain(), 'repeat');
  ctx.fillRect(CX - 40, 150, 80, 450);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgb(INK, 0.5);
  ctx.lineWidth = 2;
  for (let y = 360; y < 560; y += 22) {
    ctx.beginPath();
    ctx.moveTo(CX - 24, y);
    ctx.quadraticCurveTo(CX, y + 9, CX + 24, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = rgb(INK, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke(path);
}

export function renderSpecimen(mother, self) {
  const canvas = makeCanvas(SPECIMEN_W, SPECIMEN_H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  const motherMasked = maskedFace(mother);
  const selfMasked = maskedFace(self);

  // Left wing: drawn mirrored, so the half is flipped first to keep the face the right way round.
  ctx.save();
  ctx.translate(CX, 0);
  ctx.scale(-1, 1);
  drawWing(ctx, halfFace(motherMasked, 'left', { midlineFirst: true }), mother.tone);
  ctx.restore();

  ctx.save();
  ctx.translate(CX, 0);
  drawWing(ctx, halfFace(selfMasked, 'right', { midlineFirst: true }), self.tone);
  ctx.restore();

  drawBody(ctx, mergedFace(mother, self), mix(mother.tone, self.tone, 0.5));
  return canvas;
}

// A preview of how a face will be divided, for the upload plates.
// role: 'mother' (left half → left wing) or 'self' (right half → right wing).
export function renderSplitPreview(face, role) {
  const c = makeCanvas(FACE_W, FACE_H);
  const ctx = c.getContext('2d');
  ctx.drawImage(face.canvas, 0, 0);
  const wingSide = role === 'mother' ? 0 : HALF;
  const bodySide = role === 'mother' ? HALF : 0;
  ctx.fillStyle = 'rgba(28, 20, 12, 0.55)';
  ctx.fillRect(bodySide, 0, HALF, FACE_H);
  ctx.strokeStyle = 'rgba(255, 248, 230, 0.9)';
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(HALF, 0);
  ctx.lineTo(HALF, FACE_H);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '600 26px "Courier Prime", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 248, 230, 0.95)';
  ctx.fillText(role === 'mother' ? 'LEFT WING' : 'RIGHT WING', wingSide + HALF / 2, FACE_H - 28);
  ctx.fillText('BODY', bodySide + HALF / 2, FACE_H - 28);
  return c;
}
