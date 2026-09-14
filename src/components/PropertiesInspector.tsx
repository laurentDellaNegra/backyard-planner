import React, { useEffect, useMemo, useRef } from "react";
import {
  type Layer,
  type Style,
  type AttachedLabel,
  type PlanObject,
  type Project,
  type SelectedHandle,
  type HistoryState,
  fmtM,
  fmtM2,
  round1,
  clamp,
  uid,
  deepClone,
  distance,
  add,
  getRotation,
  polygonArea,
  circleArea,
  polygonWarnings,
  pathMinPointCount,
  pathSegmentCount,
  deleteVertexFromObject,
  deleteSegmentFromObject,
  defaultObjectLabelOffset,
  rotateObject,
  setObjectRotation,
  isMeasurementVisible,
  objectMeasurementItems,
  moveObject,
  objectMeasurements,
  KIND_STYLE,
  TAILWIND_PALETTE,
  displayObjectType,
  isLineLike,
  objectColor,
  resizeWorkspace,
  expandWorkspaceToPropertyBoundary,
  getLayer,
  isEditable,
  selectedObjects,
  updateObject,
  updateObjects,
  deriveQuantities
} from "../model";

function NumberField({ label, value, onChange, step=.1, min, max, disabled=false }: any) {
  return <div className="field"><label>{label}</label><input className="input" type="number" step={step} min={min} max={max} disabled={disabled} value={Number.isFinite(value) ? round1(value) : 0} onChange={e => onChange(round1(parseFloat(e.target.value || "0")))} /></div>;
}

function ColorPalette({ value, onChange, disabled=false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const current = String(value || "").toLowerCase();
  return <div className="tailwind-palette" role="grid" aria-label="Tailwind color palette">
    {TAILWIND_PALETTE.map(color => {
      const selected = current === color.value;
      return <button
        type="button"
        key={color.name}
        className={`color-swatch ${selected ? "selected" : ""}`}
        style={{ backgroundColor: color.value }}
        title={`${color.name} ${color.value}`}
        aria-label={`${color.name} ${color.value}`}
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => onChange(color.value)}
      />;
    })}
  </div>;
}

function LayersPanel({ project, dispatch }: { project: Project; dispatch: any }) {
  const apply = (p: Project, status?: string) => dispatch({type:"PROJECT_APPLY", project:p, status});
  const toggle = (id: string, key: "visible" | "locked") => apply({ ...project, layers: project.layers.map(l => l.id === id ? { ...l, [key]: !l[key] } : l) }, `Layer ${key} toggled.`);
  return <div className="panel"><div className="panel-header"><span>Layers</span><span className="tiny muted">hide / lock</span></div><div className="panel-body stack">
    {project.layers.sort((a,b)=>a.order-b.order).map(l => <div className="layer-row" key={l.id}>
      <button className="icon-btn" aria-label={`${l.visible ? "Hide" : "Show"} ${l.name}`} title="Show/hide layer" onClick={() => toggle(l.id, "visible")}>{l.visible ? "👁" : "—"}</button>
      <button className="icon-btn" aria-label={`${l.locked ? "Unlock" : "Lock"} ${l.name}`} title="Lock/unlock layer" onClick={() => toggle(l.id, "locked")}>{l.locked ? "🔒" : "🔓"}</button>
      <span className="small">{l.name}</span>
      <span className="chip">{project.objects.filter(o=>o.layerId===l.id).length}</span>
    </div>)}
  </div></div>;
}

function QuantitiesPanel({ project, dispatch }: { project: Project; dispatch: any }) {
  const q = useMemo(() => deriveQuantities(project), [project]);
  return <div className="panel"><div className="panel-header"><span>Quantities</span><span className="tiny muted">meters only</span></div><div className="panel-body stack">
    <div className="measure-list">
      <div><span>Polygon area</span><strong>{fmtM2(q.polygonArea)}</strong></div>
      <div><span>Rectangle area</span><strong>{fmtM2(q.rectangleArea)}</strong></div>
      <div><span>Circle area</span><strong>{fmtM2(q.circleArea)}</strong></div>
      <div><span>Line length</span><strong>{fmtM(q.lineLength)}</strong></div>
      <div><span>Hand-drawn length</span><strong>{fmtM(q.sketchLength)}</strong></div>
      <div><span>Text objects</span><strong>{q.textCount}</strong></div>
    </div>
    <div className="stack" aria-label="Object inventory list">
      {q.inventory.length ? q.inventory.map(item => <button key={item.id} className="inventory-row" onClick={() => dispatch({type:"SET_UI", patch:{selectedIds:[item.id], selectedHandle:null, status:`Selected ${item.name}.`}})}><span>{item.name}</span><span className="chip">{item.value || "object"}</span></button>) : <div className="muted small">No objects yet.</div>}
    </div>
  </div></div>;
}

