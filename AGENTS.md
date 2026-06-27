# Backyard Planner Agent Guide

This repo currently ships a **single-file React/TypeScript backyard planner**. Keep this file focused on the facts an agent needs before editing.

## Current Project Shape

- Main app: `index.html`
- Starter plan: `plans/plan-terrain-v1.json`
- Documentation: `README.md`
- Delivery format: one self-contained HTML file.
- Runtime: React 18 UMD, ReactDOM 18 UMD, Babel Standalone from CDNs.
- App script: inline TypeScript/TSX in `<script id="app-source" type="text/plain">`, transformed at runtime by Babel.
- Rendering: SVG editor surface.
- Persistence: browser `localStorage`, manual static plan loading, editable JSON import/export, SVG-to-canvas PNG export.

Do not split the app into multiple files, add a build system, or migrate to Vite unless the user explicitly asks for that.

The file needs an internet-connected browser on first load because React and Babel are loaded from CDNs.

## Product Scope

Backyard Planner is a desktop/laptop planning tool in meters. It is intended for accurate-enough homeowner planning, not CAD, legal, survey, permit, or construction-grade work.

In scope:

- Edit a bounded property boundary.
- Draw and edit rectangles, polygons, lines/polylines, circles, freehand sketches, and text labels.
- Edit geometry visually and numerically.
- Rotate objects where supported.
- Add object labels and draggable measurement labels.
- Snap to grid, vertices, edges, midpoints, and orthogonal alignment.
- Show derived measurements, quantities, layers, visibility, locking, undo/redo, local save, JSON import/export, and PNG export.

Out of scope unless requested:

- Backend, accounts, cloud sync, collaboration.
- Mobile-first editing.
- AI design generation.
- Satellite/property imports.
- 3D, AR, plant database, costing, CAD/DXF, permit/code compliance, irrigation/electrical planning.

## UX Invariants

- First screen is the editor, not a landing page.
- New project starts as a `100.0 m x 100.0 m` workspace.
- New project contains only the editable property boundary rectangle.
- Use meters only; keep model geometry in meters, not pixels.
- Display/edit distances with at most one decimal place.
- Keep the dense desktop layout: top toolbar, left tool palette, SVG workspace, right inspector, bottom status bar.
- Keep icon buttons accessible with labels/tooltips and visible focus states.
- Do not add sample/demo plan content.
- Do not leave placeholder controls. Buttons should work or be removed.

## Current Data Model

The source of truth is the typed project model inside `index.html`. Keep measurements derived from geometry helpers; do not store calculated area/perimeter/length totals on objects.

Key types:

```ts
type Point = { x: number; y: number };
type Layer = { id: string; name: string; visible: boolean; locked: boolean; order: number };
type Style = { fill: string; stroke: string; strokeWidth: number; opacity: number; dash?: string };
type ObjectType = "polygon" | "rectangle" | "circle" | "polyline" | "label";
type ObjectKind = "property" | "polygon" | "rectangle" | "circle" | "line" | "sketch" | "label" | "area";
type Tool = "select" | "pan" | "property" | "polygon" | "line" | "rect" | "circle" | "sketch" | "label";
```

`CommonObject` currently includes optional `rotation`, `measurementHidden`, `hiddenMeasurements`, `measurementOffsets`, and `objectLabel`.

Default layers:

1. `property` - Property
2. `shapes` - Shapes
3. `text` - Text

Plan loading and autosave keys:

```ts
const STARTER_PROJECT_URL = "plans/plan-terrain-v1.json";
const STORAGE_KEY = "backyard-planner-single-file-v1";
```

Keep the storage key unless the user explicitly accepts losing/migrating existing browser autosaves. Keep the plan URL relative so the manual `Load Plan v1` button works under GitHub Pages project paths.

## State Rules

Project mutations should go through `appReducer`.

Important action patterns:

- `PROJECT_APPLY`: committed project change; pushes undo history.
- `PROJECT_TRANSIENT`: live drag/update preview; does not push history.
- `PROJECT_COMMIT_FROM`: commits a drag/edit using a captured `beforeProject`.
- `SET_UI`: transient UI state such as viewport, selection, drag state, status.
- `SET_TOOL`: changes active tool and cancels drawing.
- `UNDO` / `REDO`: restore project snapshots.
- `NEW_PROJECT`: resets to `makeInitialProject()`.
- `IMPORT_PROJECT`: normalizes imported JSON and replaces the project.

History limit is `HISTORY_LIMIT = 80`. Keep undo/redo limited to meaningful project mutations, not hover, pan, zoom, or pointer state.

When changing schema or object fields, update `normalizedProject()` so older exported JSON keeps loading.

## Source Map

Line numbers drift; use `rg` first.

