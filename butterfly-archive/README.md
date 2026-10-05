# The Butterfly Archive

A web app styled as an entomological museum display. Visitors mount their own specimen by
uploading two photographs: one of themselves and one of their mother.

- The **left half of the mother's face** becomes the **left wing**.
- The **right half of the visitor's face** becomes the **right wing**.
- The two remaining halves (the visitor's left, the mother's right) are joined at the midline,
  colour-matched so their skin tones meet, and laid over the **body**.

Once the visitor confirms the specimen and fills in its label, it is pinned onto the display board.

## Running it

The app is plain HTML, CSS and ES modules with no build step. Because it uses JavaScript modules,
it has to be served over HTTP rather than opened as a `file://` URL:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/butterfly-archive/
```

An internet connection is needed on first use to load the face detector from jsDelivr and
Google's model storage.

## How it works

| File | Role |
| --- | --- |
| `js/faces.js` | Detects faces with [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker). It picks the largest face, levels the eyes, centres the facial midline, and cuts a soft-edged face-oval mask. |
| `js/butterfly.js` | Draws the specimen on a canvas: wing and body outlines, the half-faces clipped into them, then veins, marginal bands and spots, and grain to age it. |
| `js/store.js` | Saves finished specimens in the browser's IndexedDB. |
| `js/app.js` | Runs the display board, the mounting bench (uploads and label) and the close-up viewer. |

"Left" and "right" are as seen in the photograph, which matches the wings as seen on the board.

## Privacy and storage

Photographs are processed entirely in the visitor's browser and are never uploaded. Only the
finished butterfly image and its label are kept, in that browser's IndexedDB. This means each
browser has its own board. A shared, public archive would need a small backend to store the
specimens.