function ProjectPanel({ project, dispatch }: { project: Project; dispatch: any }) {
  const apply = (patch: Partial<Project>, status?: string) => dispatch({type:"PROJECT_APPLY", project:{...project, ...patch}, status});
  const updateWorkspace = (key: "widthM"|"heightM", value: number) => {
    const workspace = { ...project.workspace, [key]: clamp(value, 5, 500) };
    dispatch({type:"PROJECT_APPLY", project:resizeWorkspace(project, workspace), status:"Workspace updated."});
  };
  return <div className="panel"><div className="panel-header"><span>Project</span><span className="chip">{project.units}</span></div><div className="panel-body stack">
    <div className="field"><label>Project name</label><input className="input" value={project.name} onChange={e => apply({name:e.target.value}, "Project renamed.")} /></div>
    <div className="two-cols">
      <NumberField label="Width (m)" value={project.workspace.widthM} min={5} max={500} onChange={(v:number)=>updateWorkspace("widthM", v)} />
      <NumberField label="Height (m)" value={project.workspace.heightM} min={5} max={500} onChange={(v:number)=>updateWorkspace("heightM", v)} />
    </div>
    <div className="ok-box">Autosave is local to this browser. Export JSON for portable editable backups.</div>
  </div></div>;
}

function InspectorObjectEditor({ project, object, dispatch, selectedHandle }: { project: Project; object: PlanObject; dispatch: any; selectedHandle: SelectedHandle }) {
  const layer = getLayer(project, object.layerId);
  const editable = isEditable(project, object);
  const canToggleObjectLock = !!layer && layer.visible && !layer.locked && object.visible;
  const canRotateObject = editable && object.kind !== "property";
  const applyObject = (patcher: (o: PlanObject) => PlanObject, status?: string) => dispatch({ type:"PROJECT_APPLY", project:expandWorkspaceToPropertyBoundary(updateObject(project, object.id, patcher)), status });
  const patch = (partial: any, status?: string) => applyObject(o => ({ ...o, ...partial } as PlanObject), status);
  const style = object.style || KIND_STYLE[object.kind];
  const color = objectColor(object);
  const measurements = objectMeasurements(object) as any;
  const measurementItems = objectMeasurementItems(object, false);
  const dimensionItems = measurementItems.filter(item => !item.id.startsWith("angle-"));
  const angleItems = measurementItems.filter(item => item.id.startsWith("angle-"));
  const segmentCount = pathSegmentCount(object);
  const selectedSegment = selectedHandle?.objectId === object.id && selectedHandle.kind === "segment" ? selectedHandle.index : undefined;
  const warnings = object.type === "polygon" ? polygonWarnings(object.points) : [];
  const deleteObject = () => {
    if (object.kind === "property") { dispatch({type:"SET_UI", patch:{status:"Property boundary cannot be deleted; edit its vertices instead."}}); return; }
    dispatch({ type:"PROJECT_APPLY", project:{...project, objects:project.objects.filter(o=>o.id!==object.id)}, status:"Object deleted." });
    dispatch({ type:"SET_UI", patch:{selectedIds:[], selectedHandle:null} });
  };
  const duplicateObject = () => {
    const copy = moveObject({ ...deepClone(object), id: uid(object.kind), name: `${object.name} copy`, z: Date.now() } as PlanObject, 1, 1);
    dispatch({ type:"PROJECT_APPLY", project:{...project, objects:[...project.objects, copy]}, status:"Object duplicated." });
    dispatch({ type:"SET_UI", patch:{selectedIds:[copy.id]} });
  };
  const bringForward = () => patch({ z: Math.max(...project.objects.filter(o=>o.layerId===object.layerId).map(o=>o.z), object.z) + 1 }, "Brought forward.");
  const sendBackward = () => patch({ z: Math.min(...project.objects.filter(o=>o.layerId===object.layerId).map(o=>o.z), object.z) - 1 }, "Sent backward.");
  const updateStyle = (key: keyof Style, value: any) => patch({ style: { ...style, [key]: value } }, "Style updated.");
  const updateColor = (value: string) => {
    const fill = object.kind === "property" ? value : (isLineLike(object) ? "none" : value);
    patch({ style: { ...style, fill, stroke: value } }, "Color updated.");
  };
  const rotateBy = (degrees: number) => applyObject(o => rotateObject(o, degrees), "Rotated.");
  const updateRotation = (degrees: number) => applyObject(o => setObjectRotation(o, degrees), "Rotation updated.");
  const currentObjectLabel = object.objectLabel || { visible: false, text: object.name, offset: defaultObjectLabelOffset(object), fontSizeM: 1.3 };
  const updateObjectLabel = (partial: Partial<AttachedLabel>, status = "Object label updated.") => patch({ objectLabel: { ...currentObjectLabel, ...partial } }, status);
  const toggleAllMeasurements = () => patch({ measurementHidden: !object.measurementHidden }, "Dimension visibility updated.");
  const toggleMeasurement = (id: string) => {
    const hidden = new Set(object.hiddenMeasurements || []);
    hidden.has(id) ? hidden.delete(id) : hidden.add(id);
    patch({ hiddenMeasurements: Array.from(hidden) }, "Dimension visibility updated.");
  };
  const deleteSelectedVertex = () => {
    if (!selectedHandle || selectedHandle.objectId !== object.id || selectedHandle.kind !== "vertex") return;
    if (object.type !== "polygon" && object.type !== "polyline") return;
    const min = pathMinPointCount(object);
    const index = selectedHandle.index ?? -1;
    if (!deleteVertexFromObject(object, index)) { dispatch({type:"SET_UI", patch:{status:`Cannot delete: ${object.type} needs at least ${min} vertices.`}}); return; }
    applyObject(o => deleteVertexFromObject(o, index) || o, "Vertex deleted.");
    dispatch({type:"SET_UI", patch:{selectedHandle:null}});
  };
  const deleteSegment = (index: number) => {
    if (object.type !== "polygon" && object.type !== "polyline") return;
    const min = pathMinPointCount(object);
    if (!deleteSegmentFromObject(object, index)) { dispatch({type:"SET_UI", patch:{status:`Cannot delete: ${object.type} needs at least ${min} vertices.`}}); return; }
    applyObject(o => deleteSegmentFromObject(o, index) || o, "Segment deleted.");
    dispatch({type:"SET_UI", patch:{selectedHandle:null}});
  };
  const deleteSelectedSegment = () => {
    if (selectedSegment === undefined) return;
    deleteSegment(selectedSegment);
  };
  const updatePoint = (index: number, key: "x"|"y", value: number) => applyObject(o => {
    if (o.type !== "polygon" && o.type !== "polyline") return o;
    const pts = o.points.map((p,i) => i === index ? { ...p, [key]: round1(value) } : p);
    return { ...o, points: pts } as PlanObject;
  }, "Vertex updated.");

  return <div className="panel"><div className="panel-header"><span>{displayObjectType(object)}</span><span className="chip">{object.type}</span></div><div className="panel-body stack">
    {!editable && <div className="warning-box">This object is locked, hidden, or on a locked/hidden layer. Unlock it before editing geometry.</div>}
    {warnings.map((w,i) => <div key={i} className="warning-box">{w}</div>)}
    <div className="field"><label>Name</label><input className="input" value={object.name} disabled={!editable && object.kind !== "property"} onChange={e => patch({name:e.target.value}, "Name updated.")} /></div>
    <div className="two-cols">
      <div className="field"><label>Layer</label><select className="select" value={object.layerId} disabled={!editable || object.kind === "property"} onChange={e => patch({layerId:e.target.value}, "Layer changed.")}>{project.layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
      <div className="field"><label>Type</label><input className="input" value={displayObjectType(object)} disabled /></div>
    </div>
    <div className="row wrap">
      <button className="btn" disabled={!canToggleObjectLock} onClick={() => patch({locked:!object.locked}, object.locked ? "Unlocked." : "Locked.")}>{object.locked ? "Unlock" : "Lock"}</button>
      <button className="btn" disabled={!editable} onClick={duplicateObject}>Duplicate</button>
      <button className="btn" disabled={!editable} onClick={bringForward}>Bring forward</button>
      <button className="btn" disabled={!editable} onClick={sendBackward}>Send backward</button>
      <button className="btn danger" disabled={!editable || object.kind === "property"} onClick={deleteObject}>Delete</button>
    </div>
    {object.kind !== "property" && <div className="stack">
      <strong className="small">Rotation</strong>
      <div className="three-cols">
        <button className="btn" disabled={!canRotateObject} onClick={() => rotateBy(-15)}>⟲ 15°</button>
        <NumberField label="Angle (°)" value={getRotation(object)} min={0} max={359.9} disabled={!canRotateObject} onChange={(v:number)=>updateRotation(v)} />
        <button className="btn" disabled={!canRotateObject} onClick={() => rotateBy(15)}>15° ⟳</button>
      </div>
    </div>}
    {object.type !== "label" && <div className="stack">
      <strong className="small">Object label</strong>
      <label className="checkbox-line"><input type="checkbox" disabled={!editable} checked={!!currentObjectLabel.visible} onChange={() => updateObjectLabel({ visible: !currentObjectLabel.visible })} /> <span>Show label</span></label>
      {currentObjectLabel.visible && <div className="stack">
        <div className="field"><label>Label text</label><input className="input" disabled={!editable} value={currentObjectLabel.text} onChange={e => updateObjectLabel({ text: e.target.value })} /></div>
        <div className="three-cols">
          <NumberField label="Offset X" value={currentObjectLabel.offset?.x || 0} disabled={!editable} onChange={(v:number)=>updateObjectLabel({ offset: { ...(currentObjectLabel.offset || {x:0,y:0}), x:v } })} />
          <NumberField label="Offset Y" value={currentObjectLabel.offset?.y || 0} disabled={!editable} onChange={(v:number)=>updateObjectLabel({ offset: { ...(currentObjectLabel.offset || {x:0,y:0}), y:v } })} />
          <NumberField label="Text size" value={currentObjectLabel.fontSizeM || 1.3} min={.3} disabled={!editable} onChange={(v:number)=>updateObjectLabel({ fontSizeM:Math.max(.3,v) })} />
        </div>
      </div>}
    </div>}
    <div className="measure-list">
      {measurements.area !== undefined && <div><span>Area</span><strong>{fmtM2(measurements.area)}</strong></div>}
      {measurements.perimeter !== undefined && <div><span>Perimeter</span><strong>{fmtM(measurements.perimeter)}</strong></div>}
      {measurements.length !== undefined && <div><span>Length</span><strong>{fmtM(measurements.length)}</strong></div>}
      {measurements.width !== undefined && <div><span>Width</span><strong>{fmtM(measurements.width)}</strong></div>}
      {measurements.height !== undefined && <div><span>Height</span><strong>{fmtM(measurements.height)}</strong></div>}
      {measurements.diameter !== undefined && <div><span>Diameter</span><strong>{fmtM(measurements.diameter)}</strong></div>}
    </div>
    {measurementItems.length > 0 && <div className="stack">
      <strong className="small">Dimensions</strong>
      <label className="checkbox-line"><input type="checkbox" disabled={!editable} checked={!object.measurementHidden} onChange={toggleAllMeasurements} /> Show dimensions</label>
      <div className="stack">
        {dimensionItems.map(item => <label className="checkbox-line" key={item.id}>
          <input type="checkbox" disabled={!editable || !!object.measurementHidden} checked={isMeasurementVisible(object, item.id)} onChange={() => toggleMeasurement(item.id)} />
          <span>{item.label}: {item.value}</span>
        </label>)}
      </div>
      {object.type === "polygon" && <div className="stack">
        <label className="checkbox-line"><input type="checkbox" disabled={!editable || !!object.measurementHidden} checked={!!object.showAngles} onChange={() => patch({ showAngles: !object.showAngles }, "Angle label visibility updated.")} /> Show angle labels</label>
        {object.showAngles && <>
          <div className="muted small">Interior angles update as you edit. Drag labels to reposition them.</div>
          {angleItems.map(item => <label className="checkbox-line" key={item.id}>
            <input type="checkbox" disabled={!editable || !!object.measurementHidden} checked={isMeasurementVisible(object, item.id)} onChange={() => toggleMeasurement(item.id)} />
            <span>{item.label}: {item.value}</span>
          </label>)}
        </>}
      </div>}
    </div>}

    {object.type === "rectangle" && <div className="three-cols">
      <NumberField label="X" value={object.x} onChange={(v:number)=>patch({x:v}, "X updated.")} />
      <NumberField label="Y" value={object.y} onChange={(v:number)=>patch({y:v}, "Y updated.")} />
      <span />
      <NumberField label="Width" value={object.width} min={.1} onChange={(v:number)=>patch({width:Math.max(.1,v)}, "Width updated.")} />
      <NumberField label="Height" value={object.height} min={.1} onChange={(v:number)=>patch({height:Math.max(.1,v)}, "Height updated.")} />
    </div>}
    {object.type === "circle" && <div className="three-cols">
      <NumberField label="Center X" value={object.cx} onChange={(v:number)=>patch({cx:v}, "Center updated.")} />
      <NumberField label="Center Y" value={object.cy} onChange={(v:number)=>patch({cy:v}, "Center updated.")} />
      <NumberField label="Diameter" value={object.r*2} min={.2} onChange={(v:number)=>patch({r:Math.max(.1, round1(v/2))}, "Diameter updated.")} />
    </div>}
    {object.type === "label" && <div className="stack">
      <div className="field"><label>Text</label><textarea className="textarea" value={object.text} onChange={e => patch({text:e.target.value}, "Label updated.")} /></div>
      <div className="three-cols"><NumberField label="X" value={object.x} onChange={(v:number)=>patch({x:v}, "X updated.")} /><NumberField label="Y" value={object.y} onChange={(v:number)=>patch({y:v}, "Y updated.")} /><NumberField label="Text size" value={object.fontSizeM} min={.3} onChange={(v:number)=>patch({fontSizeM:Math.max(.3,v)}, "Text size updated.")} /></div>
    </div>}
    {object.type === "polyline" && object.kind === "sketch" && <div className="measure-list"><div><span>Sampled points</span><strong>{object.points.length}</strong></div></div>}
    {(object.type === "polygon" || object.type === "polyline") && object.kind !== "sketch" && <div className="stack">
      <div className="row between"><strong className="small">Vertices</strong><button className="btn danger" disabled={!selectedHandle || selectedHandle.objectId !== object.id || selectedHandle.kind !== "vertex"} onClick={deleteSelectedVertex}>Delete selected vertex</button></div>
      <div className="stack">
        {object.points.map((p, i) => <div className="two-cols" key={i}>
          <NumberField label={`V${i+1} X`} value={p.x} onChange={(v:number)=>updatePoint(i,"x",v)} />
          <NumberField label={`V${i+1} Y`} value={p.y} onChange={(v:number)=>updatePoint(i,"y",v)} />
        </div>)}
      </div>
      {segmentCount > 0 && <div className="stack">
        <div className="row between"><strong className="small">Segments</strong><button className="btn danger" disabled={selectedSegment === undefined} onClick={deleteSelectedSegment}>Delete selected segment</button></div>
        <div className="stack">
          {Array.from({ length: segmentCount }).map((_, i) => {
            const a = object.points[i], b = object.points[(i + 1) % object.points.length];
            const selected = selectedSegment === i;
            return <div className="row between" key={i}>
              <button className="btn" disabled={!editable} aria-pressed={selected} onClick={() => dispatch({type:"SET_UI", patch:{selectedHandle:{objectId:object.id, kind:"segment", index:i}, status:`Segment ${i + 1} selected.`}})}>Segment {i + 1}: {fmtM(distance(a, b))}</button>
              <button className="btn danger" disabled={!editable} onClick={() => deleteSegment(i)}>Delete</button>
            </div>;
          })}
        </div>
      </div>}
    </div>}
    <div className="stack">
      <strong className="small">Style</strong>
      <div className="stack">
        <div className="field"><label>Color</label><ColorPalette value={color} disabled={!editable} onChange={updateColor} /></div>
      </div>
      <div className="two-cols">
        {object.type !== "label" ? <NumberField label="Stroke width" value={style.strokeWidth} min={0} disabled={!editable} onChange={(v:number)=>updateStyle("strokeWidth", Math.max(0,v))} /> : <span />}
        <NumberField label="Opacity" value={style.opacity} min={0} max={1} step={.1} disabled={!editable} onChange={(v:number)=>updateStyle("opacity", clamp(v,0,1))} />
      </div>
    </div>
  </div></div>;
}

export function PropertiesInspector({ state, dispatch }: { state: HistoryState; dispatch: any }) {
  const { project, ui } = state;
  const selected = selectedObjects(project, ui.selectedIds);
  return <aside className="inspector" aria-label="Properties inspector">
    {selected.length === 1 ? <InspectorObjectEditor project={project} object={selected[0]} dispatch={dispatch} selectedHandle={ui.selectedHandle} /> : selected.length > 1 ? <MultiSelectionPanel project={project} selected={selected} dispatch={dispatch} /> : <ProjectPanel project={project} dispatch={dispatch} />}
    <LayersPanel project={project} dispatch={dispatch} />
    <QuantitiesPanel project={project} dispatch={dispatch} />
    <div className="panel"><div className="panel-header"><span>Shortcuts</span></div><div className="panel-body small stack">
      <div><span className="kbd">V</span> Select · <span className="kbd">P</span> Polygon · <span className="kbd">L</span> Line · <span className="kbd">R</span> Rectangle · <span className="kbd">C</span> Circle · <span className="kbd">T</span> Text</div>
      <div><span className="kbd">Space</span> Pan · <span className="kbd">Esc</span> cancel/clear · <span className="kbd">Del</span> delete · arrows nudge</div>
      <div className={ui.tests.failures.length ? "warning-box" : "ok-box"}>Geometry tests: {ui.tests.passed}/{ui.tests.total} passed{ui.tests.failures.length ? ` — ${ui.tests.failures.join(", ")}` : ""}</div>
    </div></div>
  </aside>;
}

function MultiSelectionPanel({ project, selected, dispatch }: { project: Project; selected: PlanObject[]; dispatch: any }) {
  const editableIds = selected.filter(o => isEditable(project, o) && o.kind !== "property").map(o => o.id);
  const apply = (p: Project, status?: string) => dispatch({type:"PROJECT_APPLY", project:p, status});
  const moveLayer = (layerId: string) => apply(updateObjects(project, editableIds, o => ({...o, layerId} as PlanObject)), "Moved selected objects to layer.");
  const rotateSelected = (degrees: number) => apply(updateObjects(project, editableIds, o => rotateObject(o, degrees)), "Rotated selected objects.");
  const deleteSelected = () => { apply({...project, objects:project.objects.filter(o => !editableIds.includes(o.id))}, "Deleted selected objects."); dispatch({type:"SET_UI", patch:{selectedIds:[]}}); };
  const duplicate = () => {
    const copies = selected.filter(o=>editableIds.includes(o.id)).map(o => moveObject({ ...deepClone(o), id: uid(o.kind), name: `${o.name} copy`, z: Date.now() + Math.random() } as PlanObject, 1, 1));
    apply({...project, objects:[...project.objects, ...copies]}, "Duplicated selected objects.");
    dispatch({type:"SET_UI", patch:{selectedIds:copies.map(o=>o.id)}});
  };
  return <div className="panel"><div className="panel-header"><span>{selected.length} selected objects</span></div><div className="panel-body stack">
    <div className="field"><label>Move to layer</label><select className="select" onChange={e => moveLayer(e.target.value)} defaultValue=""><option value="" disabled>Choose layer…</option>{project.layers.filter(l=>l.id!=="property").map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
    <div className="row wrap"><button className="btn" disabled={!editableIds.length} onClick={() => rotateSelected(-15)}>⟲ 15°</button><button className="btn" disabled={!editableIds.length} onClick={() => rotateSelected(15)}>15° ⟳</button><button className="btn" onClick={duplicate}>Duplicate</button><button className="btn danger" onClick={deleteSelected}>Delete editable</button></div>
  </div></div>;
}
