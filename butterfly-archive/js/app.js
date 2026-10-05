import { loadDetector, loadImage, extractFace } from './faces.js';
import { renderSpecimen, renderSplitPreview } from './butterfly.js';
import { allSpecimens, addSpecimen, removeSpecimen } from './store.js';

const $ = (sel) => document.querySelector(sel);

const board = $('#specimens');
const bench = $('#bench');
const viewer = $('#viewer');
const preparation = $('#preparation');
const labelForm = $('#label-form');
const previewImg = $('#preview-specimen');

const faces = { mother: null, self: null };
let specimenBlob = null;
let specimenUrl = null;
let speciesEdited = false;
const objectUrls = new Map();

const dateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

// ---- Display board ---------------------------------------------------------

function catalogueNumber(id) {
  return `No. ${String(id).padStart(4, '0')}`;
}

function specimenElement(specimen) {
  const url = URL.createObjectURL(specimen.image);
  objectUrls.set(specimen.id, url);

  const li = document.createElement('li');
  li.className = 'specimen';
  li.dataset.id = specimen.id;
  li.style.setProperty('--tilt', `${((specimen.id * 37) % 7) - 3}deg`);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'specimen-button';
  button.setAttribute('aria-label', `View ${specimen.species}, collected by ${specimen.collector}`);

  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  img.className = 'specimen-image';

  const pin = document.createElement('span');
  pin.className = 'pin';
  pin.setAttribute('aria-hidden', 'true');

  button.append(img, pin);

  const label = document.createElement('div');
  label.className = 'specimen-label';
  label.innerHTML = '<p class="label-number"></p><p class="label-species"></p><p class="label-collector"></p>';
  label.querySelector('.label-number').textContent = catalogueNumber(specimen.id);
  label.querySelector('.label-species').textContent = specimen.species;
  label.querySelector('.label-collector').textContent = `leg. ${specimen.collector}`;

  li.append(button, label);
  button.addEventListener('click', () => openViewer(specimen));
  return li;
}

function updateCount() {
  const n = board.children.length;
  $('#specimen-count').textContent = n === 0 ? 'No specimens yet' : `${n} specimen${n === 1 ? '' : 's'}`;
  $('#board-empty').hidden = n > 0;
}

async function loadBoard() {
  try {
    const specimens = await allSpecimens();
    board.replaceChildren(...specimens.map(specimenElement));
  } catch (err) {
    console.error(err);
    $('#board-empty').textContent = 'The archive could not be opened in this browser.';
  }
  updateCount();
}

// ---- Mounting bench --------------------------------------------------------

function plate(role) {
  const el = document.querySelector(`.plate[data-role="${role}"]`);
  return {
    el,
    status: el.querySelector('.plate-status'),
    canvas: el.querySelector('.dropzone-preview'),
    empty: el.querySelector('.dropzone-empty'),
  };
}

function setStatus(role, text, kind = '') {
  const { status, el } = plate(role);
  status.textContent = text;
  el.dataset.state = kind;
}

async function handleFile(role, file) {
  if (!file) return;
  faces[role] = null;
  updatePreparation();
  const p = plate(role);
  setStatus(role, 'Examining photograph…', 'busy');
  try {
    const image = await loadImage(file);
    const face = await extractFace(image);
    faces[role] = face;
    const preview = renderSplitPreview(face, role);
    p.canvas.width = preview.width;
    p.canvas.height = preview.height;
    p.canvas.getContext('2d').drawImage(preview, 0, 0);
    p.canvas.hidden = false;
    p.empty.hidden = true;
    setStatus(
      role,
      face.faceCount > 1 ? `${face.faceCount} faces found; using the largest.` : 'Face found and aligned.',
      'ok',
    );
  } catch (err) {
    console.error(err);
    p.canvas.hidden = true;
    p.empty.hidden = false;
    setStatus(role, err.message || 'Something went wrong with this photograph.', 'error');
  }
  updatePreparation();
}

function suggestSpecies(collector) {
  const name = collector
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)[0]
    .replace(/[^a-z]/g, '');
  if (!name) return 'Matrilinea incognita';
  const epithet = name.endsWith('a') ? `${name}e` : `${name}ae`;
  return `Matrilinea ${epithet}`;
}

