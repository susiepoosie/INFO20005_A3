// Composes a black-and-white, stippled butterfly specimen from two aligned faces (see faces.js).
// Each specimen uses one of several butterfly templates, chosen at random.
//   left wing  ← the mother's left eye
//   right wing ← the user's right eye
//   body       ← the two remaining eyes, cross-faded on top of each other
// "Left" and "right" are as seen in the photograph, matching the wings as seen on the display.
//
// Everything is first drawn as a greyscale "tone" image, then turned into ink dots on paper.

import { FACE_W, FACE_H } from './faces.js';

export const SPECIMEN_W = 1000;
export const SPECIMEN_H = 900;
const MARGIN = 40;

const INK = [24, 22, 26];
const PAPER = [251, 251, 249];

// Butterfly templates (templates/*.png: grey tone plus alpha), adapted from illustrations
// designed by Freepik. Coordinates are in template pixels:
//   cx                 the body's centre line
//   bodyTop/Bottom     extent of the head and abdomen along the centre line
//   eye                where the eye sits on the right forewing (dx from the centre line, y)
//                      and how wide it is; the left wing is the mirror image.
export const TEMPLATES = [
  { name: 'swallowtail', w: 694, h: 544, cx: 347, bodyTop: 168, bodyBottom: 360, eye: { dx: 123, y: 118, w: 150 } },
  { name: 'sulphur', w: 635, h: 363, cx: 318, bodyTop: 142, bodyBottom: 335, eye: { dx: 152, y: 108, w: 168 } },
  { name: 'blue', w: 412, h: 348, cx: 206, bodyTop: 133, bodyBottom: 284, eye: { dx: 99, y: 92, w: 118 } },
  { name: 'monarch', w: 561, h: 385, cx: 280, bodyTop: 152, bodyBottom: 303, eye: { dx: 140, y: 95, w: 158 } },
  { name: 'black-swallowtail', w: 562, h: 470, cx: 281, bodyTop: 147, bodyBottom: 340, eye: { dx: 129, y: 110, w: 148 } },
  { name: 'tiger', w: 561, h: 443, cx: 281, bodyTop: 143, bodyBottom: 335, eye: { dx: 139, y: 105, w: 148 } },
];

const templateImages = new Map();

function loadTemplate(template) {
  if (!templateImages.has(template.name)) {
    const img = new Image();
    img.src = new URL(`../templates/${template.name}.png`, import.meta.url).href;
    templateImages.set(
      template.name,
      img.decode().then(
        () => img,
        (err) => {
          templateImages.delete(template.name);
          throw err;
        },
      ),
    );
  }
  return templateImages.get(template.name);
}

export const preloadTemplates = () => Promise.all(TEMPLATES.map(loadTemplate));

export const randomTemplate = () => TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];

// ---- Canvas helpers ----------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const grey = (v) => `rgb(${v | 0}, ${v | 0}, ${v | 0})`;

// ---- Faces as tone -----------------------------------------------------------
// A face becomes a pale engraving: skin goes to paper white and the features stay dark.

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
    px[i] = px[i + 1] = px[i + 2] = 255 * Math.pow(t, 1.35);
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// The eye's crop, relative to the distance between the eyes: wide enough for the corners,
// tall enough for the brow.
const EYE_CROP = { w: 1.2, h: 0.82, lift: 0.12 };

// One eye from a toned face, on a soft-edged oval of paper. side: 'left' | 'right'.
// With `mirror`, the eye is flipped horizontally.
function eyePatch(face, toned, side, { mirror = false } = {}) {
  const { left, right } = face.eyes;
  const span = Math.hypot(right.x - left.x, right.y - left.y);
  const centre = face.eyes[side];
  const w = Math.round(span * EYE_CROP.w);
  const h = Math.round(span * EYE_CROP.h);

  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(toned, centre.x - w / 2, centre.y - h / 2 - span * EYE_CROP.lift, w, h, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Feather into an oval.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, '#000');
  g.addColorStop(0.62, '#000');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  return c;
}

