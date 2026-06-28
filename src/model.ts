export type Point = { x: number; y: number };
export type Layer = { id: string; name: string; visible: boolean; locked: boolean; order: number };
export type Style = { fill: string; stroke: string; strokeWidth: number; opacity: number; dash?: string };
export type ObjectType = "polygon" | "rectangle" | "circle" | "polyline" | "label";
export type ObjectKind = "property" | "polygon" | "rectangle" | "circle" | "line" | "sketch" | "label" | "area";
export type AttachedLabel = { visible: boolean; text: string; offset: Point; fontSizeM: number };
export type CommonObject = { id: string; type: ObjectType; kind: ObjectKind; name: string; layerId: string; locked: boolean; visible: boolean; style: Style; z: number; rotation?: number; measurementHidden?: boolean; hiddenMeasurements?: string[]; measurementOffsets?: Record<string, Point>; objectLabel?: AttachedLabel };
export type PolygonObject = CommonObject & { type: "polygon"; points: Point[] };
export type RectangleObject = CommonObject & { type: "rectangle"; x: number; y: number; width: number; height: number };
export type CircleObject = CommonObject & { type: "circle"; cx: number; cy: number; r: number };
export type PolylineObject = CommonObject & { type: "polyline"; points: Point[]; widthM?: number };
export type LabelObject = CommonObject & { type: "label"; x: number; y: number; text: string; fontSizeM: number };
export type PlanObject = PolygonObject | RectangleObject | CircleObject | PolylineObject | LabelObject;
export type Project = {
  id: string;
  name: string;
  workspace: { widthM: number; heightM: number };
  units: "m";
  layers: Layer[];
  objects: PlanObject[];
  settings: {
    showGrid: boolean;
    showMeasurements: boolean;
    snapToGrid: boolean;
    snapToVertices: boolean;
    snapToEdges: boolean;
    snapToMidpoints: boolean;
    orthogonalSnap: boolean;
  };
  savedAt?: string;
};
export type Tool = "select" | "pan" | "property" | "polygon" | "line" | "rect" | "circle" | "sketch" | "label";
export type DragMode = "pan" | "move" | "vertex" | "midpoint" | "resize" | "radius" | "draw-rect" | "draw-circle" | "draw-freehand" | "select-box" | "measure-label" | "object-label";
export type MeasurementItem = { id: string; label: string; value: string; point: Point };
export type SelectedHandle = null | { objectId: string; kind: "vertex" | "segment" | "midpoint" | "resize" | "radius"; index?: number; corner?: string };
export type SnapResult = { point: Point; indicator?: { point: Point; label: string; line?: [Point, Point] } };
export type HistoryState = { project: Project; past: Project[]; future: Project[]; ui: UiState };
export type UiState = {
  tool: Tool;
  selectedIds: string[];
  hoveredId: string | null;
  selectedHandle: SelectedHandle;
  drawing: null | { tool: Tool; points: Point[]; preview?: Point; start?: Point; current?: Point };
  viewport: { scale: number; panX: number; panY: number };
  drag: null | any;
  spaceDown: boolean;
  snapIndicator?: SnapResult["indicator"];
  status: string;
  tests: { passed: number; total: number; failures: string[] };
  showChecklist: boolean;
};

export const PX_PER_M = 10;
export const HISTORY_LIMIT = 80;
export const STORAGE_KEY = "backyard-planner-single-file-v1";
export const STARTER_PROJECT_URL = "plans/plan-terrain-v1.json";
export const FREEHAND_MIN_POINT_DISTANCE_M = .2;
export const FREEHAND_MAX_POINTS = 500;

export const fmtM = (n: number) => `${round1(n).toFixed(1)} m`;
export const fmtM2 = (n: number) => `${round1(n).toFixed(1)} m²`;
export const round1 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export const mToPx = (m: number) => m * PX_PER_M;
export const pxToM = (px: number) => px / PX_PER_M;
export const pointToPx = (p: Point) => ({ x: mToPx(p.x), y: mToPx(p.y) });
export const ptsAttr = (pts: Point[]) => pts.map(p => `${mToPx(p.x)},${mToPx(p.y)}`).join(" ");
export const almost = (a: number, b: number, eps = 0.0001) => Math.abs(a - b) < eps;
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const clampPointToWorkspace = (project: Project, p: Point): Point => ({ x: round1(clamp(p.x, 0, project.workspace.widthM)), y: round1(clamp(p.y, 0, project.workspace.heightM)) });
export const normalizeRotation = (deg: number) => {
  const n = ((Number.isFinite(deg) ? deg : 0) % 360 + 360) % 360;
  return round1(n === 360 ? 0 : n);
};
export const getRotation = (o: PlanObject) => normalizeRotation(o.rotation || 0);
export const rotationDelta = (from: number, to: number) => {
  let d = normalizeRotation(to) - normalizeRotation(from);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};
export function rotatePointAround(p: Point, center: Point, degrees: number): Point {
  const rad = degrees * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = p.x - center.x, dy = p.y - center.y;
  return { x: round1(center.x + dx * cos - dy * sin), y: round1(center.y + dx * sin + dy * cos) };
}

export function polygonArea(points: Point[]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function pathLength(points: Point[], closed = false) {
  if (points.length < 2) return 0;
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) len += distance(points[i], points[i + 1]);
  if (closed && points.length > 2) len += distance(points[points.length - 1], points[0]);
  return len;
}
export const polygonPerimeter = (points: Point[]) => pathLength(points, true);
export const rectArea = (o: RectangleObject) => Math.abs(o.width * o.height);
export const rectPerimeter = (o: RectangleObject) => 2 * Math.abs(o.width) + 2 * Math.abs(o.height);
export const circleArea = (o: CircleObject) => Math.PI * o.r * o.r;
export const circlePerimeter = (o: CircleObject) => 2 * Math.PI * o.r;

export function projectPointOnSegment(p: Point, a: Point, b: Point) {
  const ab = sub(b, a);
  const ab2 = ab.x * ab.x + ab.y * ab.y;
  if (ab2 === 0) return { point: a, t: 0, dist: distance(p, a) };
  const ap = sub(p, a);
  const t = clamp((ap.x * ab.x + ap.y * ab.y) / ab2, 0, 1);
  const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  return { point: q, t, dist: distance(p, q) };
}

export function orientation(a: Point, b: Point, c: Point) {
  const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (almost(v, 0, 1e-9)) return 0;
  return v > 0 ? 1 : 2;
}
export function onSegment(a: Point, b: Point, c: Point) {
  return b.x <= Math.max(a.x, c.x) + 1e-9 && b.x + 1e-9 >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) + 1e-9 && b.y + 1e-9 >= Math.min(a.y, c.y);
}
export function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point) {
  const o1 = orientation(p1, q1, p2), o2 = orientation(p1, q1, q2), o3 = orientation(p2, q2, p1), o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}
