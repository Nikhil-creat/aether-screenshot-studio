"""Self-healing multi-agent loop (LangGraph). Agent 3 renders + regression-tests; loops until <=2% deviation."""
from __future__ import annotations
import time
from typing import TypedDict, Callable
import numpy as np
try:
    from langgraph.graph import StateGraph, END
except ImportError:  # dependency-free fallback with identical semantics
    StateGraph = None

THRESHOLD = 0.02
MAX_ITERS = 6

class State(TypedDict, total=False):
    original: np.ndarray
    layers: list
    edits: list
    grid: dict
    tokens: dict
    params: dict
    signed_err: object
    render_ok: bool
    rendered: np.ndarray
    deviation: float
    iteration: int
    code: dict
    audit: list

def log(s: State, agent: str, **kw):
    s.setdefault("audit", []).append({"t": time.time(), "agent": agent, "iter": s.get("iteration", 0), **kw})

# Agent 1: vision & layout parser
def layout_parser(s: State) -> State:
    layers = s["layers"]; collisions = []
    for i, a in enumerate(layers):
        for b in layers[i + 1:]:
            ax0, ay0, ax1, ay1 = a["bbox"]; bx0, by0, bx1, by1 = b["bbox"]
            if ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1 and a["kind"] == b["kind"]:
                collisions.append((a["bbox"], b["bbox"]))
    xs = sorted({l["bbox"][0] for l in layers}); ys = sorted({l["bbox"][1] for l in layers})
    s["grid"] = {"mode": "grid" if len(xs) > 2 and len(ys) > 2 else "flex", "cols": xs, "rows": ys}
    log(s, "layout_parser", collisions=len(collisions), mode=s["grid"]["mode"]); return s

# Agent 2: style & RAG synthesizer
def make_style_synth(kb) -> Callable:
    def style_synth(s: State) -> State:
        for l in s["layers"]:
            if l.get("font"):
                f = l["font"]
                desc = f"{f.get('family','sans')} {f.get('weight',400)} {f.get('category','sans-serif')}"
                hits = kb.match_font(desc, k=1)
                if hits: l["font_match"] = hits[0]
        s["tokens"] = kb.synthesize_tokens(s["layers"])
        log(s, "style_synth", matched=sum(1 for l in s["layers"] if "font_match" in l)); return s
    return style_synth

# Agent 3: self-healing executor
def _ring(img, bb, m=3):
    x0, y0, x1, y1 = bb; H, W = img.shape[:2]
    parts = [img[max(0, y0-m):y0, x0:x1], img[y1:min(H, y1+m), x0:x1], img[y0:y1, max(0, x0-m):x0], img[y0:y1, x1:min(W, x1+m)]]
    px = np.concatenate([q.reshape(-1, 3) for q in parts if q.size])
    return np.median(px, axis=0)

def visual_regression(orig: np.ndarray, new: np.ndarray, edits: list):
    """Returns (deviation, signed_bg_error).
    deviation = max(outside-edit drift, edited-region background mismatch vs surrounding ring), both in [0,1]."""
    mask = np.ones(orig.shape[:2], bool)
    for e in edits:
        x0, y0, x1, y1 = e["bbox"]; mask[max(0, y0-2):y1+2, max(0, x0-2):x1+2] = False
    outside = 0.0
    if mask.any():
        outside = float((np.abs(orig.astype(np.float32) - new.astype(np.float32)).mean(-1) / 255.0)[mask].mean())
    signed = np.zeros(3, np.float32); inside = 0.0
    for e in edits:
        x0, y0, x1, y1 = e["bbox"]; reg = new[y0:y1, x0:x1].reshape(-1, 3)
        if not len(reg): continue
        # background of the new region = the dominant (median) colour; compare with original surround
        err = _ring(orig, e["bbox"]).astype(np.float32) - np.median(reg, axis=0).astype(np.float32)
        signed += err / max(1, len(edits)); inside = max(inside, float(np.abs(err).mean() / 255.0))
    return max(outside, inside), signed

def make_executor(render: Callable) -> Callable:
    def execute(s: State) -> State:
        s["iteration"] = s.get("iteration", 0) + 1
        s.setdefault("params", {"font_size_delta": 0.0, "tracking": 0.0, "bg_bias": [0.0, 0.0, 0.0]})
        try:
            s["rendered"] = render(s); ok = True
        except Exception as ex:
            s["rendered"] = s["original"].copy(); ok = False; log(s, "executor_error", error=str(ex))
        s["deviation"], s["signed_err"] = visual_regression(s["original"], s["rendered"], s["edits"])
        s["render_ok"] = ok
        log(s, "executor", deviation=round(float(s["deviation"]), 4), params={k: (list(map(float, v)) if isinstance(v, (list, np.ndarray)) else float(v)) for k, v in s["params"].items()}); return s
    return execute

def heal(s: State) -> State:
    """Reflection step: closed-loop correction. Background bias follows the signed error (P-control, gain 0.85)."""
    p = s["params"]; e = np.asarray(s.get("signed_err", np.zeros(3)), np.float32)
    p["bg_bias"] = [float(v) for v in (np.asarray(p["bg_bias"], np.float32) + 0.85 * e)]
    log(s, "heal", signed_err=[round(float(v), 2) for v in e], new_bias=[round(v, 2) for v in p["bg_bias"]]); return s

def route(s: State) -> str:
    return "codegen" if s["deviation"] <= THRESHOLD or s["iteration"] >= MAX_ITERS else "heal"

# Agent 4: code & asset generator
def make_codegen(exporters: dict) -> Callable:
    def codegen(s: State) -> State:
        s["code"] = {t: fn(s["layers"], s.get("tokens")) for t, fn in exporters.items()}
        log(s, "codegen", targets=list(exporters), final_deviation=round(s["deviation"], 4)); return s
    return codegen

class _MiniGraph:
    """Same control flow as the LangGraph below, for environments without langgraph."""
    def __init__(self, nodes): self.n = nodes
    def invoke(self, s: State) -> State:
        s = self.n["layout"](s); s = self.n["style"](s)
        while True:
            s = self.n["execute"](s)
            if route(s) == "codegen": break
            s = self.n["heal"](s)
        return self.n["codegen"](s)

def build_graph(kb, render, exporters):
    nodes = {"layout": layout_parser, "style": make_style_synth(kb), "execute": make_executor(render),
             "heal": heal, "codegen": make_codegen(exporters)}
    if StateGraph is None: return _MiniGraph(nodes)
    g = StateGraph(State)
    for k, v in nodes.items(): g.add_node(k, v)
    g.set_entry_point("layout"); g.add_edge("layout", "style"); g.add_edge("style", "execute")
    g.add_conditional_edges("execute", route, {"heal": "heal", "codegen": "codegen"})
    g.add_edge("heal", "execute"); g.add_edge("codegen", END)
    return g.compile()
