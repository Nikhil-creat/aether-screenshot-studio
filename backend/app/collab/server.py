"""CRDT collaboration backend: Yjs-compatible WebSocket rooms + Git-like branching."""
import asyncio, hashlib, time
from fastapi import FastAPI, WebSocket
from pycrdt import Doc
from pycrdt_websocket import WebsocketServer

class BranchStore:
    """Commit DAG over Yjs state snapshots. CRDT updates commute, so merge never conflicts."""
    def __init__(self): self.commits, self.branches = {}, {"main": None}

    def commit(self, doc: Doc, branch: str, msg: str, author: str) -> str:
        state = doc.get_update()
        cid = hashlib.sha1(state + str(time.time()).encode()).hexdigest()[:10]
        self.commits[cid] = {"parent": self.branches[branch], "state": state, "msg": msg,
                             "author": author, "t": time.time()}
        self.branches[branch] = cid; return cid

    def branch(self, name: str, from_branch="main"): self.branches[name] = self.branches[from_branch]

    def checkout(self, branch: str) -> Doc:
        d = Doc(); c = self.branches[branch]
        if c: d.apply_update(self.commits[c]["state"])
        return d

    def merge(self, src: str, dst: str) -> Doc:
        d = self.checkout(dst); s = self.branches[src]
        if s: d.apply_update(self.commits[s]["state"])
        return d

store = BranchStore()
ws_server = WebsocketServer(auto_clean_rooms=True)
app = FastAPI()

@app.on_event("startup")
async def _start():
    app.state.task = asyncio.create_task(ws_server.start())

class _Adapter:
    """Adapts a FastAPI WebSocket to the channel interface pycrdt-websocket expects."""
    def __init__(self, ws: WebSocket): self.ws, self.path = ws, ws.scope["path"]
    def __aiter__(self): return self
    async def __anext__(self):
        try: return await self.recv()
        except Exception: raise StopAsyncIteration
    async def send(self, m): await self.ws.send_bytes(m)
    async def recv(self): return await self.ws.receive_bytes()

@app.websocket("/collab/{room}")
async def collab(ws: WebSocket, room: str):
    await ws.accept(); await ws_server.serve(_Adapter(ws))  # y-websocket protocol; awareness = live cursors

@app.post("/collab/{room}/commit")
async def commit(room: str, branch: str = "main", msg: str = "", author: str = "anon"):
    doc = ws_server.rooms[room].ydoc if room in ws_server.rooms else Doc()
    return {"commit": store.commit(doc, branch, msg, author)}
