import React, { useEffect, useMemo, useRef } from "react";
import {
  type Point,
  type PolygonObject,
  type PlanObject,
  type Project,
  type Tool,
  type MeasurementItem,
  type SelectedHandle,
  type HistoryState,
  type UiState,
  PX_PER_M,
  FREEHAND_MIN_POINT_DISTANCE_M,
  FREEHAND_MAX_POINTS,
  fmtM,
  round1,
  clamp,
  deepClone,
  mToPx,
  pxToM,
  ptsAttr,
  distance,
  midpoint,
  clampPointToWorkspace,
  polygonWarnings,
  pathSegmentCount,
  boundingBoxForObject,
  rectFromPoints,
  defaultObjectLabelOffset,
  objectLabelPosition,
  objectInsideSelectionBox,
  objectTransform,
  unrotatePointForObject,
  measurementOffset,
  objectMeasurementItems,
  getObjectVertices,
  hitTestObject,
  moveObject,
  resizeRectangleFromCorner,
  KIND_STYLE,
  displayObjectType,
  isLineLike,
  objectColor,
  createObjectForTool,
  isEditable,
  visibleObjects,
  selectedObjects,
  updateObject,
  updateObjects,
  applySnapping
} from "../model";

function Grid({ project }: { project: Project }) {
  if (!project.settings.showGrid) return null;
  const lines = [] as any[];
  const w = project.workspace.widthM, h = project.workspace.heightM;
  for (let x = 0; x <= w; x += 1) lines.push(<line key={`vx${x}`} x1={mToPx(x)} y1={0} x2={mToPx(x)} y2={mToPx(h)} stroke={x % 10 === 0 ? "var(--canvas-major)" : "var(--canvas-line)"} strokeWidth={x % 10 === 0 ? 1.2 : .55} vectorEffect="non-scaling-stroke" />);
  for (let y = 0; y <= h; y += 1) lines.push(<line key={`hy${y}`} x1={0} y1={mToPx(y)} x2={mToPx(w)} y2={mToPx(y)} stroke={y % 10 === 0 ? "var(--canvas-major)" : "var(--canvas-line)"} strokeWidth={y % 10 === 0 ? 1.2 : .55} vectorEffect="non-scaling-stroke" />);
  return <g aria-hidden="true"><rect x={0} y={0} width={mToPx(w)} height={mToPx(h)} fill="var(--canvas)" />{lines}</g>;
}

function MeasurementLabels({ o }: { o: PlanObject }) {
  const color = objectColor(o);
  const text = (item: MeasurementItem) => <text key={`${o.id}-${item.id}`} className="measurement-label draggable-measurement-label" style={{fill: color}} x={mToPx(item.point.x)} y={mToPx(item.point.y)} textAnchor="middle" data-measure-object={o.id} data-measure-id={item.id}>{item.value}</text>;
  return <g>{objectMeasurementItems(o).map(text)}</g>;
}

function ObjectAttachedLabel({ o }: { o: PlanObject }) {
  if (o.type === "label" || !o.objectLabel?.visible) return null;
  const p = objectLabelPosition(o);
  return <text className="object-label" fill={objectColor(o)} x={mToPx(p.x)} y={mToPx(p.y)} fontSize={mToPx(o.objectLabel.fontSizeM || 1.3)} textAnchor="middle" data-object-label={o.id}>{o.objectLabel.text || o.name}</text>;
}