export function polygonSelfIntersects(points: Point[]) {
  if (points.length < 4) return false;
  for (let i = 0; i < points.length; i++) {
    const a1 = points[i], a2 = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j++) {
      const b1 = points[j], b2 = points[(j + 1) % points.length];
      const adjacent = i === j || (i + 1) % points.length === j || i === (j + 1) % points.length;
      const firstLast = i === 0 && j === points.length - 1;
      if (adjacent || firstLast) continue;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}
export function polygonWarnings(points: Point[]) {
  const warnings: string[] = [];
  if (points.length < 3) warnings.push("A closed polygon needs at least 3 vertices.");
  if (polygonArea(points) < 0.1) warnings.push("Area is extremely small or zero.");
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (distance(a, b) < 0.1) warnings.push("One or more sides are too short.");
  }
  if (polygonSelfIntersects(points)) warnings.push("Polygon edges self-intersect.");
  return Array.from(new Set(warnings));
}

export function pathMinPointCount(o: PlanObject) {
  return o.type === "polygon" ? 3 : o.type === "polyline" ? 2 : 0;
}

export function pathSegmentCount(o: PlanObject) {
  if (o.type === "polygon") return o.points.length;
  if (o.type === "polyline") return Math.max(0, o.points.length - 1);
  return 0;
}

export function deleteVertexFromObject(o: PlanObject, index: number): PlanObject | null {
  if (o.type !== "polygon" && o.type !== "polyline") return null;
  const min = pathMinPointCount(o);
  if (o.points.length <= min || !Number.isInteger(index) || index < 0 || index >= o.points.length) return null;
  return { ...o, points: o.points.filter((_, i) => i !== index) } as PlanObject;
}

export function deleteSegmentFromObject(o: PlanObject, index: number): PlanObject | null {
  if (o.type !== "polygon" && o.type !== "polyline") return null;
  const min = pathMinPointCount(o);
  const segmentCount = pathSegmentCount(o);
  if (o.points.length <= min || !Number.isInteger(index) || index < 0 || index >= segmentCount) return null;
  const deleteIndex = o.type === "polyline" && index === 0 ? 0 : (index + 1) % o.points.length;
  return deleteVertexFromObject(o, deleteIndex);
}

export function boundingBoxForObject(o: PlanObject) {
  if (o.type === "rectangle") return { x: o.x, y: o.y, width: o.width, height: o.height };
  if (o.type === "circle") return { x: o.cx - o.r, y: o.cy - o.r, width: o.r * 2, height: o.r * 2 };
  if (o.type === "label") return { x: o.x, y: o.y, width: Math.max(1, o.text.length * o.fontSizeM * .45), height: o.fontSizeM };
  const points = o.points;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function rectFromPoints(a: Point, b: Point) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

export function pointInRectBounds(p: Point, rect: { x: number; y: number; width: number; height: number }) {
  return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
}

export function objectCenter(o: PlanObject): Point {
  if (o.type === "rectangle") return { x: o.x + o.width / 2, y: o.y + o.height / 2 };
  if (o.type === "circle") return { x: o.cx, y: o.cy };
  if (o.type === "label") {
    const bb = boundingBoxForObject(o);
    return { x: bb.x + bb.width / 2, y: bb.y - bb.height / 2 };
  }
  const bb = boundingBoxForObject(o);
  return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
}

export function defaultObjectLabelOffset(o: PlanObject): Point {
  const bb = boundingBoxForObject(o);
  return { x: 0, y: round1(-Math.max(1.4, bb.height / 2 + 1)) };
}

export function objectLabelPosition(o: PlanObject): Point {
  const label = o.objectLabel;
  const offset = label?.offset || defaultObjectLabelOffset(o);
  return add(objectCenter(o), offset);
}

export function localRectPoints(o: RectangleObject): Point[] {
  return [
    { x: o.x, y: o.y },
    { x: o.x + o.width, y: o.y },
    { x: o.x + o.width, y: o.y + o.height },
    { x: o.x, y: o.y + o.height },
  ];
}

export function objectSelectionPoints(o: PlanObject): Point[] {
  if (o.type === "polygon" || o.type === "polyline" || o.type === "rectangle") return getObjectVertices(o);
  if (o.type === "circle") return [
    { x: o.cx - o.r, y: o.cy - o.r },
    { x: o.cx + o.r, y: o.cy - o.r },
    { x: o.cx + o.r, y: o.cy + o.r },
    { x: o.cx - o.r, y: o.cy + o.r },
  ];
  const bb = boundingBoxForObject(o);
  const pts = [
    { x: bb.x, y: bb.y },
    { x: bb.x + bb.width, y: bb.y },
    { x: bb.x + bb.width, y: bb.y - bb.height },
    { x: bb.x, y: bb.y - bb.height },
  ];
  return pts.map(p => rotatePointAround(p, objectCenter(o), getRotation(o)));
}

export function objectInsideSelectionBox(o: PlanObject, start: Point, end: Point) {
  if (o.kind === "property") return false;
  const rect = rectFromPoints(start, end);
  const pts = objectSelectionPoints(o);
  return pts.length > 0 && pts.every(p => pointInRectBounds(p, rect));
}

export function objectTransform(o: PlanObject) {
  const rotation = getRotation(o);
  if (!rotation || o.type === "polygon" || o.type === "polyline") return "";
  const c = objectCenter(o);
  return `rotate(${rotation} ${mToPx(c.x)} ${mToPx(c.y)})`;
}

export function unrotatePointForObject(o: PlanObject, p: Point) {
  const rotation = getRotation(o);
  return rotation ? rotatePointAround(p, objectCenter(o), -rotation) : p;
}

export function rotateObject(o: PlanObject, deltaDegrees: number): PlanObject {
  const delta = Number.isFinite(deltaDegrees) ? deltaDegrees : 0;
  if (almost(delta, 0)) return o;
  const nextRotation = normalizeRotation(getRotation(o) + delta);
  if (o.type === "polygon" || o.type === "polyline") {
    const center = objectCenter(o);
    return { ...o, rotation: nextRotation, points: o.points.map(p => rotatePointAround(p, center, delta)) } as PlanObject;
  }
  return { ...o, rotation: nextRotation } as PlanObject;
}

export function setObjectRotation(o: PlanObject, rotation: number): PlanObject {
  return rotateObject(o, rotationDelta(getRotation(o), rotation));
}

export function isMeasurementVisible(o: PlanObject, id: string) {
  return !o.measurementHidden && !(o.hiddenMeasurements || []).includes(id);
}

export function measurementOffset(o: PlanObject, id: string): Point {
  const offset = o.measurementOffsets?.[id];
  return offset ? { x: round1(offset.x), y: round1(offset.y) } : { x: 0, y: 0 };
}

export function applyMeasurementOffsets(o: PlanObject, items: MeasurementItem[]) {
  return items.map(item => ({ ...item, point: add(item.point, measurementOffset(o, item.id)) }));
}

export function objectMeasurementItems(o: PlanObject, visibleOnly = true): MeasurementItem[] {
  if (o.kind === "sketch" || o.type === "label") return [];
  const items: MeasurementItem[] = [];
  if (o.type === "polygon") {
    o.points.forEach((a, i) => {
      const b = o.points[(i + 1) % o.points.length];
      items.push({ id: `seg-${i}`, label: `Segment ${i + 1}`, value: fmtM(distance(a, b)), point: midpoint(a, b) });
    });
    const bb = boundingBoxForObject(o);
    items.push({ id: "area", label: "Area", value: fmtM2(polygonArea(o.points)), point: { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 } });
  } else if (o.type === "rectangle") {
    const pts = getObjectVertices(o);
    items.push({ id: "width", label: "Width", value: fmtM(Math.abs(o.width)), point: midpoint(pts[0], pts[1]) });
    items.push({ id: "height", label: "Height", value: fmtM(Math.abs(o.height)), point: midpoint(pts[1], pts[2]) });
    items.push({ id: "area", label: "Area", value: fmtM2(rectArea(o)), point: objectCenter(o) });
  } else if (o.type === "circle") {
    items.push({ id: "diameter", label: "Diameter", value: `Ø ${fmtM(o.r * 2)}`, point: { x: o.cx, y: o.cy } });
  } else if (o.type === "polyline") {
    for (let i = 0; i < o.points.length - 1; i++) {
      items.push({ id: `seg-${i}`, label: `Segment ${i + 1}`, value: fmtM(distance(o.points[i], o.points[i + 1])), point: midpoint(o.points[i], o.points[i + 1]) });
    }
    const last = o.points[o.points.length - 1];
    if (last) items.push({ id: "length", label: "Total length", value: fmtM(pathLength(o.points)), point: { x: last.x, y: last.y - .8 } });
  }
  const positioned = applyMeasurementOffsets(o, items);
  return visibleOnly ? positioned.filter(item => isMeasurementVisible(o, item.id)) : positioned;
}

export function getObjectVertices(o: PlanObject): Point[] {
  if (o.type === "polygon" || o.type === "polyline") return o.points;
  if (o.type === "rectangle") return localRectPoints(o).map(p => rotatePointAround(p, objectCenter(o), getRotation(o)));
  if (o.type === "circle") return [
    { x: o.cx, y: o.cy }, { x: o.cx + o.r, y: o.cy }, { x: o.cx - o.r, y: o.cy }, { x: o.cx, y: o.cy + o.r }, { x: o.cx, y: o.cy - o.r }
  ];
  return [{ x: o.x, y: o.y }];
}

export function getObjectEdges(o: PlanObject): [Point, Point][] {
  if (o.type === "polygon") return o.points.map((p, i) => [p, o.points[(i + 1) % o.points.length]] as [Point, Point]);
  if (o.type === "polyline") return o.points.slice(0, -1).map((p, i) => [p, o.points[i + 1]] as [Point, Point]);
  if (o.type === "rectangle") {
    const pts = getObjectVertices(o);
    return pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as [Point, Point]);
  }
  return [];
}

