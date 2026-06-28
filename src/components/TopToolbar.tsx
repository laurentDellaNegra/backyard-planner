import React, { useEffect, useMemo, useRef } from "react";
import {
  type Project,
  type HistoryState,
  STORAGE_KEY,
  clamp,
  midpoint,
  normalizedProject,
  downloadText,
  exportProjectPng,
  loadStarterProject
} from "../model";

export function IconButton({ label, title, children, onClick, disabled=false, pressed, className="" }: any) {
  const props: any = { className: `${pressed === undefined ? "icon-btn" : "toggle-btn compact"} ${className}`, title: title || label, "aria-label": label, onClick, disabled };
  if (pressed !== undefined) props["aria-pressed"] = pressed;
  return <button {...props}>{children}</button>;
}

export function TopToolbar({ state, dispatch, fitWorkspace }: { state: HistoryState; dispatch: any; fitWorkspace: () => void }) {
  const { project, past, future, ui } = state;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const applyProject = (project: Project, status?: string) => dispatch({ type: "PROJECT_APPLY", project, status });
  const toggleSetting = (key: keyof Project["settings"]) => applyProject({ ...project, settings: { ...project.settings, [key]: !project.settings[key] } }, `${key} ${project.settings[key] ? "off" : "on"}.`);
  const exportJson = () => downloadText(`${project.name.replace(/[^a-z0-9]+/gi,"-") || "backyard-plan"}.json`, JSON.stringify({ ...project, savedAt: new Date().toISOString() }, null, 2));
  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { dispatch({ type: "IMPORT_PROJECT", project: normalizedProject(JSON.parse(String(reader.result))) }); }
      catch(e) { dispatch({ type: "SET_UI", patch: { status: `Import failed: ${(e as Error).message}` } }); }
    };
    reader.readAsText(file);
  };
  const save = () => {
    const saved = { ...project, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    applyProject(saved, "Project saved to localStorage.");
  };
  const loadPlanV1 = async () => {
    if (!confirm("Load plan v1? This will replace the current project and then autosave it in this browser.")) return;
    dispatch({ type:"SET_UI", patch:{ status:"Loading plan v1..." } });
    try {
      dispatch({ type:"IMPORT_PROJECT", project:await loadStarterProject(), status:"Plan v1 loaded." });
    } catch (e) {
      dispatch({ type:"SET_UI", patch:{ status:`Plan v1 load failed: ${(e as Error).message}` } });
    }
  };
  const zoom = (factor: number) => dispatch({ type: "SET_UI", patch: { viewport: { ...ui.viewport, scale: clamp(ui.viewport.scale * factor, .15, 6) }, status: `Zoom ${Math.round(clamp(ui.viewport.scale * factor, .15, 6) * 100)}%.` } });

  return <div className="top-toolbar" role="toolbar" aria-label="Project toolbar">
    <div className="brand"><span className="brand-mark" aria-hidden="true"></span><span>Backyard Planner</span></div>
    <div className="toolbar-group">
      <button className="btn" title="Create a new empty project" onClick={() => { if (confirm("Create a new project? Unsaved changes remain only in browser history/autosave.")) dispatch({ type: "NEW_PROJECT" }); }}>New</button>
      <button className="btn" title="Load plans/plan-terrain-v1.json" onClick={loadPlanV1}>Load Plan v1</button>
      <button className="btn" title="Save to this browser's localStorage" onClick={save}>Save</button>
    </div>
    <div className="toolbar-group">
      <IconButton label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!past.length} onClick={() => dispatch({type:"UNDO"})}>↶</IconButton>
      <IconButton label="Redo" title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)" disabled={!future.length} onClick={() => dispatch({type:"REDO"})}>↷</IconButton>
    </div>
    <div className="toolbar-group">
      <IconButton label="Zoom out" title="Zoom out" onClick={() => zoom(.82)}>−</IconButton>
      <span className="chip" aria-label="Current zoom">{Math.round(ui.viewport.scale * 100)}%</span>
      <IconButton label="Zoom in" title="Zoom in" onClick={() => zoom(1.22)}>＋</IconButton>
      <button className="btn" title="Fit workspace" onClick={fitWorkspace}>Fit</button>
    </div>
    <div className="toolbar-group" aria-label="View and snap toggles">
      <IconButton label="Toggle grid" title="Grid" pressed={project.settings.showGrid} onClick={() => toggleSetting("showGrid")}>▦</IconButton>
      <IconButton label="Toggle measurements" title="Measurements" pressed={project.settings.showMeasurements} onClick={() => toggleSetting("showMeasurements")}>⌁</IconButton>
      <IconButton label="Toggle grid snap" title="Snap to grid" pressed={project.settings.snapToGrid} onClick={() => toggleSetting("snapToGrid")}>#</IconButton>
      <IconButton label="Toggle vertex snap" title="Snap to vertices" pressed={project.settings.snapToVertices} onClick={() => toggleSetting("snapToVertices")}>●</IconButton>
      <IconButton label="Toggle edge snap" title="Snap to edges" pressed={project.settings.snapToEdges} onClick={() => toggleSetting("snapToEdges")}>╱</IconButton>
      <IconButton label="Toggle midpoint snap" title="Snap to midpoints" pressed={project.settings.snapToMidpoints} onClick={() => toggleSetting("snapToMidpoints")}>◇</IconButton>
      <IconButton label="Toggle orthogonal snap" title="Orthogonal 90°/180° snap" pressed={project.settings.orthogonalSnap} onClick={() => toggleSetting("orthogonalSnap")}>⟂</IconButton>
    </div>
    <div className="toolbar-group">
      <button className="btn" title="Export full editable project JSON" onClick={exportJson}>Export JSON</button>
      <button className="btn" title="Import project JSON" onClick={() => fileRef.current?.click()}>Import JSON</button>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
      <button className="btn" title="Export visible plan to PNG" onClick={() => exportProjectPng(project).then(() => dispatch({type:"SET_UI", patch:{status:"PNG exported."}})).catch((e) => dispatch({type:"SET_UI", patch:{status:`PNG export failed: ${e.message}`}}))}>Export PNG</button>
      <button className="btn" title="Manual QA checklist" onClick={() => dispatch({type:"SET_UI", patch:{showChecklist:true}})}>QA</button>
    </div>
  </div>;
}
