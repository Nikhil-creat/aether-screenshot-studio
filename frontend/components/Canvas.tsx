"use client";
import { useEffect, useRef } from "react";
import { fabric } from "fabric";
import * as Y from "yjs";
import { joinRoom } from "@/lib/collab";
import type { Layer } from "@/lib/api";

const COLORS: Record<string, string> = { typography: "#22d3ee", button: "#7c9cff", card: "#c084fc", image: "#f59e0b", container: "#94a3b8", iconography: "#34d399" };

type Props = { room: string; imageUrl: string; size: [number, number]; layers: Layer[]; selected: number | null; onSelect: (i: number | null) => void; user: { name: string; color: string }; onPeers?: (n: number) => void };

export default function Canvas({ room, imageUrl, size, layers, selected, onSelect, user, onPeers }: Props) {
  const el = useRef<HTMLCanvasElement>(null); const fc = useRef<fabric.Canvas | null>(null);
  useEffect(() => {
    const scale = Math.min(1, 860 / size[0]);
    const c = new fabric.Canvas(el.current!, { width: size[0] * scale, height: size[1] * scale, selection: false }); fc.current = c;
    fabric.Image.fromURL(imageUrl, (img) => { img.scale(scale); img.selectable = false; img.evented = false; c.setBackgroundImage(img, c.renderAll.bind(c)); }, { crossOrigin: "anonymous" });
    const { layers: shared, awareness, provider } = joinRoom(room, user);
    layers.forEach((l, i) => {
      const [x0, y0, x1, y1] = l.bbox; const col = COLORS[l.kind] ?? "#fff";
      const r: any = new fabric.Rect({ left: x0 * scale, top: y0 * scale, width: (x1 - x0) * scale, height: (y1 - y0) * scale, fill: col + "14", stroke: col, strokeWidth: 1.5, strokeDashArray: [5, 4], hasControls: true, cornerColor: col, transparentCorners: false });
      r.lid = String(i); c.add(r);
    });
    c.on("selection:created", (e: any) => onSelect(Number(e.selected?.[0]?.lid)));
    c.on("selection:updated", (e: any) => onSelect(Number(e.selected?.[0]?.lid)));
    c.on("selection:cleared", () => onSelect(null));
    c.on("object:modified", (e) => { const o: any = e.target; const m = new Y.Map(); m.set("left", o.left); m.set("top", o.top); m.set("sx", o.scaleX); m.set("sy", o.scaleY); shared.set(o.lid, m); });
    const obs = () => { shared.forEach((m: any, id: string) => { const o: any = c.getObjects().find((x: any) => x.lid === id); if (o) { o.set({ left: m.get("left"), top: m.get("top"), scaleX: m.get("sx"), scaleY: m.get("sy") }); o.setCoords(); } }); c.requestRenderAll(); };
    shared.observeDeep(obs);
    const peers = () => onPeers?.(awareness.getStates().size - 1); awareness.on("change", peers);
    return () => { awareness.off("change", peers); provider.destroy(); c.dispose(); };
  }, [room, imageUrl, layers]); // eslint-disable-line
  useEffect(() => { const c = fc.current; if (!c || selected == null) return; const o = c.getObjects().find((x: any) => x.lid === String(selected)); if (o) { c.setActiveObject(o); c.requestRenderAll(); } }, [selected]);
  return <canvas ref={el} className="rounded-xl" />;
}