export function pointInPolygon(p: Point, pts: Point[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function hitTestObject(o: PlanObject, p: Point, toleranceM = .35) {
  if (!o.visible) return false;
  if (o.type === "polygon") {
    if (o.kind !== "property" && pointInPolygon(p, o.points)) return true;
    return getObjectEdges(o).some(([a,b]) => projectPointOnSegment(p,a,b).dist <= toleranceM);
  }
  if (o.type === "rectangle") {
    const local = unrotatePointForObject(o, p);
    const minX = Math.min(o.x, o.x + o.width), maxX = Math.max(o.x, o.x + o.width);
    const minY = Math.min(o.y, o.y + o.height), maxY = Math.max(o.y, o.y + o.height);
    return local.x >= minX - toleranceM && local.x <= maxX + toleranceM && local.y >= minY - toleranceM && local.y <= maxY + toleranceM;
  }
  if (o.type === "circle") return distance(p, { x: o.cx, y: o.cy }) <= o.r + toleranceM;
  if (o.type === "polyline") return getObjectEdges(o).some(([a,b]) => projectPointOnSegment(p,a,b).dist <= Math.max(toleranceM, (o.widthM || 0) / 2));
  if (o.type === "label") {
    const local = unrotatePointForObject(o, p);
    const bb = boundingBoxForObject(o);
    return local.x >= bb.x - .2 && local.x <= bb.x + bb.width + .2 && local.y >= bb.y - bb.height - .2 && local.y <= bb.y + .4;
  }
  return false;
}

export function moveObject(o: PlanObject, dx: number, dy: number): PlanObject {
  const copy: any = deepClone(o);
  if (copy.type === "polygon" || copy.type === "polyline") copy.points = copy.points.map((p: Point) => ({ x: round1(p.x + dx), y: round1(p.y + dy) }));
  if (copy.type === "rectangle") { copy.x = round1(copy.x + dx); copy.y = round1(copy.y + dy); }
  if (copy.type === "circle") { copy.cx = round1(copy.cx + dx); copy.cy = round1(copy.cy + dy); }
  if (copy.type === "label") { copy.x = round1(copy.x + dx); copy.y = round1(copy.y + dy); }
  return copy;
}

export function resizeRectangleFromCorner(o: RectangleObject, corner: string, p: Point): RectangleObject {
  let x1 = o.x, y1 = o.y, x2 = o.x + o.width, y2 = o.y + o.height;
  if (corner.includes("w")) x1 = p.x;
  if (corner.includes("e")) x2 = p.x;
  if (corner.includes("n")) y1 = p.y;
  if (corner.includes("s")) y2 = p.y;
  const nx = Math.min(x1, x2), ny = Math.min(y1, y2);
  return { ...o, x: round1(nx), y: round1(ny), width: round1(Math.abs(x2 - x1)), height: round1(Math.abs(y2 - y1)) };
}

export function objectMeasurements(o: PlanObject) {
  if (o.type === "polygon") return { area: polygonArea(o.points), perimeter: polygonPerimeter(o.points) };
  if (o.type === "rectangle") return { area: rectArea(o), perimeter: rectPerimeter(o), width: Math.abs(o.width), height: Math.abs(o.height) };
  if (o.type === "circle") return { area: circleArea(o), perimeter: circlePerimeter(o), diameter: o.r * 2 };
  if (o.type === "polyline") {
    const length = pathLength(o.points);
    return { length };
  }
  return {};
}

export function defaultLayers(): Layer[] {
  return [
    { id: "property", name: "Property", visible: true, locked: false, order: 0 },
    { id: "shapes", name: "Shapes", visible: true, locked: false, order: 1 },
    { id: "text", name: "Text", visible: true, locked: false, order: 2 },
  ];
}

export const KIND_LABELS: Record<ObjectKind, string> = {
  property: "Property boundary", polygon: "Polygon", rectangle: "Rectangle", circle: "Circle", line: "Line", sketch: "Hand-drawn line", label: "Text", area: "Polygon"
};
export const KIND_LAYER: Record<ObjectKind, string> = {
  property: "property", polygon: "shapes", rectangle: "shapes", circle: "shapes", line: "shapes", sketch: "shapes", label: "text", area: "shapes"
};
export const KIND_STYLE: Record<ObjectKind, Style> = {
  property: { fill: "rgba(15,23,42,0.04)", stroke: "#0f172a", strokeWidth: .18, opacity: 1, dash: "8 5" },
  polygon: { fill: "#22c55e", stroke: "#22c55e", strokeWidth: .12, opacity: .58 },
  rectangle: { fill: "#64748b", stroke: "#64748b", strokeWidth: .14, opacity: .72 },
  circle: { fill: "#0ea5e9", stroke: "#0ea5e9", strokeWidth: .12, opacity: .55 },
  line: { fill: "none", stroke: "#334155", strokeWidth: .22, opacity: .95 },
  sketch: { fill: "none", stroke: "#1f2937", strokeWidth: .16, opacity: .95 },
  label: { fill: "#0f172a", stroke: "#0f172a", strokeWidth: .05, opacity: 1 },
  area: { fill: "#22c55e", stroke: "#22c55e", strokeWidth: .12, opacity: .58 },
};

export const TAILWIND_PALETTE = [
  { name:"slate", shades:["#f8fafc","#f1f5f9","#e2e8f0","#cbd5e1","#94a3b8","#64748b","#475569","#334155","#1e293b","#0f172a","#020617"] },
  { name:"gray", shades:["#f9fafb","#f3f4f6","#e5e7eb","#d1d5db","#9ca3af","#6b7280","#4b5563","#374151","#1f2937","#111827","#030712"] },
  { name:"zinc", shades:["#fafafa","#f4f4f5","#e4e4e7","#d4d4d8","#a1a1aa","#71717a","#52525b","#3f3f46","#27272a","#18181b","#09090b"] },
  { name:"neutral", shades:["#fafafa","#f5f5f5","#e5e5e5","#d4d4d4","#a3a3a3","#737373","#525252","#404040","#262626","#171717","#0a0a0a"] },
  { name:"stone", shades:["#fafaf9","#f5f5f4","#e7e5e4","#d6d3d1","#a8a29e","#78716c","#57534e","#44403c","#292524","#1c1917","#0c0a09"] },
  { name:"red", shades:["#fef2f2","#fee2e2","#fecaca","#fca5a5","#f87171","#ef4444","#dc2626","#b91c1c","#991b1b","#7f1d1d","#450a0a"] },
  { name:"orange", shades:["#fff7ed","#ffedd5","#fed7aa","#fdba74","#fb923c","#f97316","#ea580c","#c2410c","#9a3412","#7c2d12","#431407"] },
  { name:"amber", shades:["#fffbeb","#fef3c7","#fde68a","#fcd34d","#fbbf24","#f59e0b","#d97706","#b45309","#92400e","#78350f","#451a03"] },
  { name:"yellow", shades:["#fefce8","#fef9c3","#fef08a","#fde047","#facc15","#eab308","#ca8a04","#a16207","#854d0e","#713f12","#422006"] },
  { name:"lime", shades:["#f7fee7","#ecfccb","#d9f99d","#bef264","#a3e635","#84cc16","#65a30d","#4d7c0f","#3f6212","#365314","#1a2e05"] },
  { name:"green", shades:["#f0fdf4","#dcfce7","#bbf7d0","#86efac","#4ade80","#22c55e","#16a34a","#15803d","#166534","#14532d","#052e16"] },
  { name:"emerald", shades:["#ecfdf5","#d1fae5","#a7f3d0","#6ee7b7","#34d399","#10b981","#059669","#047857","#065f46","#064e3b","#022c22"] },
  { name:"teal", shades:["#f0fdfa","#ccfbf1","#99f6e4","#5eead4","#2dd4bf","#14b8a6","#0d9488","#0f766e","#115e59","#134e4a","#042f2e"] },
  { name:"cyan", shades:["#ecfeff","#cffafe","#a5f3fc","#67e8f9","#22d3ee","#06b6d4","#0891b2","#0e7490","#155e75","#164e63","#083344"] },
  { name:"sky", shades:["#f0f9ff","#e0f2fe","#bae6fd","#7dd3fc","#38bdf8","#0ea5e9","#0284c7","#0369a1","#075985","#0c4a6e","#082f49"] },
  { name:"blue", shades:["#eff6ff","#dbeafe","#bfdbfe","#93c5fd","#60a5fa","#3b82f6","#2563eb","#1d4ed8","#1e40af","#1e3a8a","#172554"] },
  { name:"indigo", shades:["#eef2ff","#e0e7ff","#c7d2fe","#a5b4fc","#818cf8","#6366f1","#4f46e5","#4338ca","#3730a3","#312e81","#1e1b4b"] },
  { name:"violet", shades:["#f5f3ff","#ede9fe","#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed","#6d28d9","#5b21b6","#4c1d95","#2e1065"] },
  { name:"purple", shades:["#faf5ff","#f3e8ff","#e9d5ff","#d8b4fe","#c084fc","#a855f7","#9333ea","#7e22ce","#6b21a8","#581c87","#3b0764"] },
  { name:"fuchsia", shades:["#fdf4ff","#fae8ff","#f5d0fe","#f0abfc","#e879f9","#d946ef","#c026d3","#a21caf","#86198f","#701a75","#4a044e"] },
  { name:"pink", shades:["#fdf2f8","#fce7f3","#fbcfe8","#f9a8d4","#f472b6","#ec4899","#db2777","#be185d","#9d174d","#831843","#500724"] },
  { name:"rose", shades:["#fff1f2","#ffe4e6","#fecdd3","#fda4af","#fb7185","#f43f5e","#e11d48","#be123c","#9f1239","#881337","#4c0519"] },
].flatMap(group => group.shades.map((value, index) => ({ name: `${group.name}-${[50,100,200,300,400,500,600,700,800,900,950][index]}`, value })));

export function genericKindForObject(o: any): ObjectKind {
  if (o?.kind === "property") return "property";
  if (o?.kind === "sketch") return "sketch";
  if (o?.type === "label" || o?.kind === "label") return "label";
  if (o?.type === "rectangle") return "rectangle";
  if (o?.type === "circle") return "circle";
  if (o?.type === "polyline") return "line";
  if (o?.type === "polygon") return "polygon";
  return "polygon";
}

export function displayObjectType(o: PlanObject | { type: ObjectType; kind?: ObjectKind }) {
  if (o.kind === "property") return "Property boundary";
  if (o.kind === "sketch") return "Hand-drawn line";
  if (o.type === "label") return "Text";
  if (o.type === "polyline") return "Line";
  return o.type[0].toUpperCase() + o.type.slice(1);
}

export function isLineLike(o: PlanObject) {
  return o.type === "polyline" || o.kind === "sketch";
}

export function objectColor(o: PlanObject) {
  const st = o.style || KIND_STYLE[o.kind] || KIND_STYLE.area;
  const stroke = st.stroke && st.stroke !== "none" ? st.stroke : "";
  const fill = st.fill && st.fill !== "none" ? st.fill : "";
  return stroke || fill || "#334155";
}

export function makeInitialProject(): Project {
  const layers = defaultLayers();
  const property: PolygonObject = {
    id: "property-boundary",
    type: "polygon",
    kind: "property",
    name: "Property boundary",
    layerId: "property",
    locked: false,
    visible: true,
    style: KIND_STYLE.property,
    z: 0,
    rotation: 0,
    measurementHidden: false,
    hiddenMeasurements: [],
    measurementOffsets: {},
    objectLabel: { visible: false, text: "Property boundary", offset: { x: 0, y: -2 }, fontSizeM: 1.3 },
    points: [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],
  };
  return {
    id: uid("project"),
    name: "Untitled backyard plan",
    workspace: { widthM: 100, heightM: 100 },
    units: "m",
    layers,
    objects: [property],
    settings: { showGrid: true, showMeasurements: true, snapToGrid: true, snapToVertices: true, snapToEdges: true, snapToMidpoints: true, orthogonalSnap: true },
  };
}

export function isWorkspaceRectangle(points: Point[], workspace: Project["workspace"]) {
  const expected = [{x:0,y:0},{x:workspace.widthM,y:0},{x:workspace.widthM,y:workspace.heightM},{x:0,y:workspace.heightM}];
  return points.length === expected.length && points.every((p, i) => almost(p.x, expected[i].x) && almost(p.y, expected[i].y));
}

export function workspaceRectanglePoints(workspace: Project["workspace"]) {
  return [{x:0,y:0},{x:workspace.widthM,y:0},{x:workspace.widthM,y:workspace.heightM},{x:0,y:workspace.heightM}];
}

export function resizeWorkspace(project: Project, workspace: Project["workspace"]): Project {
  return {
    ...project,
    workspace,
    objects: project.objects.map(o => {
      if (o.id === "property-boundary" && o.type === "polygon" && isWorkspaceRectangle(o.points, project.workspace)) {
        return { ...o, points: workspaceRectanglePoints(workspace) };
      }
      return o;
    })
  };
}

export function expandWorkspaceToPropertyBoundary(project: Project): Project {
  const boundary = project.objects.find(o => o.id === "property-boundary" && o.type === "polygon") as PolygonObject | undefined;
  if (!boundary) return project;
  const maxX = Math.max(project.workspace.widthM, ...boundary.points.map(p => p.x));
  const maxY = Math.max(project.workspace.heightM, ...boundary.points.map(p => p.y));
  const workspace = {
    widthM: round1(clamp(maxX, 5, 500)),
    heightM: round1(clamp(maxY, 5, 500)),
  };
  if (almost(workspace.widthM, project.workspace.widthM) && almost(workspace.heightM, project.workspace.heightM)) return project;
  return { ...project, workspace };
}

export function normalizePoint(input: any, fallback: Point = { x: 0, y: 0 }): Point {
  return { x: round1(Number(input?.x) || fallback.x), y: round1(Number(input?.y) || fallback.y) };
}

export function normalizeMeasurementOffsets(input: any): Record<string, Point> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, normalizePoint(value)]));
}

