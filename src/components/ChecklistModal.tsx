import React, { useEffect, useMemo, useRef } from "react";
import {
  midpoint
} from "../model";

export function ChecklistModal({ onClose }: { onClose: () => void }) {
  const items = [
    "Create a new project and confirm the 100.0 m × 100.0 m workspace opens with only the property boundary.",
    "Edit the property boundary using vertex handles and midpoint insertion.",
    "Draw a rectangle, then resize it visually and numerically.",
    "Add polygon, rectangle, line, circle, hand-drawn line, and text objects.",
    "Edit dimensions, coordinates, object label, text, layer, lock state, and color in the inspector.",
    "Toggle grid, measurement labels, grid snap, vertex snap, edge snap, midpoint snap, and orthogonal snapping.",
    "Verify undo/redo with toolbar buttons and Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y.",
    "Hide and lock layers, then confirm hidden layers disappear and locked layers cannot be edited.",
    "Reload the page and verify localStorage autosave restores the plan.",
    "Export JSON, reset/new project, import JSON, and confirm editable objects are restored.",
    "Export PNG with measurements on, then turn measurements off and export again; selection handles and editor chrome should not appear."
  ];
  return <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Manual QA checklist" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal">
      <div className="panel-header"><h2>Manual QA checklist</h2><button className="icon-btn" aria-label="Close checklist" onClick={onClose}>×</button></div>
      <div className="panel-body"><ol>{items.map((item,i)=><li key={i}>{item}</li>)}</ol></div>
    </div>
  </div>;
}
