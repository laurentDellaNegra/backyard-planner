import { useEffect, useReducer, useRef } from "react";
import { TopToolbar } from "./components/TopToolbar";
import {
  type PolygonObject,
  type Tool,
  STORAGE_KEY,
  fmtM,
  pathMinPointCount,
  deleteVertexFromObject,
  deleteSegmentFromObject,
  moveObject,
  displayObjectType,
  createObjectForTool,
  isEditable,
  updateObject,
  updateObjects,
  initialUi,
  loadInitialProject,
  appReducer
} from "./model";
import { ToolPalette } from "./components/ToolPalette";
import { SvgWorkspace } from "./components/SvgWorkspace";
import { PropertiesInspector } from "./components/PropertiesInspector";
import { StatusBar } from "./components/StatusBar";
import { ChecklistModal } from "./components/ChecklistModal";

function App() {
  const [state, dispatch] = useReducer(appReducer, null as any, () => ({ project: loadInitialProject(), past: [], future: [], ui: initialUi }));
  const fitRef = useRef<(() => void) | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state.project, savedAt: new Date().toISOString() })); } catch (e) { console.warn("Autosave failed", e); }
    }, 350);
    return () => clearTimeout(t);
  }, [state.project]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const editingText = ["INPUT","TEXTAREA","SELECT"].includes(target.tagName);
      if (e.code === "Space" && !editingText) { e.preventDefault(); dispatch({type:"SET_UI", patch:{spaceDown:true}}); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); dispatch({type:e.shiftKey ? "REDO" : "UNDO"}); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") { e.preventDefault(); dispatch({type:"REDO"}); return; }
      if (editingText) return;
      const key = e.key.toLowerCase();
      const toolKeys: Record<string, Tool> = { v:"select", p:"polygon", l:"line", r:"rect", c:"circle", t:"label" };
      if (toolKeys[key]) { e.preventDefault(); dispatch({type:"SET_TOOL", tool:toolKeys[key]}); return; }
      if (e.key === "Escape") { dispatch({type:"SET_UI", patch:{drawing:null, selectedIds:[], selectedHandle:null, drag:null, status:"Cancelled / selection cleared."}}); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const { project, ui } = stateRef.current;
        if (ui.selectedHandle?.kind === "vertex" || ui.selectedHandle?.kind === "segment") {
          const object = project.objects.find(o => o.id === ui.selectedHandle?.objectId);
          if (object && (object.type === "polygon" || object.type === "polyline")) {
            const index = ui.selectedHandle.index ?? -1;
            const nextObject = ui.selectedHandle.kind === "vertex" ? deleteVertexFromObject(object, index) : deleteSegmentFromObject(object, index);
            if (nextObject) {
              const next = updateObject(project, object.id, () => nextObject);
              dispatch({type:"PROJECT_APPLY", project:next, status:ui.selectedHandle.kind === "vertex" ? "Vertex deleted." : "Segment deleted."});
              dispatch({type:"SET_UI", patch:{selectedHandle:null}});
            } else {
              dispatch({type:"SET_UI", patch:{status:`Cannot delete: ${object.type} needs at least ${pathMinPointCount(object)} vertices.`}});
            }
          }
          return;
        }
        const deletable = ui.selectedIds.filter(id => project.objects.find(o => o.id === id)?.kind !== "property");
        if (deletable.length) {
          dispatch({type:"PROJECT_APPLY", project:{...project, objects:project.objects.filter(o => !deletable.includes(o.id))}, status:"Deleted selected objects."});
          dispatch({type:"SET_UI", patch:{selectedIds:[], selectedHandle:null}});
        }
        return;
      }
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : .1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const { project, ui } = stateRef.current;
        const editable = ui.selectedIds.filter(id => isEditable(project, project.objects.find(o=>o.id===id)));
        if (editable.length) dispatch({type:"PROJECT_APPLY", project:updateObjects(project, editable, o => moveObject(o, dx, dy)), status:`Nudged ${fmtM(dx)}, ${fmtM(dy)}.`});
      }
      if (e.key === "Enter" && stateRef.current.ui.drawing) {
        e.preventDefault();
        // dispatching synthetic finish is done by storing a small flag in status; actual finish button is in workspace.
        const d = stateRef.current.ui.drawing;
        if (["polygon","property"].includes(d.tool) && d.points.length >= 3 || ["line","sketch"].includes(d.tool) && d.points.length >= 2) {
          const obj = createObjectForTool(d.tool, d.points);
          if (obj) {
            let next = stateRef.current.project;
            if (d.tool === "property") next = updateObject(next, "property-boundary", () => ({ ...(obj as PolygonObject), id:"property-boundary", name:"Property boundary", layerId:"property", z:0 }));
            else next = {...next, objects:[...next.objects, obj]};
            dispatch({type:"PROJECT_APPLY", project:next, status:`Created ${displayObjectType(obj)}.`});
            dispatch({type:"SET_UI", patch:{drawing:null, selectedIds:[obj.id], tool:"select"}});
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") dispatch({type:"SET_UI", patch:{spaceDown:false}}); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  return <div className="app-shell">
    <TopToolbar state={state} dispatch={dispatch} fitWorkspace={() => fitRef.current?.()} />
    <div className="editor-layout">
      <ToolPalette tool={state.ui.tool} dispatch={dispatch} />
      <SvgWorkspace state={state} dispatch={dispatch} fitRef={fitRef} />
      <PropertiesInspector state={state} dispatch={dispatch} />
    </div>
    <StatusBar state={state} />
    {state.ui.showChecklist && <ChecklistModal onClose={() => dispatch({type:"SET_UI", patch:{showChecklist:false}})} />}
  </div>;
}

export default App;
