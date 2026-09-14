// @vitest-environment jsdom
import React, { act, useReducer, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { appReducer, initialUi, makeInitialProject, type HistoryState } from "../model";
import { PropertiesInspector } from "./PropertiesInspector";
import { SvgWorkspace } from "./SvgWorkspace";
import { TopToolbar } from "./TopToolbar";

let container: HTMLDivElement;
let root: Root;

function Editor() {
  const [state, dispatch] = useReducer(appReducer, null, (): HistoryState => {
    const project = makeInitialProject();
    project.objects = project.objects.map(o => o.type === "polygon" ? {
      ...o, points: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }],
    } : o);
    return { project, past: [], future: [], ui: { ...initialUi, selectedIds: ["property-boundary"], viewport: { scale: 1, panX: 0, panY: 0 } } };
  });
  const fitRef = useRef<(() => void) | null>(null);
  return <>
    <TopToolbar state={state} dispatch={dispatch} fitWorkspace={() => {}} />
    <SvgWorkspace state={state} dispatch={dispatch} fitRef={fitRef} />
    <PropertiesInspector state={state} dispatch={dispatch} />
  </>;
}

const angleLabels = () => Array.from(container.querySelectorAll<SVGTextElement>('[data-measure-id^="angle-"]'));
const angleValues = () => angleLabels().map(label => label.textContent);
const checkbox = (text: string) => Array.from(container.querySelectorAll("label"))
  .find(label => label.textContent?.trim() === text)!.querySelector<HTMLInputElement>("input")!;
const click = (element: HTMLElement) => act(() => element.click());
const pointer = (element: Element, type: string, x: number, y: number) => act(() => {
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }));
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Editor />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("updates all four corner labels during a vertex drag, before release, and restores them on undo", () => {
  expect(angleValues()).toEqual([]);
  click(checkbox("Show angle labels"));
  expect(angleValues()).toEqual(["90.0°", "90.0°", "90.0°", "90.0°"]);

  const vertex = container.querySelector('[data-handle-kind="vertex"][data-handle-index="0"]')!;
  const workspace = container.querySelector("svg")!;
  pointer(vertex, "pointerdown", 100, 100);
  pointer(workspace, "pointermove", 100, 150);
  expect(angleValues()).toEqual(["116.6°", "63.4°", "90.0°", "90.0°"]);
  expect(checkbox("Angle 1: 116.6°").checked).toBe(true);
  pointer(workspace, "pointerup", 100, 150);
  click(container.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!);
  expect(angleValues()).toEqual(["90.0°", "90.0°", "90.0°", "90.0°"]);
});

it("drags angle labels and honors individual, polygon, and global visibility controls", () => {
  click(checkbox("Show angle labels"));
  const label = angleLabels()[0];
  const x = Number(label.getAttribute("x")), y = Number(label.getAttribute("y"));
  const workspace = container.querySelector("svg")!;
  pointer(label, "pointerdown", x, y);
  pointer(workspace, "pointermove", x + 20, y + 10);
  pointer(workspace, "pointerup", x + 20, y + 10);
  expect(Number(angleLabels()[0].getAttribute("x"))).toBeCloseTo(x + 20);
  expect(Number(angleLabels()[0].getAttribute("y"))).toBeCloseTo(y + 10);

  click(checkbox("Angle 2: 90.0°"));
  expect(angleValues()).toHaveLength(3);
  click(checkbox("Show angle labels"));
  expect(angleValues()).toEqual([]);
  click(checkbox("Show angle labels"));
  expect(angleValues()).toHaveLength(3);
  click(checkbox("Show dimensions"));
  expect(angleValues()).toEqual([]);
  expect(checkbox("Show angle labels").disabled).toBe(true);
  click(checkbox("Show dimensions"));
  click(container.querySelector<HTMLButtonElement>('[aria-label="Toggle measurements"]')!);
  expect(angleValues()).toEqual([]);
  click(container.querySelector<HTMLButtonElement>('[aria-label="Toggle measurements"]')!);
  expect(angleValues()).toHaveLength(3);
});
