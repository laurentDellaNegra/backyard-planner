import { describe, expect, it } from "vitest";
import {
  applySnapping,
  circlePerimeter,
  deleteSegmentFromObject,
  makeInitialProject,
  mToPx,
  normalizedProject,
  pathLength,
  polygonArea,
  polygonPerimeter,
  polygonSelfIntersects,
  pxToM,
  rectArea,
  round1,
  type PolylineObject,
} from "./model";

describe("geometry helpers", () => {
  it("converts between meters and pixels", () => {
    expect(mToPx(3.2)).toBe(32);
    expect(pxToM(25)).toBe(2.5);
  });

  it("rounds to one decimal place", () => {
    expect(round1(12.34)).toBe(12.3);
    expect(round1(12.35)).toBe(12.4);
  });

  it("measures polygons and paths", () => {
    expect(round1(polygonPerimeter([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }]))).toBe(12);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toBe(100);
    expect(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 4 }])).toBe(8);
  });

  it("detects self-intersection", () => {
    expect(polygonSelfIntersects([{ x: 0, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 4, y: 0 }])).toBe(true);
  });

  it("keeps current snap behavior", () => {
    expect(applySnapping(makeInitialProject(), { x: 4.88, y: 5.11 }, {}).point.x).toBe(5);
    expect(applySnapping(makeInitialProject(), { x: 10.2, y: 25 }, { base: { x: 10, y: 10 } }).point.x).toBe(10);
  });

  it("deletes a segment without invalidating line minimum points", () => {
    const line: PolylineObject = {
      type: "polyline",
      id: "line",
      kind: "line",
      name: "Line",
      layerId: "shapes",
      locked: false,
      visible: true,
      style: { fill: "none", stroke: "#334155", strokeWidth: 0.22, opacity: 0.95 },
      z: 0,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
    };

    const next = deleteSegmentFromObject(line, 0);

    expect(next?.type).toBe("polyline");
    const nextLine = next as PolylineObject;
    expect(nextLine.points).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(deleteSegmentFromObject(nextLine, 0)).toBeNull();
  });
});

describe("project normalization", () => {
  it("normalizes imported projects and forces meter units", () => {
    const project = normalizedProject({
      id: "imported",
      name: "Imported",
      workspace: { widthM: 20, heightM: 15 },
      units: "ft",
      objects: [],
      settings: { showGrid: false },
    });

    expect(project.units).toBe("m");
    expect(project.layers.map(layer => layer.id)).toEqual(["property", "shapes", "text"]);
    expect(project.settings.showGrid).toBe(false);
  });

  it("keeps existing rectangle area math stable", () => {
    expect(rectArea({
      type: "rectangle",
      id: "rect",
      kind: "rectangle",
      name: "Rectangle",
      layerId: "shapes",
      locked: false,
      visible: true,
      style: { fill: "#64748b", stroke: "#64748b", strokeWidth: 0.14, opacity: 0.72 },
      z: 0,
      x: 0,
      y: 0,
      width: 5,
      height: 4,
    })).toBe(20);

    expect(round1(circlePerimeter({
      type: "circle",
      id: "circle",
      kind: "circle",
      name: "Circle",
      layerId: "shapes",
      locked: false,
      visible: true,
      style: { fill: "#0ea5e9", stroke: "#0ea5e9", strokeWidth: 0.12, opacity: 0.55 },
      z: 0,
      cx: 0,
      cy: 0,
      r: 2,
    }))).toBe(12.6);
  });
});
