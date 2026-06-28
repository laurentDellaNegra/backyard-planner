import React, { useEffect, useMemo, useRef } from "react";
import {
  type Tool
} from "../model";

export const TOOL_GROUPS: { tools: { tool: Tool; icon: string; name: string; title: string }[] }[] = [
  { tools: [
    { tool:"select", icon:"↖", name:"Select", title:"Select/move (V)" },
    { tool:"pan", icon:"✥", name:"Pan", title:"Pan workspace (Space or middle mouse)" },
    { tool:"property", icon:"▱", name:"Boundary", title:"Edit property boundary" },
  ]},
  { tools: [
    { tool:"rect", icon:"▭", name:"Rect", title:"Draw rectangle (R)" },
    { tool:"polygon", icon:"⬟", name:"Polygon", title:"Draw polygon (P)" },
    { tool:"line", icon:"╱", name:"Line", title:"Draw line/polyline (L)" },
    { tool:"circle", icon:"◯", name:"Circle", title:"Draw circle (C)" },
    { tool:"sketch", icon:"〰", name:"Sketch", title:"Draw hand-drawn line" },
    { tool:"label", icon:"T", name:"Text", title:"Place text (T)" },
  ]},
];

export function ToolPalette({ tool, dispatch }: { tool: Tool; dispatch: any }) {
  return <aside className="tool-palette" aria-label="Drawing tools">
    {TOOL_GROUPS.map((group, gi) => <React.Fragment key={gi}>
      {gi > 0 && <div className="palette-divider" />}
      {group.tools.map(t => <button key={t.tool} className={`tool-btn ${tool === t.tool ? "active" : ""}`} aria-label={t.title} title={t.title} onClick={() => dispatch({ type:"SET_TOOL", tool:t.tool, status:`${t.name} tool active.` })}>
        <span className="tool-icon" aria-hidden="true">{t.icon}</span><span className="tool-name">{t.name}</span>
      </button>)}
    </React.Fragment>)}
  </aside>;
}
