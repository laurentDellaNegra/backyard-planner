# Backyard Planner

A single-file React backyard planning app for drawing property boundaries, shapes, labels, dimensions, and simple measurements in meters.

The app is contained in `index.html`. Startup restores browser `localStorage` when present, otherwise it opens a blank editable project. Use the `Load Plan v1` button to load `plans/plan-terrain-v1.json` manually.

## Run

Serve the folder locally or publish it with GitHub Pages, then open `index.html` in a browser with internet access. The app loads React, ReactDOM, and Babel from CDNs, and the Plan v1 button fetches from the relative `plans/` path.
