# The Butterfly Archive

An entomological display of butterflies made from faces. Visitors scan a QR code on the
display screen with their phone, upload two photographs (one of themselves and one of their
mother), and their butterfly is pinned to the shared display.

- The **left half of the mother's face** becomes the **left wing**.
- The **right half of the visitor's face** becomes the **right wing**.
- The two remaining halves (the visitor's left, the mother's right) are **cross-faded on top
  of each other** to form the body, so a single eye sits on its centre line.

Butterflies are rendered as black-and-white stippled engravings of a swallowtail.

## Pages

| Page | Who sees it |
| --- | --- |
| `index.html` | The display screen. It shows every specimen, newest first, with a QR code to the mounting page. New specimens appear live. |
| `mount.html` | The mounting page, opened on a visitor's phone. It finds and splits the two faces, previews the butterfly, and lets the visitor label it and pin it to the display. |

## Running it

The pages and the shared collection are served by a small Node server (Node 18 or later, no
dependencies):

```sh
cd butterfly-archive
npm start            # or: node server.js
```

Open `http://localhost:8000/` on the display screen. When the display is opened on
`localhost`, the QR code points phones at this computer's address on the local network, so
phones need to be on the same Wi-Fi. The server prints that address when it starts.

The face detector downloads from jsDelivr and Google's model storage, so the phones need
internet access the first time they open the mounting page.

### Settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8000` | Port to listen on. |
| `DATA_DIR` | `./data` | Where specimens are stored (`specimens.json` plus one image per specimen). |
| `PUBLIC_URL` | (none) | Public address of the site, e.g. `https://butterflies.example.com`. When set, the QR code uses it. Set this when the server is hosted online. |
| `ADMIN_KEY` | (none) | Enables removing specimens. Open the display at `/?key=<ADMIN_KEY>`, then click a specimen to see a remove button. |

### Hosting online

Any host that runs a Node process works (for example Railway, Render, Fly.io or a VPS).
Set the start command to `node server.js` and set `PUBLIC_URL`. Put `DATA_DIR` on a
persistent volume, or the collection is lost when the server restarts.

## How it works

| File | Role |
| --- | --- |
| `js/faces.js` | Detects faces with [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker). It picks the largest face, levels the eyes, centres the facial midline and cuts a soft face-oval mask. |
| `js/butterfly.js` | Draws the specimen: it turns each face into a pale engraving tone, lays the halves onto the wings and the cross-faded halves onto the body, adds the swallowtail markings, then stipples the result into ink dots. |
| `js/mount.js` | The phone mounting page. |
| `js/display.js` | The display screen, with live updates over server-sent events. |
| `js/labels.js` | Specimen label wording and the suggested Latin species name. |
| `js/vendor/qrcode.mjs` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). |
| `server.js` | Serves the pages and the API: `GET`/`POST /api/specimens`, `DELETE /api/specimens/:id`, `GET /api/events`, `GET /api/info`. |

"Left" and "right" are as seen in the photograph, which matches the wings as seen on the display.

## Privacy

Photographs are processed on the visitor's phone and are never uploaded. Only the finished
butterfly image and its label are sent to the server. Uploads are limited to a few per
device every ten minutes.
