// The display screen: shows every specimen in the shared archive, live, with a QR code
// that opens the mounting page on a visitor's phone.

import qrcode from './vendor/qrcode.mjs';
import { catalogueNumber, labelDescription, labelDetails } from './labels.js';

const $ = (sel) => document.querySelector(sel);
const list = $('#specimens');
const intro = list.querySelector('.intro');
const viewer = $('#viewer');
const adminKey = new URLSearchParams(location.search).get('key');

const shown = new Map();

function specimenElement(specimen) {
  const li = document.createElement('li');
  li.className = 'specimen';
  li.dataset.id = specimen.id;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'specimen-button';
  button.setAttribute('aria-label', `View ${specimen.species}, collected by ${specimen.collector}`);
  const img = document.createElement('img');
  img.src = specimen.image;
  img.alt = '';
  img.className = 'specimen-image';
  img.decoding = 'async';
  button.append(img);
  button.addEventListener('click', () => openViewer(specimen));

  const label = document.createElement('div');
  label.className = 'label';
  const number = document.createElement('p');
  number.className = 'label-number';
  number.textContent = catalogueNumber(specimen.id);
  const species = document.createElement('p');
  species.className = 'label-species';
  species.textContent = specimen.species;
  const details = document.createElement('p');
  details.className = 'label-details';
  details.textContent = labelDetails(specimen);
  const text = document.createElement('p');
  text.className = 'label-text';
  text.textContent = labelDescription();
  label.append(number, species, details, text);

  li.append(button, label);
  return li;
}

function updateCount() {
  const n = shown.size;
  $('#specimen-count').textContent =
    n === 0 ? 'The collection is waiting for its first specimen.' : `${n} specimen${n === 1 ? '' : 's'} in the collection`;
}

// Newest first, directly after the introduction panel.
function addSpecimen(specimen, { arriving = false } = {}) {
  if (shown.has(specimen.id)) return;
  const el = specimenElement(specimen);
  shown.set(specimen.id, el);
  const newer = [...shown.keys()].filter((id) => id > specimen.id).sort((a, b) => a - b)[0];
  const before = newer === undefined ? intro.nextSibling : shown.get(newer).nextSibling;
  list.insertBefore(el, before);
  if (arriving) {
    el.classList.add('arriving');
    el.addEventListener('animationend', () => el.classList.remove('arriving'), { once: true });
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  updateCount();
}

function removeSpecimen(id) {
  shown.get(id)?.remove();
  shown.delete(id);
  updateCount();
}

async function sync() {
  const res = await fetch('/api/specimens');
  if (!res.ok) throw new Error(`Could not load specimens (${res.status})`);
  const specimens = await res.json();
  const ids = new Set(specimens.map((s) => s.id));
  for (const id of [...shown.keys()]) if (!ids.has(id)) removeSpecimen(id);
  for (const s of specimens) addSpecimen(s);
  updateCount();
}

function listen() {
  const events = new EventSource('/api/events');
  // After a dropped connection, catch up on anything missed.
  events.addEventListener('open', () => sync().catch(console.error));
  events.addEventListener('specimen', (e) => addSpecimen(JSON.parse(e.data), { arriving: true }));
  events.addEventListener('remove', (e) => removeSpecimen(JSON.parse(e.data).id));
}

async function showQr() {
  let url = new URL('mount.html', location.href).href;
  try {
    const info = await (await fetch('/api/info')).json();
    url = info.mountUrl || url;
  } catch (err) {
    console.error(err);
  }
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('#qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  $('#qr-url').textContent = url.replace(/^https?:\/\//, '');
}

// ---- Close-up viewer --------------------------------------------------------

let viewing = null;

function openViewer(specimen) {
  viewing = specimen;
  $('#viewer-image').src = specimen.image;
  $('#viewer-image').alt = `${specimen.species}: a butterfly made from two faces`;
  $('#viewer-number').textContent = catalogueNumber(specimen.id);
  $('#viewer-title').textContent = specimen.species;
  $('#viewer-details').textContent = `${labelDetails(specimen)}. ${labelDescription()}`;
  $('#viewer-actions').hidden = !adminKey;
  viewer.showModal();
}

$('#viewer-remove').addEventListener('click', async () => {
  if (!viewing || !confirm(`Remove ${viewing.species} from the archive? This cannot be undone.`)) return;
  const res = await fetch(`/api/specimens/${viewing.id}`, { method: 'DELETE', headers: { 'X-Admin-Key': adminKey } });
  if (!res.ok) {
    alert('This specimen could not be removed. Check the admin key.');
    return;
  }
  removeSpecimen(viewing.id);
  viewer.close();
});

viewer.addEventListener('click', (e) => {
  const r = viewer.getBoundingClientRect();
  const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (e.target === viewer && outside) viewer.close();
});

updateCount();
showQr();
sync()
  .catch((err) => {
    console.error(err);
    $('#specimen-count').textContent = 'The archive could not be reached.';
  })
  .finally(listen);
