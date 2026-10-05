// Butterfly Archive server: serves the pages and keeps the shared collection of specimens.
// No dependencies; needs Node 18 or later.
//
//   PORT        port to listen on (default 8000)
//   DATA_DIR    where specimens are stored (default ./data)
//   PUBLIC_URL  address phones should use, e.g. https://butterflies.example.com
//               (default: this machine's address on the local network)
//   ADMIN_KEY   enables removing specimens from the display with ?key=<ADMIN_KEY>

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const IMAGE_DIR = path.join(DATA_DIR, 'specimens');
const DB_FILE = path.join(DATA_DIR, 'specimens.json');
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const MAX_BODY = 8 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const RATE_LIMIT = { count: 6, windowMs: 10 * 60 * 1000 };

const STATIC_FILES = new Set(['index.html', 'mount.html']);
const STATIC_DIRS = ['css', 'js'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// ---- Storage ---------------------------------------------------------------

let specimens = [];
let writeQueue = Promise.resolve();

async function loadSpecimens() {
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  try {
    specimens = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    specimens = [];
  }
}

function saveSpecimens() {
  const snapshot = JSON.stringify(specimens, null, 2);
  writeQueue = writeQueue.then(async () => {
    const tmp = `${DB_FILE}.tmp`;
    await fs.writeFile(tmp, snapshot);
    await fs.rename(tmp, DB_FILE);
  });
  return writeQueue;
}

const publicSpecimen = (s) => ({ ...s, image: `/specimens/${s.file}` });

// ---- Live updates (server-sent events) -------------------------------------

const listeners = new Set();

function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of listeners) res.write(message);
}

setInterval(() => {
  for (const res of listeners) res.write(': keep-alive\n\n');
}, 25_000).unref();

// ---- Helpers ---------------------------------------------------------------

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Upload too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid request.'), { status: 400 });
  }
}

const cleanText = (value, max) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';

function decodeImage(dataUrl) {
  const match = /^data:image\/(webp|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE) return null;
  const isWebp = bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP';
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (match[1] === 'webp' && isWebp) return { bytes, ext: 'webp' };
  if (match[1] === 'png' && isPng) return { bytes, ext: 'png' };
  return null;
}

const recentPosts = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const times = (recentPosts.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (times.length >= RATE_LIMIT.count) return true;
  times.push(now);
  recentPosts.set(ip, times);
  return false;
}

function lanAddress() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return null;
}

// The address phones should open. A display opened at "localhost" would give phones a
// useless QR code, so in that case use this machine's address on the local network.
function mountUrl(req) {
  if (PUBLIC_URL) return `${PUBLIC_URL}/mount.html`;
  const host = req.headers.host || `localhost:${PORT}`;
  const { hostname, port } = new URL(`http://${host}`);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const lan = local && lanAddress();
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return lan ? `http://${lan}${port ? `:${port}` : ''}/mount.html` : `${proto}://${host}/mount.html`;
}

async function serveFile(res, file) {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error('not a file');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': file.startsWith(IMAGE_DIR) ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
}

function resolveInside(base, relative) {
  const file = path.resolve(base, relative);
  return file.startsWith(base + path.sep) ? file : null;
}

// ---- Routes ----------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;

  if (pathname === '/api/specimens' && req.method === 'GET') {
    return send(res, 200, specimens.map(publicSpecimen));
  }

  if (pathname === '/api/specimens' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) return send(res, 429, { error: 'Too many specimens from this device. Try again later.' });
    const body = await readJson(req);
    const image = decodeImage(body.image);
    const collector = cleanText(body.collector, 40);
    const species = cleanText(body.species, 60);
    const locality = cleanText(body.locality, 60);
    if (!image) return send(res, 400, { error: 'The specimen image is missing or invalid.' });
    if (!collector || !species) return send(res, 400, { error: 'Collector and species are required.' });

    const id = specimens.reduce((max, s) => Math.max(max, s.id), 0) + 1;
    const file = `${id}-${Date.now().toString(36)}.${image.ext}`;
    await fs.writeFile(path.join(IMAGE_DIR, file), image.bytes);
    const specimen = { id, collector, species, locality, createdAt: Date.now(), file };
    specimens.push(specimen);
    await saveSpecimens();
    broadcast('specimen', publicSpecimen(specimen));
    return send(res, 201, publicSpecimen(specimen));
  }

  const del = /^\/api\/specimens\/(\d+)$/.exec(pathname);
  if (del && req.method === 'DELETE') {
    if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) return send(res, 403, { error: 'Not allowed.' });
    const id = Number(del[1]);
    const specimen = specimens.find((s) => s.id === id);
    if (!specimen) return send(res, 404, { error: 'No such specimen.' });
    specimens = specimens.filter((s) => s.id !== id);
    await saveSpecimens();
    await fs.rm(path.join(IMAGE_DIR, specimen.file), { force: true });
    broadcast('remove', { id });
    return send(res, 200, { ok: true });
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return;
  }

  if (pathname === '/api/info' && req.method === 'GET') {
    return send(res, 200, { mountUrl: mountUrl(req), canRemove: Boolean(ADMIN_KEY) });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  if (pathname.startsWith('/specimens/')) {
    const file = resolveInside(IMAGE_DIR, decodeURIComponent(pathname.slice('/specimens/'.length)));
    return file ? serveFile(res, file) : send(res, 404, 'Not found');
  }

  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const allowed = STATIC_FILES.has(relative) || STATIC_DIRS.some((d) => relative.startsWith(`${d}/`));
  const file = allowed && resolveInside(ROOT, relative);
  return file ? serveFile(res, file) : send(res, 404, 'Not found');
}

await loadSpecimens();

http
  .createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!err.status) console.error(err);
      if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Server error.' });
      else res.end();
    });
  })
  .listen(PORT, () => {
    const lan = lanAddress();
    console.log(`Butterfly Archive running at http://localhost:${PORT}/`);
    if (lan) console.log(`On the local network:      http://${lan}:${PORT}/`);
    console.log(`Specimens are stored in ${DATA_DIR}`);
  });
