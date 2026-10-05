# The Butterfly Archive

An entomological display of butterflies made from faces. Visitors scan a QR code on the
display screen with their phone, upload two photographs (one of themselves and one of their
mother), and their butterfly is pinned to the shared display.

- The **mother's left eye** is placed on the **left wing**.
- The **visitor's right eye** is placed on the **right wing**.
- The two remaining eyes (the visitor's left, the mother's right) are **cross-faded on top
  of each other** and placed on the body.

Each specimen uses one of six butterfly forms, chosen at random, rendered as a
black-and-white stippled engraving.

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
| `js/butterfly.js` | Draws the specimen: it picks a butterfly template, turns each face into a pale engraving tone, cuts out the eyes and places them on the forewings and body, then stipples the result into ink dots. Each template's eye and body positions are listed in `TEMPLATES`. |
| `templates/*.png` | The six butterfly forms as greyscale tone plus transparency. |
| `js/mount.js` | The phone mounting page. |
| `js/display.js` | The display screen, with live updates over server-sent events. |
| `js/labels.js` | Specimen label wording and the suggested Latin species name. |
| `js/vendor/qrcode.mjs` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT). |

## Credits

The butterfly templates are adapted from the *Butterfly Collection* illustrations designed
by [Freepik](https://www.freepik.com). Freepik's free licence requires this attribution,
which is also shown on both pages.
| `server.js` | Serves the pages and the API: `GET`/`POST /api/specimens`, `DELETE /api/specimens/:id`, `GET /api/events`, `GET /api/info`. |

"Left" and "right" are as seen in the photograph, which matches the wings as seen on the display.

## Privacy

Photographs are processed on the visitor's phone and are never uploaded. Only the finished
butterfly image and its label are sent to the server. Uploads are limited to a few per
device every ten minutes.
