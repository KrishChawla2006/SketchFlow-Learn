# SketchFlow Learn

**Draw. Create. Learn. Grow.**

SketchFlow Learn is a free digital whiteboard that runs entirely in your browser. You can sketch, make diagrams, drop in images and explain ideas visually. There is no sign-up, no backend and nothing to install.

It's built with plain **HTML, CSS and JavaScript**. There are no frameworks and no libraries, just the browser's own APIs. I made it as a learning project, so the code is written to be read.

---

## Try it

1. Download or clone the project.
2. Open `pages/index.html` in your browser. That's the home page.
3. Click **Start drawing** and you're on the board.

That's all it takes. If you'd rather use a local server (handy for features like copy-to-clipboard), either of these works:

```bash
# Python
python -m http.server 8000

# or Node
npx serve
```

Then visit `http://localhost:8000/pages/index.html`.

---

## What's inside

```
sketchflow-learn/
├── assets/
│   ├── logo.png          Full logo
│   └── icon.png          The "S" icon (favicon and top-left brand)
├── css/
│   ├── index.css         Styles for the home page
│   └── style.css         Styles for the whiteboard
├── js/
│    ├── index.js          Home page script
│    └── main.js           Whiteboard logic
├── pages/
    ├── index.html        Home page (start here)
    └── whiteboard.html   The whiteboard itself
```

---

## What you can do on the board

**Draw**
- Pen, highlighter and eraser
- Line, arrow, rectangle (with rounded corners), ellipse, triangle, diamond and star
- Dashed and dotted strokes
- Hold **Shift** while drawing for straight 45° lines and perfect squares and circles

**Text and images**
- Click with the Text tool to type. Double-click text to edit it.
- Bold, italic and font size
- Upload an image, drag and drop one onto the board, or paste it

**Style with exact numbers**
- Stroke and fill colors set separately, with a color picker, hex field, swatches and an eyedropper
- Opacity as a percentage
- Width, corner radius, font size and rotation
- X, Y, width and height of the selected object

**Edit**
- Select, move and resize objects
- Layers panel: bring forward or backward, duplicate, delete, rename, hide and lock
- Undo and redo
- Copy, cut and paste
- Nudge with the arrow keys (hold Shift for bigger steps)

**Move around**
- Hand tool to drag the canvas around
- Zoom tool: click to zoom in, Alt or Shift-click to zoom out, or drag a box to zoom to that area
- Mouse wheel zoom and a live zoom percentage you can type into
- Dots, grid or plain background, plus snap to grid

**Save and share**
- Autosaves in your browser as you work
- Export **PNG**, **JPEG** or **JSON**, or copy the board as an image
- Open a saved JSON file later to keep editing
- Light and dark mode, and fullscreen

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `V` | Select |
| `H` | Hand (move the canvas) |
| `Z` | Zoom |
| `P` | Pen |
| `K` | Highlighter |
| `E` | Eraser |
| `L` / `A` | Line / Arrow |
| `R` / `O` | Rectangle / Ellipse |
| `G` / `D` / `S` | Triangle / Diamond / Star |
| `T` | Text |
| `Space` + drag | Pan (works with any tool) |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+C` / `X` / `V` | Copy / Cut / Paste |
| `Ctrl+D` | Duplicate |
| `Ctrl+S` | Save as JSON file |
| `Delete` | Remove the selected object |
| `?` | Show the shortcut list |

On a Mac, use `Cmd` in place of `Ctrl`.

---

## How it works

The most important idea in the project is simple: **nothing is drawn and forgotten.** Every shape, stroke and piece of text is stored as an object in one array, for example:

```js
{ id: 4, type: "rect", x: 120, y: 80, w: 200, h: 100, color: "#2563eb", fill: true }
```

Whenever something changes, the canvas is cleared and redrawn from that array. That single decision is what makes the rest possible:

- **Undo and redo** are snapshots of the array.
- **Selection, moving and resizing** just edit an object's numbers.
- **Layers** are the order of the array.
- **Saving** is writing the array to `localStorage` or to a JSON file.

The main pieces in `js/main.js`:

| Part | Job |
|---|---|
| Geometry | Bounds, hit-testing, move, resize and rotation |
| Rendering | `draw()` and `render()` repaint everything from the array |
| History | Undo and redo stacks |
| Storage | Autosave, JSON save and open, PNG and JPEG export |
| Pointer input | Pointer Events, so mouse, touch and pen all work the same way |
| Properties panel | Number and color fields that edit the selected object |

---

## Tech stack

- **HTML** for the page, toolbar and `<canvas>`
- **CSS** for layout and styling
- **JavaScript** with the Canvas 2D API, Pointer Events, `localStorage` and `canvas.toBlob()`

---

## Good to know

- **Works best in a current Chrome, Edge, Firefox or Safari.** Rounded rectangles need a recent browser. The eyedropper is only available in Chromium browsers, and the button hides itself elsewhere.
- **Your board lives in your browser.** Clearing site data removes it, so use **Save JSON** for anything you want to keep.
- **Big images can fill the browser's storage.** Images are shrunk to at most 1200 px when added. If storage runs out, the sidebar tells you to save a JSON file.
- **Copy image** may be blocked on plain `file://` pages. Run it from a local server if that happens.
- On narrow phone screens the layers and properties panel is hidden to leave room for drawing.

---

## Ideas for later

- Select several objects at once, plus group and align
- Flip and crop images
- Pressure-sensitive pen for stylus users
- Connectors that stick to shapes
- Text inside shapes and sticky notes
- SVG and PDF export
- Multiple pages or boards
- Templates for flowcharts and mind maps
- Real-time collaboration (this would need a backend)

---

## Credits

Made by Krish as a hands-on way to learn JavaScript, the Canvas API and front-end structure. Logo and branding are part of the SketchFlow Learn project.