function updatePreparation() {
  if (!faces.mother || !faces.self) {
    preparation.hidden = true;
    specimenBlob = null;
    return;
  }
  const canvas = renderSpecimen(faces.mother, faces.self);
  canvas.toBlob((blob) => {
    specimenBlob = blob;
    if (specimenUrl) URL.revokeObjectURL(specimenUrl);
    specimenUrl = URL.createObjectURL(blob);
    previewImg.src = specimenUrl;
    preparation.hidden = false;
    if (!labelForm.species.value) labelForm.species.value = suggestSpecies(labelForm.collector.value);
    preparation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // WebP keeps stored specimens small; browsers that cannot encode it fall back to PNG.
  }, 'image/webp', 0.92);
}

function resetBench() {
  faces.mother = faces.self = null;
  specimenBlob = null;
  speciesEdited = false;
  labelForm.reset();
  preparation.hidden = true;
  for (const role of ['mother', 'self']) {
    const p = plate(role);
    p.canvas.hidden = true;
    p.empty.hidden = false;
    p.el.querySelector('input[type=file]').value = '';
    setStatus(role, '');
  }
}

function openBench() {
  bench.showModal();
  // Start downloading the face detector while the user picks photographs.
  loadDetector().catch(() => {});
}

for (const input of document.querySelectorAll('.plate input[type=file]')) {
  input.addEventListener('change', () => handleFile(input.dataset.role, input.files[0]));
}

for (const zone of document.querySelectorAll('.dropzone')) {
  const role = zone.querySelector('input').dataset.role;
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragging');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragging');
    handleFile(role, e.dataTransfer.files[0]);
  });
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
  const specimen = {
    image: specimenBlob,
    collector: labelForm.collector.value.trim(),
    species: labelForm.species.value.trim(),
    locality: labelForm.locality.value.trim(),
    createdAt: Date.now(),
  };
  try {
    specimen.id = await addSpecimen(specimen);
  } catch (err) {
    console.error(err);
    alert('The specimen could not be saved in this browser.');
    submit.disabled = false;
    return;
  }
  submit.disabled = false;
  bench.close();
  resetBench();
  pinToBoard(specimen);
});

function pinToBoard(specimen) {
  const el = specimenElement(specimen);
  el.classList.add('arriving');
  board.append(el);
  updateCount();
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.addEventListener('animationend', (e) => {
    if (e.target.classList.contains('pin')) el.classList.remove('arriving');
  });
}

$('#open-bench').addEventListener('click', openBench);
$('#reset-bench').addEventListener('click', resetBench);

// ---- Close-up viewer -------------------------------------------------------

let viewing = null;

function openViewer(specimen) {
  viewing = specimen;
  const url = objectUrls.get(specimen.id);
  $('#viewer-image').src = url;
  $('#viewer-image').alt = `${specimen.species}: a butterfly made from two faces`;
  $('#viewer-number').textContent = catalogueNumber(specimen.id);
  $('#viewer-title').textContent = specimen.species;
  const details = [`leg. ${specimen.collector}`, dateFormat.format(specimen.createdAt)];
  if (specimen.locality) details.splice(1, 0, specimen.locality);
  $('#viewer-details').textContent = details.join(' · ');
  const download = $('#viewer-download');
  download.href = url;
  const ext = specimen.image.type === 'image/webp' ? 'webp' : 'png';
  download.download = `${specimen.species.replace(/\s+/g, '-').toLowerCase() || 'specimen'}.${ext}`;
  viewer.showModal();
}

$('#viewer-remove').addEventListener('click', async () => {
  if (!viewing) return;
  if (!confirm(`Remove ${viewing.species} from the archive? This cannot be undone.`)) return;
  await removeSpecimen(viewing.id);
  board.querySelector(`[data-id="${viewing.id}"]`)?.remove();
  URL.revokeObjectURL(objectUrls.get(viewing.id));
  objectUrls.delete(viewing.id);
  viewing = null;
  viewer.close();
  updateCount();
});

// Clicking the backdrop closes a dialog.
for (const dialog of [bench, viewer]) {
  dialog.addEventListener('click', (e) => {
    const r = dialog.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (e.target === dialog && outside) dialog.close();
  });
}

loadBoard();