function PlanObjectView({ o, selected, hovered, project, dispatch }: { o: PlanObject; selected: boolean; hovered: boolean; project: Project; dispatch: any }) {
  const st = o.style || KIND_STYLE[o.kind] || KIND_STYLE.area;
  const color = objectColor(o);
  const fill = o.kind === "property" ? (st.fill || "none") : (isLineLike(o) ? "none" : color);
  const isInvalid = o.type === "polygon" && polygonWarnings(o.points).length > 0;
  const common = {
    className: "object-shape",
    fill,
    stroke: color,
    strokeWidth: mToPx(st.strokeWidth || .1),
    opacity: st.opacity ?? 1,
    vectorEffect: "non-scaling-stroke" as any,
    strokeDasharray: st.dash || undefined,
    onPointerEnter: (e: any) => { e.stopPropagation(); dispatch({type:"SET_UI", patch:{hoveredId:o.id}}); },
    onPointerLeave: (e: any) => { e.stopPropagation(); dispatch({type:"SET_UI", patch:{hoveredId:null}}); },
    style: { cursor: isEditable(project, o) ? "pointer" : "not-allowed" }
  };
  let shape: any = null;
  let outline: any = null;
  const outlineClass = selected ? "selection-outline" : hovered ? "hover-outline" : isInvalid ? "invalid-outline" : "";
  const transform = objectTransform(o);
  if (o.type === "polygon") {
    shape = <polygon {...common} points={ptsAttr(o.points)} />;
    outline = outlineClass ? <polygon className={outlineClass} points={ptsAttr(o.points)} /> : null;
  } else if (o.type === "rectangle") {
    shape = <rect {...common} x={mToPx(o.x)} y={mToPx(o.y)} width={mToPx(o.width)} height={mToPx(o.height)} />;
    outline = outlineClass ? <rect className={outlineClass} x={mToPx(o.x)} y={mToPx(o.y)} width={mToPx(o.width)} height={mToPx(o.height)} /> : null;
  } else if (o.type === "circle") {
    shape = <g>
      <circle {...common} cx={mToPx(o.cx)} cy={mToPx(o.cy)} r={mToPx(o.r)} />
    </g>;
    outline = outlineClass ? <circle className={outlineClass} cx={mToPx(o.cx)} cy={mToPx(o.cy)} r={mToPx(o.r)} /> : null;
  } else if (o.type === "polyline") {
    const width = mToPx(st.strokeWidth || .25);
    shape = <g>
      <polyline {...common} points={ptsAttr(o.points)} fill="none" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </g>;
    outline = outlineClass ? <polyline className={outlineClass} points={ptsAttr(o.points)} /> : null;
  } else if (o.type === "label") {
    shape = <text className="svg-label" x={mToPx(o.x)} y={mToPx(o.y)} fontSize={mToPx(o.fontSizeM)} fill={color} onPointerEnter={(e:any) => {e.stopPropagation(); dispatch({type:"SET_UI", patch:{hoveredId:o.id}});}} onPointerLeave={(e:any) => {e.stopPropagation(); dispatch({type:"SET_UI", patch:{hoveredId:null}});}}>{o.text}</text>;
    const bb = boundingBoxForObject(o);
    outline = outlineClass ? <rect className={outlineClass} x={mToPx(bb.x)} y={mToPx(bb.y - bb.height)} width={mToPx(bb.width)} height={mToPx(bb.height * 1.25)} /> : null;
  }
  return <g data-object-id={o.id} transform={transform || undefined}>{shape}{outline}</g>;
}

function Handles({ project, selectedIds, selectedHandle, dispatch }: { project: Project; selectedIds: string[]; selectedHandle: SelectedHandle; dispatch: any }) {
  const objs = selectedObjects(project, selectedIds).filter(o => isEditable(project, o));
  const handles: any[] = [];
  const circleSize = 5;
  objs.forEach(o => {
    if ((o.type === "polygon" || o.type === "polyline") && o.kind !== "sketch") {
      const segmentCount = pathSegmentCount(o);
      for (let i = 0; i < segmentCount; i++) {
        const a = o.points[i], b = o.points[(i + 1) % o.points.length];
        const selected = selectedHandle?.objectId === o.id && selectedHandle.kind === "segment" && selectedHandle.index === i;
        handles.push(<line key={`${o.id}-s-${i}`} className={selected ? "selected-segment" : "segment-handle"} x1={mToPx(a.x)} y1={mToPx(a.y)} x2={mToPx(b.x)} y2={mToPx(b.y)} data-handle-object={o.id} data-handle-kind="segment" data-handle-index={i} />);
      }
      o.points.forEach((p, i) => handles.push(<circle key={`${o.id}-v-${i}`} className="handle" cx={mToPx(p.x)} cy={mToPx(p.y)} r={circleSize} data-handle-object={o.id} data-handle-kind="vertex" data-handle-index={i} />));
      const edgeCount = segmentCount;
      for (let i = 0; i < edgeCount; i++) {
        const m = midpoint(o.points[i], o.points[(i+1) % o.points.length]);
        handles.push(<rect key={`${o.id}-m-${i}`} className="mid-handle" x={mToPx(m.x)-4} y={mToPx(m.y)-4} width={8} height={8} transform={`rotate(45 ${mToPx(m.x)} ${mToPx(m.y)})`} data-handle-object={o.id} data-handle-kind="midpoint" data-handle-index={i} />);
      }
    }
    if (o.type === "rectangle") {
      const pts = getObjectVertices(o);
      const corners = [["nw", pts[0]], ["ne", pts[1]], ["se", pts[2]], ["sw", pts[3]]] as [string, Point][];
      corners.forEach(([corner, p]) => handles.push(<rect key={`${o.id}-${corner}`} className="resize-handle" x={mToPx(p.x)-5} y={mToPx(p.y)-5} width={10} height={10} data-handle-object={o.id} data-handle-kind="resize" data-handle-corner={corner} />));
    }
    if (o.type === "circle") {
      const p = {x:o.cx+o.r, y:o.cy};
      handles.push(<circle key={`${o.id}-radius`} className="resize-handle" cx={mToPx(p.x)} cy={mToPx(p.y)} r={5.5} data-handle-object={o.id} data-handle-kind="radius" />);
    }
  });
  return <g>{handles}</g>;
}

