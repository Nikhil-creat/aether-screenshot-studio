"""Enterprise audit log + live counters, fan-out to WebSocket subscribers."""
import asyncio, time, collections, json
class Telemetry:
    def __init__(self, cap=2000):
        self.events = collections.deque(maxlen=cap); self.subs: list = []
        self.counters = collections.Counter(); self.heal_iters: list = []
    def emit(self, source: str, event: str, **data):
        e = {"t": round(time.time(), 3), "source": source, "event": event, **data}
        self.events.append(e); self.counters[f"{source}.{event}"] += 1
        for q in list(self.subs):
            try: q.put_nowait(e)
            except Exception: pass
        return e
    def ingest_agent_audit(self, audit: list):
        for a in audit:
            self.emit("agent", a.get("agent", "?"), **{k: v for k, v in a.items() if k not in ("t", "agent")})
            if a.get("agent") == "heal": self.counters["self_heal_iterations"] += 1
    def stats(self):
        c = self.counters; ok, tot = c["render.success"], c["render.success"] + c["render.fail"]
        return {"events": len(self.events), "rag_hits": c["rag.hit"], "self_heal_iterations": c["self_heal_iterations"],
                "render_success_rate": round(ok / tot, 3) if tot else None, "cnn_runs": c["cnn.analyze"], "counters": dict(c)}
    def subscribe(self): q = asyncio.Queue(maxsize=500); self.subs.append(q); return q
    def unsubscribe(self, q):
        if q in self.subs: self.subs.remove(q)
TELEMETRY = Telemetry()