// The eyes left over from the wings (the user's left, the mother's right, flipped to match),
// laid on top of each other at half strength.
function crossFadedEye(mother, motherToned, self, selfToned) {
  const selfEye = eyePatch(self, selfToned, 'left');
  const motherEye = eyePatch(mother, motherToned, 'right', { mirror: true });
  const c = makeCanvas(selfEye.width, selfEye.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(selfEye, 0, 0);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(motherEye, 0, 0, c.width, c.height);
  return c;
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
    const c = darkness > 0.86 || darkness > field[j] ? INK : PAPER;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = alpha;
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// ---- Public API --------------------------------------------------------------

export async function renderSpecimen(mother, self, template = randomTemplate()) {
  const art = await loadTemplate(template);
  const scale = Math.min((SPECIMEN_W - 2 * MARGIN) / template.w, (SPECIMEN_H - 2 * MARGIN) / template.h);
  const ox = SPECIMEN_W / 2 - template.cx * scale;
  const oy = (SPECIMEN_H - template.h * scale) / 2;
  const at = (x, y) => [ox + x * scale, oy + y * scale];

  const motherToned = toneFace(mother);
  const selfToned = toneFace(self);

  const tone = makeCanvas(SPECIMEN_W, SPECIMEN_H);
  const ctx = tone.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, SPECIMEN_W, SPECIMEN_H);
  ctx.drawImage(art, ox, oy, template.w * scale, template.h * scale);

  // An eye on each forewing.
  const wingEyes = [
    [eyePatch(mother, motherToned, 'left'), -1],
    [eyePatch(self, selfToned, 'right'), 1],
  ];
  for (const [patch, dir] of wingEyes) {
    const w = template.eye.w * scale;
    const h = (w * patch.height) / patch.width;
    const [x, y] = at(template.cx + dir * template.eye.dx, template.eye.y);
    ctx.drawImage(patch, x - w / 2, y - h / 2, w, h);
  }

  // The cross-faded eye, on an oval thorax.
  const bodyEye = crossFadedEye(mother, motherToned, self, selfToned);
  const bw = template.eye.w * scale * 0.72;
  const bh = (bw * bodyEye.height) / bodyEye.width;
  // The crop sits a little above the eye (to take in the brow); centre the eye itself.
  const eyeOffset = (EYE_CROP.lift / EYE_CROP.h) * bh;
  const [bx, by] = at(template.cx, template.bodyTop + 0.32 * (template.bodyBottom - template.bodyTop));
  const thorax = new Path2D();
  thorax.ellipse(bx, by, bw * 0.46, bw * 0.6, 0, 0, Math.PI * 2);
  ctx.save();
  ctx.clip(thorax);
  ctx.fillStyle = grey(232);
  ctx.fillRect(bx - bw, by - bh * 2, bw * 2, bh * 4);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(bodyEye, bx - bw / 2, by - bh / 2 - eyeOffset, bw, bh);
  const rim = ctx.createRadialGradient(bx, by, bw * 0.3, bx, by, bw * 0.62);
  rim.addColorStop(0, grey(255));
  rim.addColorStop(1, grey(90));
  ctx.fillStyle = rim;
  ctx.fillRect(bx - bw, by - bh * 2, bw * 2, bh * 4);
  ctx.restore();

  // Silhouette: wherever there is butterfly, there is paper.
  const silhouette = makeCanvas(SPECIMEN_W, SPECIMEN_H);
  const sctx = silhouette.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(art, ox, oy, template.w * scale, template.h * scale);
  sctx.fill(thorax);

  return stipple(tone, silhouette);
}

// A preview of which eye goes where, for the upload steps.
// role: 'mother' (left eye → left wing) or 'self' (right eye → right wing).
export function renderSplitPreview(face, role) {
  const c = makeCanvas(FACE_W, FACE_H);
  const ctx = c.getContext('2d');
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(face.canvas, 0, 0);
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillRect(0, 0, FACE_W, FACE_H);

  const { left, right } = face.eyes;
  const span = Math.hypot(right.x - left.x, right.y - left.y);
  const wingSide = role === 'mother' ? 'left' : 'right';
  const bodySide = role === 'mother' ? 'right' : 'left';
  ctx.font = '500 20px Jost, "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  for (const [side, text] of [
    [wingSide, role === 'mother' ? 'LEFT WING' : 'RIGHT WING'],
    [bodySide, 'BODY'],
  ]) {
    const e = face.eyes[side];
    const rx = (span * EYE_CROP.w) / 2;
    const ry = (span * EYE_CROP.h) / 2;
    const cy = e.y - span * EYE_CROP.lift;
    // Show the eye at full strength inside its oval.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(e.x, cy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(face.canvas, 0, 0);
    ctx.restore();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(e.x, cy, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    const w = ctx.measureText(text).width + 20;
    const ty = cy + ry * 0.8 + 16;
    ctx.fillStyle = '#111';
    ctx.fillRect(e.x - w / 2, ty, w, 32);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, e.x, ty + 23);
  }
  return c;
}