function DrawingPreview({ drawing }: { drawing: UiState["drawing"] }) {
  if (!drawing) return null;
  const pts = [...drawing.points];
  if (drawing.preview) pts.push(drawing.preview);
  if (["polygon","property"].includes(drawing.tool)) {
    return <g pointerEvents="none">
      {pts.length > 1 && <polyline points={ptsAttr(pts)} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
      {pts.map((p,i) => <circle key={i} cx={mToPx(p.x)} cy={mToPx(p.y)} r={4} fill="#f97316" stroke="white" vectorEffect="non-scaling-stroke" />)}
    </g>;
  }
  if (drawing.tool === "line") {
    return <g pointerEvents="none">
      {pts.length > 1 && <polyline points={ptsAttr(pts)} fill="none" stroke="#f97316" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity=".75" vectorEffect="non-scaling-stroke" />}
      {pts.map((p,i) => <circle key={i} cx={mToPx(p.x)} cy={mToPx(p.y)} r={4} fill="#f97316" stroke="white" vectorEffect="non-scaling-stroke" />)}
    </g>;
  }
  if (drawing.tool === "sketch") {
    return <g pointerEvents="none">
      {pts.length > 1 && <polyline points={ptsAttr(pts)} fill="none" stroke="#f97316" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity=".85" vectorEffect="non-scaling-stroke" />}
    </g>;
  }
  if (drawing.tool === "rect" && drawing.start && drawing.current) {
    const x = Math.min(drawing.start.x, drawing.current.x), y = Math.min(drawing.start.y, drawing.current.y), w = Math.abs(drawing.current.x - drawing.start.x), h = Math.abs(drawing.current.y - drawing.start.y);
    return <rect pointerEvents="none" x={mToPx(x)} y={mToPx(y)} width={mToPx(w)} height={mToPx(h)} fill="rgba(249,115,22,.18)" stroke="#f97316" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />;
  }
  if (drawing.tool === "circle" && drawing.start && drawing.current) {
    return <circle pointerEvents="none" cx={mToPx(drawing.start.x)} cy={mToPx(drawing.start.y)} r={mToPx(distance(drawing.start, drawing.current))} fill="rgba(249,115,22,.18)" stroke="#f97316" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />;
  }
  return null;
}

function SelectionBoxPreview({ drag }: { drag: any }) {
  if (!drag || drag.mode !== "select-box" || !drag.current) return null;
  const rect = rectFromPoints(drag.start, drag.current);
  if (rect.width < .05 && rect.height < .05) return null;
  return <rect className="selection-box" x={mToPx(rect.x)} y={mToPx(rect.y)} width={mToPx(rect.width)} height={mToPx(rect.height)} />;
}

function ScaleIndicator({ viewport }: { viewport: UiState["viewport"] }) {
  const targetPx = 110;
  const meters = Math.max(1, Math.round(targetPx / (PX_PER_M * viewport.scale)));
  return <div className="pill">Scale: {fmtM(meters)} ≈ {Math.round(meters * PX_PER_M * viewport.scale)} px</div>;
}

export function SvgWorkspace({ state, dispatch, fitRef }: { state: HistoryState; dispatch: any; fitRef: React.MutableRefObject<(() => void) | null> }) {
  const { project, ui } = state;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const visible = useMemo(() => visibleObjects(project), [project]);
  const projectRef = useRef(project);
  const uiRef = useRef(ui);
  useEffect(() => { projectRef.current = project; uiRef.current = ui; });

  const screenToM = (e: any): Point => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    return { x: pxToM((sx - uiRef.current.viewport.panX) / uiRef.current.viewport.scale), y: pxToM((sy - uiRef.current.viewport.panY) / uiRef.current.viewport.scale) };
  };
  const hitTest = (p: Point) => {
    const objs = visibleObjects(projectRef.current).slice().reverse();
    return objs.find(o => hitTestObject(o, p));
  };
  const setStatus = (status: string) => dispatch({type:"SET_UI", patch:{status}});

  const fitWorkspace = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const margin = 52;
    const sx = (rect.width - margin * 2) / mToPx(projectRef.current.workspace.widthM);
    const sy = (rect.height - margin * 2) / mToPx(projectRef.current.workspace.heightM);
    const scale = clamp(Math.min(sx, sy), .1, 6);
    dispatch({ type:"SET_UI", patch:{ viewport:{ scale, panX: margin, panY: margin }, status:"Workspace fitted." } });
  };
  fitRef.current = fitWorkspace;
  useEffect(() => {
    const t = setTimeout(fitWorkspace, 40);
    return () => clearTimeout(t);
  }, [project.workspace.widthM, project.workspace.heightM]);

  const nextSelectionForHit = (id: string, additive = false) => {
    const current = uiRef.current.selectedIds;
    if (additive) return current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    return current.includes(id) && current.length > 1 ? current : [id];
  };

  const selectObject = (id: string, additive = false) => {
    const selectedIds = nextSelectionForHit(id, additive);
    dispatch({type:"SET_UI", patch:{selectedIds, selectedHandle:null, status:`Selected ${selectedIds.length} object${selectedIds.length === 1 ? "" : "s"}.`}});
    return selectedIds;
  };

  const commitDrawing = (drawing = uiRef.current.drawing) => {
    if (!drawing) return;
    if (["polygon","property"].includes(drawing.tool)) {
      const obj = createObjectForTool(drawing.tool as Tool, drawing.points);
      if (!obj) { setStatus("Need at least 3 vertices to finish this polygon."); return; }
      let next = projectRef.current;
      if (drawing.tool === "property") {
        next = updateObject(next, "property-boundary", () => ({ ...(obj as PolygonObject), id:"property-boundary", name:"Property boundary", z:0, layerId:"property" }));
      } else {
        next = { ...next, objects: [...next.objects, obj] };
      }
      dispatch({ type:"PROJECT_APPLY", project: next, status:`Created ${displayObjectType(obj)}.` });
      dispatch({ type:"SET_UI", patch:{drawing:null, selectedIds:[obj.id], tool:"select"} });
    } else if (["line","sketch"].includes(drawing.tool)) {
      const obj = createObjectForTool(drawing.tool as Tool, drawing.points);
      if (!obj) { setStatus("Need at least 2 points to finish this line."); return; }
      const next = { ...projectRef.current, objects: [...projectRef.current.objects, obj] };
      dispatch({ type:"PROJECT_APPLY", project: next, status:`Created ${displayObjectType(obj)}.` });
      dispatch({ type:"SET_UI", patch:{drawing:null, selectedIds:[obj.id], tool:"select"} });
    }
  };

  const onPointerDown = (e: any) => {
    const raw = screenToM(e);
    const tool = uiRef.current.spaceDown || e.button === 1 ? "pan" : uiRef.current.tool;
    const handleEl = e.target.closest?.("[data-handle-object]");
    const measureEl = e.target.closest?.("[data-measure-object]");
    const objectLabelEl = e.target.closest?.("[data-object-label]");
    const isLabelDragTarget = tool === "select" && (measureEl || objectLabelEl);
    const allowOutsideWorkspace = tool === "property" || handleEl?.getAttribute("data-handle-object") === "property-boundary";
    const p = tool === "sketch" || isLabelDragTarget
      ? clampPointToWorkspace(projectRef.current, raw)
      : applySnapping(projectRef.current, raw, { base: uiRef.current.drawing?.points?.slice(-1)[0], excludeIds: uiRef.current.selectedIds, allowOutsideWorkspace }).point;
    if (tool === "pan") {
      e.preventDefault();
      dispatch({type:"SET_UI", patch:{drag:{mode:"pan", startClient:{x:e.clientX,y:e.clientY}, startViewport: uiRef.current.viewport}}});
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    if (measureEl && tool === "select") {
      e.preventDefault();
      e.stopPropagation();
      const objectId = measureEl.getAttribute("data-measure-object");
      const measurementId = measureEl.getAttribute("data-measure-id");
      const object = projectRef.current.objects.find(o => o.id === objectId);
      if (object && measurementId && isEditable(projectRef.current, object)) {
        dispatch({type:"SET_UI", patch:{selectedIds:[object.id], selectedHandle:null, drag:{mode:"measure-label", objectId:object.id, measurementId, start:p, beforeProject:deepClone(projectRef.current), offset:measurementOffset(object, measurementId)}, status:"Dragging dimension label."}});
        try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      }
      return;
    }
    if (objectLabelEl && tool === "select") {
      e.preventDefault();
      e.stopPropagation();
      const objectId = objectLabelEl.getAttribute("data-object-label");
      const object = projectRef.current.objects.find(o => o.id === objectId);
      if (object && isEditable(projectRef.current, object)) {
        const label = object.objectLabel || { visible: true, text: object.name, offset: defaultObjectLabelOffset(object), fontSizeM: 1.3 };
        dispatch({type:"SET_UI", patch:{selectedIds:[object.id], selectedHandle:null, drag:{mode:"object-label", objectId:object.id, start:p, beforeProject:deepClone(projectRef.current), offset:label.offset || defaultObjectLabelOffset(object)}, status:"Dragging object label."}});
        try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      }
      return;
    }
    if (handleEl) {
      e.stopPropagation();
      const objectId = handleEl.getAttribute("data-handle-object");
      const kind = handleEl.getAttribute("data-handle-kind");
      if (!objectId || !kind) return;
      const index = Number(handleEl.getAttribute("data-handle-index"));
      const corner = handleEl.getAttribute("data-handle-corner");
      const beforeProject = deepClone(projectRef.current);
      if (kind === "segment") {
        const object = projectRef.current.objects.find(o => o.id === objectId);
        const drag = object && isEditable(projectRef.current, object) ? {mode:"move", start:p, beforeProject, ids:[object.id]} : null;
        dispatch({type:"SET_UI", patch:{selectedIds:object ? [object.id] : [objectId], selectedHandle:{objectId, kind:"segment", index}, drag, status:`Segment ${index + 1} selected. Press Delete to remove it.`}});
        if (drag) try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
        return;
      }
      if (kind === "midpoint") {
        const next = updateObject(projectRef.current, objectId, (o: PlanObject) => {
          if (o.type !== "polygon" && o.type !== "polyline") return o;
          const pts = [...o.points];
          const a = pts[index], b = pts[(index+1) % pts.length];
          pts.splice(index + 1, 0, midpoint(a,b));
          return { ...o, points: pts } as PlanObject;
        });
        dispatch({type:"PROJECT_APPLY", project:next, status:"Inserted vertex at midpoint."});
        dispatch({type:"SET_UI", patch:{selectedHandle:{objectId, kind:"vertex", index:index+1}}});
        return;
      }
      dispatch({type:"SET_UI", patch:{selectedHandle:{objectId, kind, index, corner}, drag:{mode:kind, objectId, index, corner, start:p, beforeProject}, status:"Dragging handle."}});
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      return;
    }

    if (tool === "rect") {
      e.preventDefault();
      dispatch({type:"SET_UI", patch:{drawing:{tool, points:[p], start:p, current:p}, drag:{mode:"draw-rect", start:p}, status:"Drag to size rectangle."}});
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    if (tool === "circle") {
      e.preventDefault();
      dispatch({type:"SET_UI", patch:{drawing:{tool, points:[p], start:p, current:p}, drag:{mode:"draw-circle", start:p}, status:"Drag to set diameter."}});
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    if (tool === "label") {
      const obj = createObjectForTool("label", [p]);
      if (!obj) return;
      const next = { ...projectRef.current, objects: [...projectRef.current.objects, obj] };
      dispatch({type:"PROJECT_APPLY", project:next, status:"Text placed. Edit it in the inspector."});
      dispatch({type:"SET_UI", patch:{selectedIds:[obj.id], tool:"select"}});
      return;
    }
    if (tool === "sketch") {
      e.preventDefault();
      dispatch({type:"SET_UI", patch:{drawing:{tool, points:[p], preview:p}, drag:{mode:"draw-freehand", start:p}, snapIndicator:undefined, status:"Drawing hand-drawn line."}});
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    if (["polygon","line","property"].includes(tool)) {
      const current = uiRef.current.drawing;
      let points = current && current.tool === tool ? current.points.slice() : [];
      if (tool === "property" && !current) points = [];
      if (points.length >= 3 && distance(points[0], p) < .6 && tool !== "line") {
        commitDrawing({tool, points, preview:p});
        return;
      }
      points.push(p);
      dispatch({ type:"SET_UI", patch:{ drawing:{tool, points, preview:p}, status:`${tool === "line" ? "Line" : tool === "property" ? "Property boundary" : "Polygon"}: ${points.length} point${points.length===1?"":"s"}. Double-click or Enter to finish.` } });
      return;
    }

    const hit = hitTest(p);
    if (hit) {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const selectedIds = selectObject(hit.id, additive);
      const dragIds = selectedIds.includes(hit.id) ? selectedIds : [];
      const editableDragIds = dragIds.filter(id => isEditable(projectRef.current, projectRef.current.objects.find(o => o.id === id)));
      if (isEditable(projectRef.current, hit) && editableDragIds.length) {
        dispatch({type:"SET_UI", patch:{drag:{mode:"move", start:p, beforeProject:deepClone(projectRef.current), ids:editableDragIds}, selectedHandle:null}});
        try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      }
      return;
    }
    if (tool === "select") {
      const start = clampPointToWorkspace(projectRef.current, raw);
      dispatch({type:"SET_UI", patch:{drag:{mode:"select-box", start, current:start, additive:e.shiftKey || e.metaKey || e.ctrlKey, beforeSelectedIds:uiRef.current.selectedIds}, selectedHandle:null, status:"Drag to select objects."}});
      try { svgRef.current?.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    dispatch({type:"SET_UI", patch:{selectedIds:[], selectedHandle:null, status:"Selection cleared."}});
  };

  const onPointerMove = (e: any) => {
    const uiNow = uiRef.current;
    const raw = screenToM(e);
    const base = uiNow.drawing?.points?.slice(-1)[0] || (uiNow.drag?.start ?? undefined);
    const allowOutsideWorkspace = uiNow.drawing?.tool === "property" || uiNow.drag?.objectId === "property-boundary" || uiNow.drag?.ids?.includes?.("property-boundary");
    const isFreehand = uiNow.drawing?.tool === "sketch" || uiNow.drag?.mode === "draw-freehand";
    const isSelectionBox = uiNow.drag?.mode === "select-box";
    const isLabelDrag = uiNow.drag?.mode === "measure-label" || uiNow.drag?.mode === "object-label";
    const snap = isFreehand || isSelectionBox || isLabelDrag ? { point: clampPointToWorkspace(projectRef.current, raw), indicator: undefined } : applySnapping(projectRef.current, raw, { base, excludeIds: uiNow.selectedIds, allowOutsideWorkspace });
    const p = snap.point;
    if (!uiNow.drag) {
      if (uiNow.drawing) dispatch({type:"SET_UI", patch:{drawing:{...uiNow.drawing, preview:p}, snapIndicator:snap.indicator, status:`Pointer ${fmtM(p.x)}, ${fmtM(p.y)}`}});
      else dispatch({type:"SET_UI", patch:{snapIndicator:snap.indicator, status:`Pointer ${fmtM(p.x)}, ${fmtM(p.y)}`}});
      return;
    }
    const drag = uiNow.drag;
    if (drag.mode === "pan") {
      const dx = e.clientX - drag.startClient.x, dy = e.clientY - drag.startClient.y;
      dispatch({type:"SET_UI", patch:{viewport:{...drag.startViewport, panX:drag.startViewport.panX+dx, panY:drag.startViewport.panY+dy}}});
      return;
    }
    if (drag.mode === "select-box") {
      const rect = rectFromPoints(drag.start, p);
      dispatch({type:"SET_UI", patch:{drag:{...drag, current:p}, snapIndicator:undefined, status:`Selection area ${fmtM(rect.width)} × ${fmtM(rect.height)}.`}});
      return;
    }
    if (drag.mode === "draw-rect" || drag.mode === "draw-circle") {
      const drawing = { ...uiNow.drawing, current:p, preview:p };
      dispatch({type:"SET_UI", patch:{drawing, snapIndicator:snap.indicator}});
      return;
    }
    if (drag.mode === "draw-freehand") {
      const drawing = uiNow.drawing;
      if (!drawing || drawing.tool !== "sketch") return;
      const last = drawing.points[drawing.points.length - 1];
      const shouldAdd = (!last || distance(last, p) >= FREEHAND_MIN_POINT_DISTANCE_M) && drawing.points.length < FREEHAND_MAX_POINTS;
      const points = shouldAdd ? [...drawing.points, p] : drawing.points;
      dispatch({type:"SET_UI", patch:{drawing:{...drawing, points, preview:p}, snapIndicator:undefined, status:`Sketch: ${points.length} points.`}});
      return;
    }
    if (drag.mode === "measure-label") {
      const dx = round1(p.x - drag.start.x), dy = round1(p.y - drag.start.y);
      const offset = { x: round1((drag.offset?.x || 0) + dx), y: round1((drag.offset?.y || 0) + dy) };
      const next = updateObject(drag.beforeProject as Project, drag.objectId, (o: PlanObject) => ({
        ...o,
        measurementOffsets: { ...(o.measurementOffsets || {}), [drag.measurementId]: offset },
      } as PlanObject));
      dispatch({type:"PROJECT_TRANSIENT", project:next, status:"Dimension label moved."});
      return;
    }
    if (drag.mode === "object-label") {
      const dx = round1(p.x - drag.start.x), dy = round1(p.y - drag.start.y);
      const next = updateObject(drag.beforeProject as Project, drag.objectId, (o: PlanObject) => {
        const currentLabel = o.objectLabel || { visible: true, text: o.name, offset: defaultObjectLabelOffset(o), fontSizeM: 1.3 };
        return {
          ...o,
          objectLabel: {
            ...currentLabel,
            visible: true,
            offset: { x: round1((drag.offset?.x || 0) + dx), y: round1((drag.offset?.y || 0) + dy) },
          },
        } as PlanObject;
      });
      dispatch({type:"PROJECT_TRANSIENT", project:next, status:"Object label moved."});
      return;
    }
    if (drag.mode === "move") {
      const dx = round1(p.x - drag.start.x), dy = round1(p.y - drag.start.y);
      let next = drag.beforeProject as Project;
      next = updateObjects(next, drag.ids, (o) => moveObject(o, dx, dy));
      dispatch({type:"PROJECT_TRANSIENT", project:next, status:`Move ${fmtM(dx)}, ${fmtM(dy)}.`});
      return;
    }
    if (drag.mode === "vertex") {
      const next = updateObject(drag.beforeProject as Project, drag.objectId, (o: PlanObject) => {
        if (o.type !== "polygon" && o.type !== "polyline") return o;
        const pts = o.points.map((pt, i) => i === drag.index ? p : pt);
        return { ...o, points: pts } as PlanObject;
      });
      dispatch({type:"PROJECT_TRANSIENT", project:next, status:`Vertex ${drag.index + 1}: ${fmtM(p.x)}, ${fmtM(p.y)}.`});
      return;
    }
    if (drag.mode === "resize") {
      const next = updateObject(drag.beforeProject as Project, drag.objectId, (o: PlanObject) => o.type === "rectangle" ? resizeRectangleFromCorner(o, drag.corner, unrotatePointForObject(o, p)) : o);
      dispatch({type:"PROJECT_TRANSIENT", project:next, status:"Resizing rectangle."});
      return;
    }
    if (drag.mode === "radius") {
      const next = updateObject(drag.beforeProject as Project, drag.objectId, (o: PlanObject) => o.type === "circle" ? { ...o, r: round1(Math.max(.2, distance({x:o.cx,y:o.cy}, p))) } : o);
      dispatch({type:"PROJECT_TRANSIENT", project:next, status:"Resizing circle."});
      return;
    }
  };

  const onPointerUp = (e: any) => {
    const drag = uiRef.current.drag;
    if (!drag) return;
    if (drag.mode === "select-box") {
      const end = clampPointToWorkspace(projectRef.current, screenToM(e));
      const rect = rectFromPoints(drag.start, end);
      if (rect.width < .2 && rect.height < .2) {
        const selectedIds = drag.additive ? (drag.beforeSelectedIds || []) : [];
        dispatch({type:"SET_UI", patch:{drag:null, selectedIds, selectedHandle:null, snapIndicator:undefined, status:selectedIds.length ? `Selected ${selectedIds.length} object${selectedIds.length === 1 ? "" : "s"}.` : "Selection cleared."}});
      } else {
        const boxed = visibleObjects(projectRef.current).filter(o => objectInsideSelectionBox(o, drag.start, end)).map(o => o.id);
        const selectedIds = drag.additive ? Array.from(new Set([...(drag.beforeSelectedIds || []), ...boxed])) : boxed;
        dispatch({type:"SET_UI", patch:{drag:null, selectedIds, selectedHandle:null, snapIndicator:undefined, status:`Selected ${selectedIds.length} object${selectedIds.length === 1 ? "" : "s"}.`}});
      }
    } else if (drag.mode === "draw-freehand") {
      const d = uiRef.current.drawing;
      if (d?.tool === "sketch") {
        const p = clampPointToWorkspace(projectRef.current, screenToM(e));
        const last = d.points[d.points.length - 1];
        const points = last && distance(last, p) >= .1 && d.points.length < FREEHAND_MAX_POINTS ? [...d.points, p] : d.points;
        const obj = createObjectForTool("sketch", points);
        if (obj) {
          const next = { ...projectRef.current, objects: [...projectRef.current.objects, obj] };
          dispatch({type:"PROJECT_APPLY", project:next, status:`Created ${displayObjectType(obj)}.`});
          dispatch({type:"SET_UI", patch:{drawing:null, drag:null, selectedIds:[obj.id], tool:"select", snapIndicator:undefined}});
        } else {
          dispatch({type:"SET_UI", patch:{drawing:null, drag:null, snapIndicator:undefined, status:"Hand-drawn line was too short to create."}});
        }
      }
    } else if (drag.mode === "draw-rect" || drag.mode === "draw-circle") {
      const d = uiRef.current.drawing;
      if (d?.start && d.current) {
        const obj = createObjectForTool(d.tool, [d.start, d.current]);
        if (obj) {
          const next = { ...projectRef.current, objects: [...projectRef.current.objects, obj] };
          dispatch({type:"PROJECT_APPLY", project:next, status:`Created ${displayObjectType(obj)}.`});
          dispatch({type:"SET_UI", patch:{drawing:null, drag:null, selectedIds:[obj.id], tool:"select"}});
        } else {
          dispatch({type:"SET_UI", patch:{drawing:null, drag:null, status:"Shape was too small to create."}});
        }
      }
    } else if (drag.beforeProject) {
      dispatch({type:"PROJECT_COMMIT_FROM", beforeProject:drag.beforeProject, status:"Edit committed."});
    } else {
      dispatch({type:"SET_UI", patch:{drag:null}});
    }
    try { svgRef.current?.releasePointerCapture(e.pointerId); } catch {}
  };

  const onDoubleClick = (e: any) => {
    if (uiRef.current.drawing) commitDrawing();
  };

  const onWheel = (e: any) => {
    e.preventDefault();
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const old = uiRef.current.viewport;
    const factor = e.deltaY > 0 ? .9 : 1.1;
    const scale = clamp(old.scale * factor, .15, 6);
    const worldX = (sx - old.panX) / old.scale;
    const worldY = (sy - old.panY) / old.scale;
    const panX = sx - worldX * scale;
    const panY = sy - worldY * scale;
    dispatch({type:"SET_UI", patch:{viewport:{scale, panX, panY}, status:`Zoom ${Math.round(scale*100)}%.`}});
  };

  const className = `svg-workspace ${ui.tool === "select" ? "select-cursor" : ""} ${(ui.tool === "pan" || ui.spaceDown) ? "pan-cursor" : ""} ${ui.drag?.mode === "pan" ? "panning" : ""}`;

  return <main className="workspace-wrap">
    <svg ref={svgRef} className={className} role="application" aria-label="Backyard drawing workspace" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick} onWheel={onWheel}>
      <g transform={`translate(${ui.viewport.panX} ${ui.viewport.panY}) scale(${ui.viewport.scale})`}>
        <Grid project={project} />
        <rect x={0} y={0} width={mToPx(project.workspace.widthM)} height={mToPx(project.workspace.heightM)} fill="none" stroke="#0f172a" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <g>
          {visible.map(o => <PlanObjectView key={o.id} o={o} selected={ui.selectedIds.includes(o.id)} hovered={ui.hoveredId === o.id} project={project} dispatch={dispatch} />)}
        </g>
        {project.settings.showMeasurements && <g>{visible.filter(o => o.kind !== "label").map(o => <MeasurementLabels key={`m-${o.id}`} o={o} />)}</g>}
        <g>{visible.map(o => <ObjectAttachedLabel key={`label-${o.id}`} o={o} />)}</g>
        <DrawingPreview drawing={ui.drawing} />
        <SelectionBoxPreview drag={ui.drag} />
        {ui.snapIndicator && <g pointerEvents="none">
          {ui.snapIndicator.line && <line className="snap-guide" x1={mToPx(ui.snapIndicator.line[0].x)} y1={mToPx(ui.snapIndicator.line[0].y)} x2={mToPx(ui.snapIndicator.line[1].x)} y2={mToPx(ui.snapIndicator.line[1].y)} />}
          <circle className="snap-dot" cx={mToPx(ui.snapIndicator.point.x)} cy={mToPx(ui.snapIndicator.point.y)} r={5} />
          <text className="measurement-label" x={mToPx(ui.snapIndicator.point.x + .9)} y={mToPx(ui.snapIndicator.point.y - .7)}>{ui.snapIndicator.label}</text>
        </g>}
        <Handles project={project} selectedIds={ui.selectedIds} selectedHandle={ui.selectedHandle} dispatch={dispatch} />
      </g>
    </svg>
    <div className="workspace-overlay"><div className="pill">{fmtM(project.workspace.widthM)} × {fmtM(project.workspace.heightM)} workspace</div><ScaleIndicator viewport={ui.viewport} /></div>
    {ui.drawing && <div className="drawing-actions" role="group" aria-label="Drawing actions">
      <button className="btn" onClick={() => commitDrawing()}>Finish</button>
      <button className="btn" onClick={() => dispatch({type:"SET_UI", patch:{drawing:null, drag:null, status:"Drawing cancelled."}})}>Cancel</button>
      <span className="chip">Enter: finish · Esc: cancel</span>
    </div>}
  </main>;
}