- CSS/layout: top `<style>` block.
- Type definitions and constants: near `type Point`, `PX_PER_M`, `HISTORY_LIMIT`, `STORAGE_KEY`.
- Geometry helpers: `polygonArea`, `pathLength`, `rotatePointAround`, hit testing, transforms.
- Defaults: `defaultLayers`, `KIND_LABELS`, `KIND_LAYER`, `KIND_STYLE`.
- Initial project: `makeInitialProject()`.
- Import normalization: `normalizedProject()`.
- Startup loading: `loadInitialProject()` restores `localStorage` or creates a blank project.
- Manual Plan v1 loading: `loadStarterProject()` fetches `plans/plan-terrain-v1.json`.
- Object creation: `createObjectForTool()`.
- Snapping: `collectSnapTargets()` and `applySnapping()`.
- Quantities and measurements: `objectMeasurements()`, `objectMeasurementItems()`, `deriveQuantities()`.
- Export: `downloadText()` and `exportProjectPng()`.
- Built-in tests: `runGeometryTests()`.
- Reducer/history: `appReducer()`.
- UI: `TopToolbar()`, `TOOL_GROUPS`, `ToolPalette()`, `SvgWorkspace()`, `PropertiesInspector()`, `StatusBar()`, `ChecklistModal()`, `App()`.

## Geometry And Snapping

- `PX_PER_M = 10`; keep conversions centralized through `mToPx()` and `pxToM()`.
- Use `round1()` and `fmtM()` / `fmtM2()` for one-decimal UI.
- Snapping is implemented in `applySnapping(project, point, context)`.
- Current snap modes: grid, vertices, midpoints, edges, and orthogonal alignment.
- Exclude selected/self objects from snap targets where appropriate so edits do not fight themselves.
- Keep invalid polygon feedback non-destructive. Do not silently delete user geometry.

PNG export must exclude editor-only overlays:

- Selection and hover outlines.
- Handles.
- Snap guides.
- Editor chrome.

Only visible plan objects and enabled measurement labels should appear in exported PNGs.

## Current Tools And Shortcuts

Tool palette:

- Select/move
- Pan
- Property boundary
- Rectangle
- Polygon
- Line/polyline
- Circle
- Sketch/freehand line
- Text

Keyboard shortcuts:

- `V`: Select
- `P`: Polygon
- `L`: Line
- `R`: Rectangle
- `C`: Circle
- `T`: Text
- `Space`: Pan
- `Esc`: cancel drawing or clear selection
- `Delete` / `Backspace`: delete selected object, vertex, or segment where valid
- Arrow keys: nudge selected editable objects
- `Shift` + arrow: larger nudge
- `Ctrl/Cmd+Z`: undo
- `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y`: redo

Do not trigger drawing shortcuts while focus is inside inputs, selects, or textareas.

## Verification

After meaningful changes:

1. Open `index.html` in a browser with DevTools open.
2. Confirm there are no console/runtime errors from Babel/React.
3. Run the built-in geometry tests from the UI and fix failures.
4. Smoke-test the edited workflow manually.

Manual QA checklist from the app:

1. Create a new project and confirm the `100.0 m x 100.0 m` workspace opens with only the property boundary.
2. Edit the property boundary using vertex handles and midpoint insertion.
3. Draw a rectangle, then resize it visually and numerically.
4. Add polygon, rectangle, line, circle, hand-drawn line, and text objects.
5. Edit dimensions, coordinates, vertices, segments, object label, text, layer, lock state, and color in the inspector.
6. Toggle grid, measurement labels, grid snap, vertex snap, edge snap, midpoint snap, and orthogonal snapping.
7. Verify undo/redo with toolbar buttons and `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+Y`.
8. Hide and lock layers, then confirm hidden layers disappear and locked layers cannot be edited.
9. Reload the page and verify `localStorage` autosave restores the plan.
10. Export JSON, reset/new project, import JSON, and confirm editable objects are restored.
11. Export PNG with measurements on, then turn measurements off and export again; selection handles and editor chrome should not appear.

For small documentation-only edits, a static check such as `python3 -m html.parser index.html` is enough if `index.html` was not changed.

## Editing Guidance

- Make surgical edits in `index.html`; avoid unrelated refactors.
- Preserve existing naming and local patterns.
- Keep all derived measurements in helpers.
- Preserve layer visibility/locking semantics in rendering, hit testing, and editing.
- Preserve property boundary editability and selection.
- Keep browser verification in mind because TypeScript is transpiled in-browser.
- If a future Vite migration is requested, preserve behavior first, then extract modules and tests.

Suggested Vite structure only if migration is explicitly requested:

```txt
src/
  App.tsx
  main.tsx
  styles.css
  types/project.ts
  state/
  geometry/
  components/
  export/
```
