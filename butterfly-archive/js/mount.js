// The mounting page, opened on a visitor's phone from the display's QR code.

import { loadDetector, loadImage, extractFace } from './faces.js';
import { renderSpecimen, renderSplitPreview } from './butterfly.js';
import { catalogueNumber, suggestSpecies } from './labels.js';

const $ = (sel) => document.querySelector(sel);

const bench = $('#bench');
const preparation = $('#preparation');
const labelForm = $('#label-form');
const previewImg = $('#preview-specimen');
const formError = $('#form-error');
const done = $('#done');

const faces = { mother: null, self: null };
let specimenBlob = null;
let specimenUrl = null;
let speciesEdited = false;
let renderToken = 0;

function step(role) {
  const el = document.querySelector(`.step[data-role="${role}"]`);
  return {
    el,
    input: el.querySelector('input[type=file]'),
    status: el.querySelector('.step-status'),
    canvas: el.querySelector('.photo-preview'),
    empty: el.querySelector('.photo-empty'),
  };
}

function setStatus(role, text, state = '') {
  const s = step(role);
  s.status.textContent = text;
  s.el.dataset.state = state;
}

async function handleFile(role, file) {
  if (!file) return;
  faces[role] = null;
  updatePreparation();
  const s = step(role);
  setStatus(role, 'Finding the face…', 'busy');
  try {
    const face = await extractFace(await loadImage(file));
    faces[role] = face;
    const preview = renderSplitPreview(face, role);
    s.canvas.width = preview.width;
    s.canvas.height = preview.height;
    s.canvas.getContext('2d').drawImage(preview, 0, 0);
    s.canvas.hidden = false;
    s.empty.hidden = true;
    setStatus(role, face.faceCount > 1 ? `${face.faceCount} faces found; using the largest.` : 'Face found.', 'ok');
  } catch (err) {
    console.error(err);
    s.canvas.hidden = true;
    s.empty.hidden = false;
    setStatus(role, err.message || 'Something went wrong with this photograph.', 'error');
  }
  updatePreparation();
}

function updatePreparation() {
  const token = ++renderToken;
  specimenBlob = null;
  if (!faces.mother || !faces.self) {
    preparation.hidden = true;
    return;
  }
  // Let the status text paint before the (blocking) render.
  requestAnimationFrame(() =>
    setTimeout(() => {
      if (token !== renderToken) return;
      const canvas = renderSpecimen(faces.mother, faces.self);
      canvas.toBlob(
        (blob) => {
          if (token !== renderToken) return;
          specimenBlob = blob;
          if (specimenUrl) URL.revokeObjectURL(specimenUrl);
          specimenUrl = URL.createObjectURL(blob);
          previewImg.src = specimenUrl;
          preparation.hidden = false;
          if (!labelForm.species.value) labelForm.species.value = suggestSpecies(labelForm.collector.value);
          preparation.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        // WebP keeps uploads small; browsers that cannot encode it fall back to PNG.
        'image/webp',
        0.85,
      );
    }, 30),
  );
}

function resetBench() {
  faces.mother = faces.self = null;
  renderToken++;
  specimenBlob = null;
  speciesEdited = false;
  labelForm.reset();
  formError.textContent = '';
  preparation.hidden = true;
  for (const role of ['mother', 'self']) {
    const s = step(role);
    s.canvas.hidden = true;
    s.empty.hidden = false;
    s.input.value = '';
    setStatus(role, '');
  }
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

for (const role of ['mother', 'self']) {
  const { input } = step(role);
  input.addEventListener('change', () => handleFile(role, input.files[0]));
}

labelForm.collector.addEventListener('input', () => {
  if (!speciesEdited) labelForm.species.value = suggestSpecies(labelForm.collector.value);
});
labelForm.species.addEventListener('input', () => {
  speciesEdited = labelForm.species.value.trim() !== '';
});

labelForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!specimenBlob) return;
  const submit = labelForm.querySelector('[type=submit]');
  submit.disabled = true;
  submit.textContent = 'Pinning…';
  formError.textContent = '';
  try {
    const res = await fetch('/api/specimens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: await blobToDataUrl(specimenBlob),
        collector: labelForm.collector.value,
        species: labelForm.species.value,
        locality: labelForm.locality.value,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `The display could not be reached (${res.status}).`);
    $('#done-specimen').src = specimenUrl;
    $('#done-number').textContent = catalogueNumber(body.id);
    bench.hidden = true;
    done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    formError.textContent =
      err instanceof TypeError ? 'The display could not be reached. Check your connection and try again.' : err.message;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Pin to the display';
  }
});

$('#reset-bench').addEventListener('click', resetBench);
$('#mount-another').addEventListener('click', () => {
  resetBench();
  done.hidden = true;
  bench.hidden = false;
  window.scrollTo({ top: 0 });
});

// Start downloading the face detector straight away; it takes a few seconds on a phone.
loadDetector().catch(() => {});