export function normalizeObjectLabel(o: any, kind: ObjectKind): AttachedLabel {
  const incoming = o?.objectLabel;
  if (incoming && typeof incoming === "object") {
    return {
      visible: !!incoming.visible,
      text: String(incoming.text || o?.name || KIND_LABELS[kind]),
      offset: normalizePoint(incoming.offset, { x: 0, y: -2 }),
      fontSizeM: Math.max(.3, round1(Number(incoming.fontSizeM) || 1.3)),
    };
  }
  return { visible: false, text: String(o?.name || KIND_LABELS[kind]), offset: { x: 0, y: -2 }, fontSizeM: 1.3 };
}

export function normalizedProject(input: any): Project {
  if (!input || typeof input !== "object") throw new Error("Invalid project JSON.");
  const p = input as Project;
  if (!p.workspace || !Array.isArray(p.objects)) throw new Error("The JSON does not look like a Backyard Planner project.");
  return expandWorkspaceToPropertyBoundary({
    id: p.id || uid("project"),
    name: p.name || "Imported backyard plan",
    workspace: { widthM: Number(p.workspace.widthM) || 100, heightM: Number(p.workspace.heightM) || 100 },
    units: "m",
    layers: defaultLayers(),
    objects: p.objects.map((o: any, i: number) => {
      const kind = genericKindForObject(o);
      const style = { ...(KIND_STYLE[kind] || KIND_STYLE.polygon), ...(o.style || {}) };
      const color = style.stroke && style.stroke !== "none" ? style.stroke : (style.fill && style.fill !== "none" ? style.fill : objectColor({ ...o, kind, style } as PlanObject));
      const normalizedStyle = { ...style, stroke: color, fill: (kind === "line" || kind === "sketch") ? "none" : color };
      if (kind === "property") normalizedStyle.fill = style.fill || KIND_STYLE.property.fill;
      return {
        visible: true,
        locked: false,
        z: i,
        ...o,
        kind,
        layerId: KIND_LAYER[kind],
        style: normalizedStyle,
        rotation: normalizeRotation(Number(o.rotation) || 0),
        measurementHidden: !!o.measurementHidden,
        hiddenMeasurements: Array.isArray(o.hiddenMeasurements) ? o.hiddenMeasurements : [],
        measurementOffsets: normalizeMeasurementOffsets(o.measurementOffsets),
        objectLabel: normalizeObjectLabel(o, kind),
      } as PlanObject;
    }),
    settings: { ...makeInitialProject().settings, ...(p.settings || {}) },
    savedAt: p.savedAt,
  });
}

