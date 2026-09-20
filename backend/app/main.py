"""Aether AI Screenshot Studio API — designed & built by Nikhil Chary Sriramoju."""
import io, uuid, asyncio, os
import numpy as np, cv2
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from PIL import Image
from . import auth
from .branding import AUTHOR, PRODUCT, VERSION, TAGLINE
from .engine import Engine, make_kb
from .agents.graph import build_graph
from .services import a11y, i18n, editing, exporters, nlcmd, darkmode
from .services.telemetry import TELEMETRY

app = FastAPI(title=PRODUCT, version=VERSION, description=f"{TAGLINE} Designed & built by {AUTHOR['name']}.")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("AETHER_CORS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
engine = Engine(); kb, KB_KIND = make_kb()
PROJECTS: dict = {}

def _render(s): return editing.apply_edits(s["original"], s["edits"], s.get("params"))
graph = build_graph(kb, _render, exporters.EXPORTERS)

def run_graph(original, layers, edits):
    out = graph.invoke({"original": original, "layers": layers, "edits": edits})
    TELEMETRY.ingest_agent_audit(out["audit"])
    TELEMETRY.emit("render", "success" if out.get("render_ok", True) else "fail", deviation=float(out["deviation"]))
    for l in out["layers"]:
        if "font_match" in l: TELEMETRY.emit("rag", "hit", family=l["font_match"]["family"])
    return out

def user(authorization: str | None = Header(None)):
    if os.getenv("AETHER_REQUIRE_AUTH") != "1": return "anon"
    try: return auth.verify((authorization or "").removeprefix("Bearer "))
    except Exception: raise HTTPException(401, "invalid or missing token")

def _proj(pid):
    if pid not in PROJECTS: raise HTTPException(404, "project not found")
    return PROJECTS[pid]

def _png(a): b = io.BytesIO(); Image.fromarray(a).save(b, "PNG"); return b.getvalue()

def _summary(pid, p, out=None):
    layers = out["layers"] if out else p["layers"]
    return {"id": pid, "size": list(p["image"].shape[1::-1]), "engine": engine.mode, "kb": KB_KIND, "layers": layers,
            "tokens": (out or {}).get("tokens") or p.get("tokens"), "a11y": a11y.audit_layers(layers), "deviation": float((out or {}).get("deviation", 0.0)),
            "iterations": (out or {}).get("iteration", 0), "code": (out or {}).get("code")}

class Cred(BaseModel): email: str; password: str
@app.post("/v1/auth/register")
def reg(c: Cred):
    try: auth.register(c.email, c.password)
    except ValueError as e: raise HTTPException(400, str(e))
    return {"ok": True}
@app.post("/v1/auth/login")
def log_in(c: Cred):
    try: return {"token": auth.login(c.email, c.password)}
    except PermissionError: raise HTTPException(401, "invalid credentials")

@app.get("/healthz")
def health(): return {"ok": True, "engine": engine.mode, "kb": KB_KIND, "version": VERSION}
@app.get("/v1/about")
def about(): return {"product": PRODUCT, "version": VERSION, "tagline": TAGLINE, "author": AUTHOR, "languages": len(i18n.LANGS), "exporters": list(exporters.EXPORTERS)}

@app.post("/v1/analyze")
async def analyze(file: UploadFile = File(...), _u: str = Depends(user)):
    img = np.array(Image.open(io.BytesIO(await file.read())).convert("RGB"))
    if max(img.shape[:2]) > 4096: raise HTTPException(413, "image too large (max 4096px)")
    pid = uuid.uuid4().hex[:10]; layers = engine.analyze(img)
    out = run_graph(img, layers, []); PROJECTS[pid] = {"image": img, "original": img, "layers": out["layers"], "tokens": out["tokens"], "history": []}
    return _summary(pid, PROJECTS[pid], out)

class Box(BaseModel): bbox: list[int]
class EraseReq(BaseModel): boxes: list[list[int]]
class TextReq(BaseModel): bbox: list[int]; text: str; bold: bool = False; align: str = "left"
class OutReq(BaseModel): top: int = 0; right: int = 0; bottom: int = 0; left: int = 0
class TransReq(BaseModel): lang: str
class CmdReq(BaseModel): command: str

def _commit(pid, p, img, note):
    p["history"].append({"note": note, "image": p["image"]}); p["image"] = img
    TELEMETRY.emit("edit", note); return {"ok": True, "history": len(p["history"])}

@app.post("/v1/projects/{pid}/erase")
def erase(pid: str, r: EraseReq, _u: str = Depends(user)):
    p = _proj(pid); edits = [{"type": "erase", "bbox": b} for b in r.boxes]
    out = run_graph(p["image"], p["layers"], edits); return _commit(pid, p, out["rendered"], "erase") | {"deviation": float(out["deviation"]), "iterations": out["iteration"]}

@app.post("/v1/projects/{pid}/replace-text")
def replace(pid: str, r: TextReq, _u: str = Depends(user)):
    p = _proj(pid); edits = [{"type": "replace_text", "bbox": r.bbox, "text": r.text, "bold": r.bold, "align": r.align}]
    out = run_graph(p["image"], p["layers"], edits)
    ar = a11y.audit_layers(out["layers"])
    return _commit(pid, p, out["rendered"], "replace_text") | {"deviation": float(out["deviation"]), "iterations": out["iteration"], "a11y": ar}

@app.post("/v1/projects/{pid}/outpaint")
def outpaint(pid: str, r: OutReq, _u: str = Depends(user)):
    p = _proj(pid); img = editing.outpaint(p["image"], r.top, r.right, r.bottom, r.left)
    for l in p["layers"]:
        x0, y0, x1, y1 = l["bbox"]; l["bbox"] = [x0 + r.left, y0 + r.top, x1 + r.left, y1 + r.top]
    return _commit(pid, p, img, "outpaint") | {"size": list(img.shape[1::-1])}

@app.post("/v1/projects/{pid}/translate")
def translate(pid: str, r: TransReq, _u: str = Depends(user)):
    p = _proj(pid); edits, report = [], []
    for l in p["layers"]:
        if l["kind"] == "typography" and l.get("text"):
            t = i18n.translate(l["text"], r.lang); f = l.get("font") or {}
            fit = i18n.fit_metrics(l["text"], t["text"], r.lang, f.get("size_px", 16), f.get("tracking_em", 0.0))
            edits.append({"type": "replace_text", "bbox": l["bbox"], "text": t["text"], "tracking_em": fit["tracking_em"], "align": "right" if fit["rtl"] else "left"})
            report.append({"from": l["text"], "to": t["text"], "source": t["source"], **fit})
    if not edits: return {"ok": False, "reason": "no text layers with known text; use replace-text or OCR first"}
    out = run_graph(p["image"], p["layers"], edits); return _commit(pid, p, out["rendered"], f"translate:{r.lang}") | {"report": report}

@app.post("/v1/projects/{pid}/darkmode")
def dark(pid: str, _u: str = Depends(user)):
    p = _proj(pid); dl = darkmode.to_dark(p["layers"]); TELEMETRY.emit("edit", "darkmode")
    return {"layers": dl, "code": {k: fn(dl, None) for k, fn in exporters.EXPORTERS.items()}}

@app.post("/v1/projects/{pid}/command")
def command(pid: str, r: CmdReq, _u: str = Depends(user)):
    plan = nlcmd.parse(r.command); TELEMETRY.emit("planner", "command", plan=plan); return {"plan": plan}

@app.get("/v1/projects/{pid}/a11y")
def a11y_report(pid: str, level: str = "AAA"): return a11y.audit_layers(_proj(pid)["layers"], level)

@app.get("/v1/projects/{pid}/cvd/{kind}")
def cvd(pid: str, kind: str):
    if kind not in ("protanopia", "deuteranopia", "tritanopia"): raise HTTPException(400, "unknown kind")
    return Response(_png(a11y.simulate_cvd(_proj(pid)["image"], kind)), media_type="image/png")

@app.get("/v1/projects/{pid}/image")
def image(pid: str): return Response(_png(_proj(pid)["image"]), media_type="image/png")

@app.post("/v1/projects/{pid}/undo")
def undo(pid: str):
    p = _proj(pid)
    if not p["history"]: raise HTTPException(400, "nothing to undo")
    p["image"] = p["history"].pop()["image"]; return {"ok": True, "history": len(p["history"])}

@app.get("/v1/projects/{pid}/export")
def export(pid: str, target: str = "react-tailwind"):
    if target not in exporters.EXPORTERS: raise HTTPException(400, f"target must be one of {list(exporters.EXPORTERS)}")
    p = _proj(pid); return Response(exporters.EXPORTERS[target](p["layers"], p.get("tokens")), media_type="text/plain")

@app.get("/v1/telemetry")
def telem(): return {"stats": TELEMETRY.stats(), "events": list(TELEMETRY.events)[-100:]}

@app.websocket("/v1/telemetry/ws")
async def telem_ws(ws: WebSocket):
    await ws.accept(); q = TELEMETRY.subscribe()
    try:
        while True: await ws.send_json(await q.get())
    except (WebSocketDisconnect, Exception): pass
    finally: TELEMETRY.unsubscribe(q)
