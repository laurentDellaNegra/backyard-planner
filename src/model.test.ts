import { describe, expect, it } from "vitest";
import {
  applySnapping,
  appReducer,
  circlePerimeter,
  createObjectForTool,
  deleteSegmentFromObject,
  initialUi,
  makeInitialProject,
  mToPx,
  normalizedProject,
  objectMeasurementItems,
  pathLength,
  polygonArea,
  polygonInteriorAngles,
  polygonPerimeter,
  polygonSelfIntersects,
  pxToM,
  rectArea,
  renderMeasurementsAsSvg,
  round1,
  type HistoryState,
  type PolygonObject,
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

describe("polygon angle labels", () => {
  const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
  const polygon = (): PolygonObject => ({
    ...createObjectForTool("polygon", square) as PolygonObject,
    showAngles: true,
  });
  const angleItems = (object: PolygonObject, visibleOnly = true) =>
    objectMeasurementItems(object, visibleOnly).filter(item => item.id.startsWith("angle-"));

  it("measures every corner of quadrilaterals and triangles in either winding", () => {
    const quadrilateral = [...square.slice(0, 3), { x: 0, y: 2 }];
    const triangle = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }];
    expect(polygonInteriorAngles(square)).toEqual([90, 90, 90, 90]);
    expect(polygonInteriorAngles(quadrilateral).map(angle => round1(angle!))).toEqual([90, 90, 63.4, 116.6]);
    expect(polygonInteriorAngles([...quadrilateral].reverse()).map(angle => round1(angle!))).toEqual([116.6, 63.4, 90, 90]);
    expect(polygonInteriorAngles(triangle)).toEqual([90, 45, 45]);
    expect(polygonInteriorAngles([...triangle].reverse())).toEqual([45, 45, 90]);
    expect(angleItems({ ...polygon(), points: triangle }).map(item => item.value)).toEqual(["90.0°", "45.0°", "45.0°"]);
  });

  it("preserves reflex angles at concave vertices and straight angles at collinear vertices", () => {
    const concave = [...square.slice(0, 3), { x: 2, y: 2 }, square[3]];
    const collinear = [square[0], { x: 2, y: 0 }, ...square.slice(1)];
    expect(polygonInteriorAngles(concave)).toEqual([90, 90, 45, 270, 45]);
    expect(polygonInteriorAngles([...concave].reverse())).toEqual([45, 270, 45, 90, 90]);
    expect(polygonInteriorAngles(collinear)).toEqual([90, 180, 90, 90, 90]);
    expect(angleItems({ ...polygon(), points: concave })[3].value).toBe("270.0°");
  });

  it("shows undefined angles without NaN when geometry becomes invalid during editing", () => {
    const crossed = [square[0], square[2], square[1], square[3]];
    const flat = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }];
    expect(polygonInteriorAngles(crossed)).toEqual([null, null, null, null]);
    expect(polygonInteriorAngles(flat)).toEqual([null, null, null]);
    expect(polygonInteriorAngles(square.slice(0, 2))).toEqual([null, null]);
    const duplicate = { ...polygon(), points: [square[0], square[0], ...square.slice(1)] };
    expect(polygonInteriorAngles(duplicate.points)).toContain(null);
    const items = angleItems(duplicate);
    expect(items.some(item => item.value === "—")).toBe(true);
    expect(items.every(item => !/NaN|Infinity/.test(item.value) && Number.isFinite(item.point.x) && Number.isFinite(item.point.y))).toBe(true);
  });

  it("derives live angle values during a drag and restores them with undo and redo", () => {
    const object = polygon();
    const beforeProject = { ...makeInitialProject(), objects: [object] };
    let state: HistoryState = { project: beforeProject, past: [], future: [], ui: initialUi };
    const values = () => angleItems(state.project.objects[0] as PolygonObject).map(item => item.value);
    state = appReducer(state, {
      type: "PROJECT_TRANSIENT",
      project: { ...beforeProject, objects: [{ ...object, points: [...square.slice(0, 3), { x: 0, y: 2 }] }] },
    });
    expect(values()).toEqual(["90.0°", "90.0°", "63.4°", "116.6°"]);
    expect(state.past).toHaveLength(0);
    state = appReducer(state, { type: "PROJECT_COMMIT_FROM", beforeProject });
    expect(state.past).toHaveLength(1);
    state = appReducer(state, { type: "UNDO" });
    expect(values()).toEqual(["90.0°", "90.0°", "90.0°", "90.0°"]);
    state = appReducer(state, { type: "REDO" });
    expect(values()).toEqual(["90.0°", "90.0°", "63.4°", "116.6°"]);
  });

  it("respects angle, individual-label, and object measurement visibility", () => {
    const object = polygon();
    expect(angleItems(object).map(item => item.id)).toEqual(["angle-0", "angle-1", "angle-2", "angle-3"]);
    expect(angleItems({ ...object, showAngles: false })).toEqual([]);
    expect(angleItems({ ...object, showAngles: false }, false)).toHaveLength(4);
    expect(objectMeasurementItems({ ...object, measurementHidden: true })).toEqual([]);
    expect(angleItems({ ...object, hiddenMeasurements: ["angle-1"] }).map(item => item.id)).toEqual(["angle-0", "angle-2", "angle-3"]);
    expect(angleItems({ ...object, measurementHidden: true, hiddenMeasurements: ["angle-1"] }, false)).toHaveLength(4);
    expect(objectMeasurementItems({ ...object, showAngles: false })).toHaveLength(5);
    const line = createObjectForTool("line", square)!;
    expect(objectMeasurementItems(line, false).some(item => item.id.startsWith("angle-"))).toBe(false);
  });

  it("keeps dragged angle-label offsets and visibility in exported measurements", () => {
    const object = polygon();
    const original = angleItems(object)[0];
    const moved = { ...object, measurementOffsets: { "angle-0": { x: 1.2, y: -2.3 } }, hiddenMeasurements: ["angle-1"] };
    const item = angleItems(moved)[0];
    expect(item.point.x).toBeCloseTo(original.point.x + 1.2);
    expect(item.point.y).toBeCloseTo(original.point.y - 2.3);
    const svg = renderMeasurementsAsSvg(moved);
    expect(svg.match(/90\.0°/g)).toHaveLength(3);
    expect(svg).toContain(`x="${mToPx(item.point.x)}" y="${mToPx(item.point.y)}"`);
    expect(renderMeasurementsAsSvg({ ...moved, showAngles: false })).not.toContain("°");
    expect(renderMeasurementsAsSvg({ ...moved, measurementHidden: true })).toBe("");
  });

  it("defaults new and legacy polygons to hidden angles and preserves enabled labels in JSON", () => {
    expect((makeInitialProject().objects[0] as PolygonObject).showAngles).toBe(false);
    expect((createObjectForTool("polygon", square) as PolygonObject).showAngles).toBe(false);
    const object = { ...polygon(), hiddenMeasurements: ["angle-2"], measurementOffsets: { "angle-0": { x: 1.2, y: 0.4 } } };
    const project = { ...makeInitialProject(), objects: [object] };
    const restored = normalizedProject(JSON.parse(JSON.stringify(project))).objects[0] as PolygonObject;
    expect(restored.showAngles).toBe(true);
    expect(angleItems(restored)).toEqual(angleItems(object));
    const { showAngles: _showAngles, ...legacy } = object;
    const imported = normalizedProject({ ...project, objects: [legacy] }).objects[0] as PolygonObject;
    expect(imported.showAngles).toBe(false);
    expect(angleItems(imported)).toEqual([]);
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
