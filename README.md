# Backyard Planner

A React/TypeScript backyard planning app for drawing property boundaries, shapes, labels, dimensions, and simple measurements in meters.

Startup restores browser `localStorage` when present, otherwise it opens a blank editable project. Use the `Load Plan v1` button to load `public/plans/plan-terrain-v1.json` manually.

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
