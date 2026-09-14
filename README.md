# Backyard Planner

A React/TypeScript backyard planning app for drawing property boundaries, shapes, labels, dimensions, and simple measurements in meters.

Startup restores browser `localStorage` when present, otherwise it opens a blank editable project. Use the `Load Plan v1` button to load `public/plans/plan-terrain-v1.json` manually.

To see interior angles, select a closed polygon or the property boundary and enable **Dimensions → Show angle labels** in the inspector. Each corner updates live as you drag vertices or edit coordinates, including angles greater than 180° at concave corners. You can hide individual angles or drag their labels. Angle labels start off, follow the existing dimension/measurement visibility controls, and are saved in JSON and included in PNG exports when visible. Undefined angles on invalid polygons display “—”.

## Run

```sh
npm install
npm run dev
```

## Verify

```sh
npm run typecheck
npm run test
npm run build
```

The Vite config uses `base: "./"` so the built app can run from a GitHub Pages project path. Static files in `public/` are served from the site root, so the Plan v1 button fetches `plans/plan-terrain-v1.json`.

## Deploy

GitHub Pages is deployed by `.github/workflows/deploy-pages.yml`. Do not configure Pages to serve the repository root directly; the root `index.html` is the Vite development shell and must be built first. The workflow builds `dist/` and publishes it to the `gh-pages` branch.