export function createObjectForTool(tool: Tool, points: Point[], extra: any = {}): PlanObject | null {
  const kindMap: Partial<Record<Tool, ObjectKind>> = {
    property: "property", polygon: "polygon", line: "line", rect: "rectangle", circle: "circle", sketch: "sketch", label: "label"
  };
  const kind = kindMap[tool] || "area";
  const base = {
    id: uid(kind), kind, name: `${KIND_LABELS[kind]} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    layerId: KIND_LAYER[kind], locked: false, visible: true, style: deepClone(KIND_STYLE[kind]), z: Date.now()
  } as any;
  base.rotation = 0;
  base.measurementHidden = false;
  base.hiddenMeasurements = [];
  base.measurementOffsets = {};
  base.objectLabel = { visible: false, text: KIND_LABELS[kind], offset: { x: 0, y: -2 }, fontSizeM: 1.3 };
  if (["polygon","property"].includes(tool)) {
    if (points.length < 3) return null;
    return { ...base, type: "polygon", points: points.map(p => ({ x: round1(p.x), y: round1(p.y) })) } as PolygonObject;
  }
  if (tool === "line") {
    if (points.length < 2) return null;
    return { ...base, type: "polyline", points: points.map(p => ({ x: round1(p.x), y: round1(p.y) })), widthM: 0 } as PolylineObject;
  }
  if (tool === "sketch") {
    const clean = points.reduce((acc: Point[], p) => {
      const next = { x: round1(p.x), y: round1(p.y) };
      const last = acc[acc.length - 1];
      if (!last || distance(last, next) >= .1) acc.push(next);
      return acc;
    }, []);
    if (clean.length < 2 || pathLength(clean) < .2) return null;
    return { ...base, type: "polyline", points: clean, widthM: 0 } as PolylineObject;
  }
  if (tool === "rect") {
    const start = points[0], end = points[1] || points[0];
    const x = Math.min(start.x, end.x), y = Math.min(start.y, end.y), w = Math.abs(end.x - start.x), h = Math.abs(end.y - start.y);
    if (w < .2 || h < .2) return null;
    return { ...base, type: "rectangle", x: round1(x), y: round1(y), width: round1(w), height: round1(h) } as RectangleObject;
  }
  if (tool === "circle") {
    const start = points[0], end = points[1] || { x: start.x + 2.5, y: start.y };
    const defaultR = 2.5;
    const r = Math.max(.2, distance(start, end) || defaultR);
    return { ...base, type: "circle", cx: round1(start.x), cy: round1(start.y), r: round1(r) } as CircleObject;
  }
  if (tool === "label") {
    const p = points[0];
    return { ...base, type: "label", x: round1(p.x), y: round1(p.y), text: extra.text || "Label", fontSizeM: 1.5 } as LabelObject;
  }
  return null;
}

export function getLayer(project: Project, layerId: string) { return project.layers.find(l => l.id === layerId); }
export function isEditable(project: Project, o: PlanObject | undefined | null) {
  if (!o) return false;
  const layer = getLayer(project, o.layerId);
  return !o.locked && !!layer && !layer.locked && layer.visible && o.visible;
}
export function visibleObjects(project: Project) {
  const layerMap = new Map(project.layers.map(l => [l.id, l]));
  return project.objects
    .filter(o => o.visible && layerMap.get(o.layerId)?.visible)
    .sort((a,b) => (layerMap.get(a.layerId)?.order ?? 0) - (layerMap.get(b.layerId)?.order ?? 0) || a.z - b.z);
}
export function selectedObjects(project: Project, ids: string[]) { return project.objects.filter(o => ids.includes(o.id)); }

export function updateObject(project: Project, objectId: string, patcher: (o: PlanObject) => PlanObject): Project {
  return { ...project, objects: project.objects.map(o => o.id === objectId ? patcher(o) : o) };
}
export function updateObjects(project: Project, ids: string[], patcher: (o: PlanObject) => PlanObject): Project {
  return { ...project, objects: project.objects.map(o => ids.includes(o.id) ? patcher(o) : o) };
}

export function collectSnapTargets(project: Project, excludeIds: string[] = []) {
  const vertices: Point[] = [];
  const edges: [Point, Point][] = [];
  const mids: Point[] = [];
  for (const o of visibleObjects(project)) {
    if (excludeIds.includes(o.id)) continue;
    if (o.kind === "sketch") continue;
    vertices.push(...getObjectVertices(o));
    const objEdges = getObjectEdges(o);
    edges.push(...objEdges);
    mids.push(...objEdges.map(([a,b]) => midpoint(a,b)));
  }
  return { vertices, edges, mids };
}

export function applySnapping(project: Project, point: Point, context: { base?: Point; excludeIds?: string[]; allowOutsideWorkspace?: boolean } = {}): SnapResult {
  let p = { ...point };
  let indicator: SnapResult["indicator"] | undefined;
  const settings = project.settings;
  if (settings.snapToGrid) {
    const snapped = { x: Math.round(p.x), y: Math.round(p.y) };
    if (distance(snapped, p) <= .35) {
      p = snapped;
      indicator = { point: p, label: "Grid" };
    }
  }
  const targets = collectSnapTargets(project, context.excludeIds || []);
  if (settings.snapToVertices) {
    let best: { point: Point; dist: number } | null = null;
    for (const v of targets.vertices) {
      const d = distance(p, v);
      if (d <= .45 && (!best || d < best.dist)) best = { point: v, dist: d };
    }
    if (best) { p = { ...best.point }; indicator = { point: p, label: "Vertex" }; }
  }
  if (settings.snapToMidpoints) {
    let best: { point: Point; dist: number } | null = null;
    for (const v of targets.mids) {
      const d = distance(p, v);
      if (d <= .45 && (!best || d < best.dist)) best = { point: v, dist: d };
    }
    if (best) { p = { ...best.point }; indicator = { point: p, label: "Midpoint" }; }
  }
  if (settings.snapToEdges) {
    let best: { point: Point; dist: number; edge: [Point,Point] } | null = null;
    for (const [a,b] of targets.edges) {
      const proj = projectPointOnSegment(p, a, b);
      if (proj.dist <= .35 && (!best || proj.dist < best.dist)) best = { point: proj.point, dist: proj.dist, edge: [a,b] };
    }
    if (best) { p = { x: round1(best.point.x), y: round1(best.point.y) }; indicator = { point: p, label: "Edge", line: best.edge }; }
  }
  if (settings.orthogonalSnap && context.base) {
    const dx = Math.abs(p.x - context.base.x), dy = Math.abs(p.y - context.base.y);
    if (dx > .15 || dy > .15) {
      if (dx < dy * .23) {
        p.x = context.base.x;
        indicator = { point: p, label: "90°", line: [context.base, p] };
      } else if (dy < dx * .23) {
        p.y = context.base.y;
        indicator = { point: p, label: "180°", line: [context.base, p] };
      }
    }
  }
  p.x = context.allowOutsideWorkspace ? round1(Math.max(0, p.x)) : round1(clamp(p.x, 0, project.workspace.widthM));
  p.y = context.allowOutsideWorkspace ? round1(Math.max(0, p.y)) : round1(clamp(p.y, 0, project.workspace.heightM));
  return { point: p, indicator };
}

export function deriveQuantities(project: Project) {
  const q = { polygonArea: 0, rectangleArea: 0, circleArea: 0, lineLength: 0, sketchLength: 0, textCount: 0, inventory: [] as { id: string; name: string; value: string }[] };
  for (const o of project.objects) {
    if (o.kind === "property" || !o.visible) continue;
    const m = objectMeasurements(o) as any;
    if (o.type === "polygon") q.polygonArea += m.area || 0;
    if (o.type === "rectangle") q.rectangleArea += m.area || 0;
    if (o.type === "circle") q.circleArea += m.area || 0;
    if (o.type === "polyline" && o.kind === "sketch") q.sketchLength += m.length || 0;
    else if (o.type === "polyline") q.lineLength += m.length || 0;
    if (o.type === "label") q.textCount += 1;
    let value = "";
    if (m.area) value = fmtM2(m.area);
    else if (m.length) value = fmtM(m.length);
    else if (o.type === "circle") value = `Ø ${fmtM(o.r * 2)}`;
    else if (o.type === "label") value = o.text;
    q.inventory.push({ id: o.id, name: `${displayObjectType(o)} · ${o.name}`, value });
  }
  return q;
}

export function downloadText(filename: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeXml(s: string) {
  return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c] || c));
}

export function renderObjectAsSvg(o: PlanObject, project: Project, exportMode = false) {
  const st = o.style || KIND_STYLE[o.kind] || KIND_STYLE.area;
  const color = objectColor(o);
  const strokeWidth = mToPx(st.strokeWidth || .1);
  const opacity = st.opacity ?? 1;
  const transform = objectTransform(o);
  const transformAttr = transform ? ` transform="${transform}"` : "";
  const fill = o.kind === "property" ? (st.fill || "none") : (isLineLike(o) ? "none" : color);
  if (o.type === "polygon") {
    return `<polygon points="${ptsAttr(o.points)}" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ""}/>`;
  }
  if (o.type === "rectangle") {
    return `<rect x="${mToPx(o.x)}" y="${mToPx(o.y)}" width="${mToPx(o.width)}" height="${mToPx(o.height)}" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"${transformAttr}/>`;
  }
  if (o.type === "circle") {
    const shape = `<circle cx="${mToPx(o.cx)}" cy="${mToPx(o.cy)}" r="${mToPx(o.r)}" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}" opacity="${opacity}"/>`;
    return transform ? `<g${transformAttr}>${shape}</g>` : shape;
  }
  if (o.type === "polyline") {
    const width = Math.max(strokeWidth, 2);
    return `<polyline points="${ptsAttr(o.points)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
  }
  if (o.type === "label") {
    return `<text x="${mToPx(o.x)}" y="${mToPx(o.y)}" font-family="system-ui, sans-serif" font-size="${mToPx(o.fontSizeM)}" fill="${color}" stroke="white" stroke-width="3" paint-order="stroke"${transformAttr}>${escapeXml(o.text)}</text>`;
  }
  return "";
}

export function renderObjectLabelAsSvg(o: PlanObject) {
  if (o.type === "label" || !o.objectLabel?.visible) return "";
  const p = objectLabelPosition(o);
  return `<text x="${mToPx(p.x)}" y="${mToPx(p.y)}" font-family="system-ui, sans-serif" font-size="${mToPx(o.objectLabel.fontSizeM || 1.3)}" fill="${objectColor(o)}" stroke="white" stroke-width="3" paint-order="stroke" text-anchor="middle">${escapeXml(o.objectLabel.text || o.name)}</text>`;
}

export function renderMeasurementsAsSvg(o: PlanObject) {
  const text = (p: Point, label: string) => `<text x="${mToPx(p.x)}" y="${mToPx(p.y)}" font-family="system-ui, sans-serif" font-size="12" fill="${objectColor(o)}" stroke="white" stroke-width="3" paint-order="stroke" text-anchor="middle">${escapeXml(label)}</text>`;
  return objectMeasurementItems(o).map(item => text(item.point, item.value)).join("");
}

export async function exportProjectPng(project: Project) {
  const widthPx = mToPx(project.workspace.widthM), heightPx = mToPx(project.workspace.heightM);
  let grid = `<rect x="0" y="0" width="${widthPx}" height="${heightPx}" fill="#f8fafc"/>`;
  if (project.settings.showGrid) {
    for (let x = 0; x <= project.workspace.widthM; x += 1) grid += `<line x1="${mToPx(x)}" y1="0" x2="${mToPx(x)}" y2="${heightPx}" stroke="${x % 10 === 0 ? "#b7c4d1" : "#dbe4ee"}" stroke-width="${x % 10 === 0 ? 1.2 : .55}"/>`;
    for (let y = 0; y <= project.workspace.heightM; y += 1) grid += `<line x1="0" y1="${mToPx(y)}" x2="${widthPx}" y2="${mToPx(y)}" stroke="${y % 10 === 0 ? "#b7c4d1" : "#dbe4ee"}" stroke-width="${y % 10 === 0 ? 1.2 : .55}"/>`;
  }
  const objs = visibleObjects(project).map(o => renderObjectAsSvg(o, project, true)).join("\n");
  const measurements = project.settings.showMeasurements ? visibleObjects(project).filter(o => o.kind !== "label").map(renderMeasurementsAsSvg).join("\n") : "";
  const labels = visibleObjects(project).map(renderObjectLabelAsSvg).join("\n");
  const title = `<text x="16" y="28" font-family="system-ui, sans-serif" font-size="18" fill="#0f172a" font-weight="700">${escapeXml(project.name)}</text><text x="16" y="50" font-family="system-ui, sans-serif" font-size="12" fill="#334155">${fmtM(project.workspace.widthM)} × ${fmtM(project.workspace.heightM)}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">${grid}<g>${objs}</g><g>${measurements}</g><g>${labels}</g>${title}</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
  img.src = url;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,widthPx,heightPx);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("PNG export failed.");
  const pngUrl = URL.createObjectURL(png);
  const a = document.createElement("a");
  a.href = pngUrl;
  a.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "backyard-plan"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
}

export function runGeometryTests() {
  const tests: [string, () => boolean][] = [
    ["meters-to-pixels", () => mToPx(3.2) === 32],
    ["pixels-to-meters", () => pxToM(25) === 2.5],
    ["rounding", () => round1(12.34) === 12.3 && round1(12.35) === 12.4],
    ["point rotation", () => { const p = rotatePointAround({x:1,y:0}, {x:0,y:0}, 90); return p.x === 0 && p.y === 1; }],
    ["grid snapping", () => applySnapping(makeInitialProject(), {x: 4.88, y: 5.11}, {}).point.x === 5],
    ["orthogonal snapping", () => applySnapping(makeInitialProject(), {x: 10.2, y: 25}, {base:{x:10,y:10}}).point.x === 10],
    ["midpoint", () => midpoint({x:0,y:0},{x:4,y:2}).x === 2 && midpoint({x:0,y:0},{x:4,y:2}).y === 1],
    ["polygon perimeter", () => round1(polygonPerimeter([{x:0,y:0},{x:3,y:0},{x:3,y:4}])) === 12],
    ["polygon area", () => polygonArea([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]) === 100],
    ["self-intersection", () => polygonSelfIntersects([{x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}]) === true],
    ["path length", () => pathLength([{x:0,y:0},{x:3,y:4},{x:6,y:4}]) === 8],
    ["segment deletion", () => {
      const next = deleteSegmentFromObject({type:"polyline", id:"s", kind:"line", name:"s", layerId:"shapes", locked:false, visible:true, style:KIND_STYLE.line, z:0, points:[{x:0,y:0},{x:1,y:0},{x:2,y:0}]}, 0) as PolylineObject | null;
      return !!next && next.points.length === 2 && next.points[0].x === 1 && next.points[1].x === 2;
    }],
    ["rectangle measurement", () => rectArea({type:"rectangle", id:"t", kind:"rectangle", name:"r", layerId:"shapes", locked:false, visible:true, style:KIND_STYLE.rectangle, z:0, x:0,y:0,width:5,height:4}) === 20],
    ["hidden measurement", () => objectMeasurementItems({type:"rectangle", id:"h", kind:"rectangle", name:"h", layerId:"shapes", locked:false, visible:true, style:KIND_STYLE.rectangle, z:0, x:0,y:0,width:5,height:4, hiddenMeasurements:["width"]}).length === 2],
    ["circle measurement", () => round1(circlePerimeter({type:"circle", id:"c", kind:"circle", name:"c", layerId:"shapes", locked:false, visible:true, style:KIND_STYLE.circle, z:0, cx:0,cy:0,r:2})) === 12.6],
  ];
  const failures: string[] = [];
  tests.forEach(([name, fn]) => { try { if (!fn()) failures.push(name); } catch (e) { failures.push(`${name}: ${(e as Error).message}`); } });
  return { passed: tests.length - failures.length, total: tests.length, failures };
}

export const initialUi: UiState = {
  tool: "select",
  selectedIds: [],
  hoveredId: null,
  selectedHandle: null,
  drawing: null,
  viewport: { scale: .75, panX: 80, panY: 60 },
  drag: null,
  spaceDown: false,
  status: "Ready. Workspace is 100.0 m × 100.0 m.",
  tests: runGeometryTests(),
  showChecklist: false,
};

export function loadStoredProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizedProject(JSON.parse(raw));
  } catch (e) { console.warn("Could not load autosave", e); }
  return null;
}

export function loadInitialProject() {
  return loadStoredProject() || makeInitialProject();
}

export async function loadStarterProject() {
  const response = await fetch(STARTER_PROJECT_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Could not load ${STARTER_PROJECT_URL} (${response.status}).`);
  return normalizedProject(await response.json());
}

