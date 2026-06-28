import React, { useEffect, useMemo, useRef } from "react";
import {
  type HistoryState
} from "../model";

export function StatusBar({ state }: { state: HistoryState }) {
  const { project, ui } = state;
  const sel = ui.selectedIds.length ? `${ui.selectedIds.length} selected` : "No selection";
  const saved = project.savedAt ? `Saved ${new Date(project.savedAt).toLocaleString()}` : "Autosave active";
  return <footer className="status-bar" role="status" aria-live="polite">
    <div className="status-main">{ui.status}</div>
    <div>{sel}</div>
    <div>{saved}</div>
    <div>{ui.tests.passed}/{ui.tests.total} geometry tests</div>
  </footer>;
}
