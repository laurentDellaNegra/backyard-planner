# Backyard Planner Agent Guide

This repo ships a Vite React/TypeScript backyard planner. Keep this file focused on the facts an agent needs before editing.

## Current Project Shape

- App entry HTML: `index.html`
- React entry: `src/main.tsx`
- Root app shell: `src/App.tsx`
- Pure model/geometry/state/export logic: `src/model.ts`
- Component files: `src/components/`
- Styles: `src/styles.css`
- Plan v1: `public/plans/plan-terrain-v1.json`
- Documentation: `README.md`
- Runtime: Vite, React 18, TypeScript.
- Rendering: SVG editor surface.
- Persistence: browser `localStorage`, manual static plan loading, editable JSON import/export, SVG-to-canvas PNG export.

Vite uses `base: "./"` so production builds work under GitHub Pages project paths.

GitHub Pages must serve the `gh-pages` branch root. The workflow in `.github/workflows/deploy-pages.yml` builds `dist/` and force-publishes it to `gh-pages`. Do not use legacy Pages from `main` branch `/`; that serves the Vite source `index.html` and breaks in browsers.

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

- `src/model.ts`: types, constants, geometry helpers, snapping, normalization, project creation, reducer/history, JSON/PNG export, built-in geometry tests.
- `src/App.tsx`: root app shell, autosave effect, keyboard shortcuts.
- `src/components/TopToolbar.tsx`: project actions, manual Plan v1 load, import/export, view/snap toggles.
- `src/components/ToolPalette.tsx`: tool definitions and palette UI.
- `src/components/SvgWorkspace.tsx`: SVG rendering, hit testing, pointer interactions, drawing previews, handles.
- `src/components/PropertiesInspector.tsx`: project/object inspector, layers, quantities, vertices/segments/style editing.
- `src/components/StatusBar.tsx`: bottom status strip.
- `src/components/ChecklistModal.tsx`: manual QA checklist.
- `src/model.test.ts`: Vitest coverage for model/geometry behavior.

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

1. Run `npm run typecheck`.
2. Run `npm run test`.
3. Run `npm run build`.
4. Smoke-test with `npm run dev` or `npm run preview`.
5. For deployment changes, confirm Pages is set to the `gh-pages` branch root, not `main` branch `/`.

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

For small documentation-only edits, no app build is required unless source files changed.

## Editing Guidance

- Make surgical edits; avoid unrelated refactors.
- Preserve existing naming and local patterns.
- Keep all derived measurements in helpers.
- Preserve layer visibility/locking semantics in rendering, hit testing, and editing.
- Preserve property boundary editability and selection.
- Keep pure logic in `src/model.ts` or split it further by domain before putting it in components.
- Keep component-specific interaction code in `src/components/`.