export function appReducer(state: HistoryState, action: any): HistoryState {
  const push = (incoming: Project, status?: string) => {
    const next = expandWorkspaceToPropertyBoundary(incoming);
    const currentStr = JSON.stringify(state.project);
    const nextStr = JSON.stringify(next);
    if (currentStr === nextStr) return { ...state, ui: { ...state.ui, status: status || state.ui.status } };
    const past = [...state.past, state.project].slice(-HISTORY_LIMIT);
    return { ...state, project: next, past, future: [], ui: { ...state.ui, status: status || state.ui.status } };
  };
  switch (action.type) {
    case "SET_TOOL":
      return { ...state, ui: { ...state.ui, tool: action.tool, drawing: null, selectedHandle: null, status: action.status || `${action.tool} tool active.` } };
    case "SET_UI":
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case "PROJECT_APPLY":
      return push(action.project, action.status);
    case "PROJECT_TRANSIENT":
      return { ...state, project: expandWorkspaceToPropertyBoundary(action.project), ui: { ...state.ui, status: action.status || state.ui.status } };
    case "PROJECT_COMMIT_FROM": {
      const changed = JSON.stringify(action.beforeProject) !== JSON.stringify(state.project);
      if (!changed) return { ...state, ui: { ...state.ui, drag: null } };
      return { ...state, past: [...state.past, action.beforeProject].slice(-HISTORY_LIMIT), future: [], ui: { ...state.ui, drag: null, status: action.status || "Edit committed." } };
    }
    case "UNDO": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { ...state, project: prev, past: state.past.slice(0, -1), future: [state.project, ...state.future], ui: { ...state.ui, drawing: null, selectedHandle: null, status: "Undo." } };
    }
    case "REDO": {
      if (!state.future.length) return state;
      const next = state.future[0];
      return { ...state, project: next, past: [...state.past, state.project].slice(-HISTORY_LIMIT), future: state.future.slice(1), ui: { ...state.ui, drawing: null, selectedHandle: null, status: "Redo." } };
    }
    case "NEW_PROJECT":
      return { project: makeInitialProject(), past: [], future: [], ui: { ...state.ui, selectedIds: [], selectedHandle: null, drawing: null, status: "New project created." } };
    case "IMPORT_PROJECT":
      return { project: expandWorkspaceToPropertyBoundary(action.project), past: [state.project].slice(-HISTORY_LIMIT), future: [], ui: { ...state.ui, selectedIds: [], selectedHandle: null, drawing: null, status: action.status || "Project imported." } };
    default:
      return state;
  }
}
