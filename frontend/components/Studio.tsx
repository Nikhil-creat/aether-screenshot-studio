"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, Analysis, LANGS, TARGETS } from "@/lib/api";
const Canvas = dynamic(() => import("./Canvas"), { ssr: false });

type Tab = "code" | "edit" | "a11y" | "tokens" | "telemetry";
const NAMES = new Intl.DisplayNames(["en"], { type: "language" });
const lname = (c: string) => { try { return NAMES.of(c) ?? c; } catch { return c; } };
const PEER_COLORS = ["#7c9cff", "#22d3ee", "#c084fc", "#34d399", "#f59e0b"];

export default function Studio() {
  const [a, setA] = useState<Analysis | null>(null); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null); const [tab, setTab] = useState<Tab>("code"); const [target, setTarget] = useState(TARGETS[0]);
  const [code, setCode] = useState<string>(""); const [imgKey, setImgKey] = useState(""); const [cvd, setCvd] = useState<string | undefined>();
  const [text, setText] = useState(""); const [lang, setLang] = useState("hi"); const [px, setPx] = useState(80);
  const [cmd, setCmd] = useState(""); const [peers, setPeers] = useState(0); const [tele, setTele] = useState<any>(null); const [log, setLog] = useState<string[]>([]);
  const user = useMemo(() => ({ name: "Guest-" + Math.floor(Math.random() * 900 + 100), color: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)] }), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>) => {
    setBusy(label); setErr(null);
    try { const r = await fn(); setLog((l) => [`✓ ${label}`, ...l].slice(0, 30)); return r; }
    catch (e: any) { setErr(e.message); setLog((l) => [`✗ ${label}: ${e.message}`, ...l].slice(0, 30)); }
    finally { setBusy(null); }
  }, []);

  const refresh = (id: string) => { setImgKey(String(Date.now())); setCvd(undefined); api.exportCode(id, target).then(setCode); };
  useEffect(() => { if (a) api.exportCode(a.id, target).then(setCode); }, [target, a?.id]); // eslint-disable-line
  useEffect(() => { if (tab !== "telemetry") return; const t = setInterval(() => api.telemetry().then(setTele).catch(() => {}), 1500); api.telemetry().then(setTele).catch(() => {}); return () => clearInterval(t); }, [tab]);

  const upload = (f: File | undefined) => f && run("Analyzing with CNN + RAG + agents", async () => { const r = await api.analyze(f); setA(r); setSel(null); setCode(r.code?.[target] ?? ""); setImgKey(String(Date.now())); return r; });
  const box = sel != null && a ? a.layers[sel].bbox : null;

  const execPlan = async (plan: any) => {
    if (!a) return; const id = a.id;
    if (plan.op === "translate") await run(`Translate → ${lname(plan.lang)}`, () => api.translate(id, plan.lang));
    else if (plan.op === "darkmode") { const r: any = await run("Dark mode variant", () => api.darkmode(id)); if (r) setCode(r.code[target]); return; }
    else if (plan.op === "erase" && box) await run("Smart erase", () => api.erase(id, [box]));
    else if (plan.op === "outpaint") await run("Outpaint", () => api.outpaint(id, { top: plan.px, right: plan.px, bottom: plan.px, left: plan.px }));
    else if (plan.op === "a11y_fix") setTab("a11y");
    else if (plan.op === "export") setTab("code");
    else if (plan.op === "unknown") { setErr(plan.hint); return; }
    refresh(id);
  };
  const sendCmd = async (c: string) => { if (!a || !c.trim()) return; const r: any = await run("Planning command", () => api.command(a.id, c)); if (r) await execPlan(r.plan); setCmd(""); };
  const voice = () => { const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SR) return setErr("Voice input is not supported in this browser"); const r = new SR(); r.lang = "en-US"; r.onresult = (e: any) => sendCmd(e.results[0][0].transcript); r.start(); };
  const download = () => { const ext = { "react-tailwind": "tsx", "html-css": "html", vue: "vue", swiftui: "swift", flutter: "dart", compose: "kt", "figma-json": "json" }[target]; const u = URL.createObjectURL(new Blob([code])); const l = document.createElement("a"); l.href = u; l.download = `Screen.${ext}`; l.click(); };

  if (!a) return (
    <main className="mx-auto max-w-4xl px-5 py-16 text-center">
      <span className="chip text-neon border-neon/30">CNN · RAG · Self-healing agents · CRDT · Edge AI</span>
      <h1 className="mt-5 text-5xl md:text-6xl font-bold text-white tracking-tight">Screenshots, <span className="bg-gradient-to-r from-neon via-aether-400 to-plasma bg-clip-text text-transparent">understood.</span></h1>
      <p className="mt-4 text-slate-400 max-w-xl mx-auto">Drop a screenshot. Aether deconstructs it into editable layers, matches fonts and tokens, heals its own render errors, and exports production code.</p>
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()}
        className="glass mt-10 p-14 cursor-pointer border-dashed hover:border-aether-500 hover:shadow-glow transition relative overflow-hidden">
        {busy && <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-neon to-transparent animate-scan" />}
        <div className="text-4xl">⬆</div><div className="mt-2 text-white font-medium">{busy ?? "Drop a screenshot or click to upload"}</div><div className="text-xs text-slate-500 mt-1">PNG · JPG · WebP · up to 4096px</div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {err && <p className="mt-4 text-sm text-red-400">{err} — is the API running at <span className="kbd">{process.env.NEXT_PUBLIC_API ?? "localhost:8000"}</span>?</p>}
      <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 text-left text-sm">
        {[["Layer intelligence", "Semantic UI parsing, palettes, gradients, shadows"], ["RAG design match", "Fonts & tokens from a vector store"], ["Self-healing", "Auto-corrects render drift > 2%"], ["7 exporters", "React · Vue · SwiftUI · Flutter · Compose · HTML · Figma"]].map(([t, d]) => (
          <div key={t} className="glass p-4"><div className="text-white font-medium">{t}</div><div className="text-slate-500 text-xs mt-1">{d}</div></div>))}
      </div>
    </main>
  );

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-5 grid lg:grid-cols-[260px_1fr_400px] gap-4">
      {/* layers */}
      <aside className="glass p-3 h-fit lg:sticky lg:top-20">
        <div className="flex items-center justify-between px-1 pb-2"><h2 className="text-sm font-semibold text-white">Layers <span className="text-slate-500">({a.layers.length})</span></h2>
          <span className="chip" title="detection engine">{a.engine}</span></div>
        <ul className="space-y-1 max-h-[60vh] overflow-auto">
          {a.layers.map((l, i) => (
            <li key={i}><button onClick={() => setSel(i)} className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 text-sm ${sel === i ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`}>
              <span className="h-3 w-3 rounded" style={{ background: l.palette[0] }} /><span className="capitalize">{l.kind}</span>
              <span className="ml-auto font-mono text-[10px] text-slate-600">{l.bbox[2] - l.bbox[0]}×{l.bbox[3] - l.bbox[1]}</span></button></li>))}
        </ul>
        {sel != null && <div className="mt-3 border-t border-edge pt-3 text-xs space-y-1">
          <div className="flex gap-1 flex-wrap">{a.layers[sel].palette.map((c) => <span key={c} className="chip font-mono" style={{ borderColor: c }}>{c}</span>)}</div>
          {a.layers[sel].font_match && <div className="text-slate-400">Font match: <span className="text-white">{a.layers[sel].font_match.family}</span></div>}
          {a.layers[sel].gradient && <div className="text-slate-400">Gradient {a.layers[sel].gradient.angle_deg}°</div>}
        </div>}
        <button className="btn w-full mt-3" onClick={() => { setA(null); setSel(null); }}>New screenshot</button>
      </aside>

      {/* canvas */}
      <section className="space-y-3 min-w-0">
        <div className="glass p-2 flex items-center gap-2">
          <input value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCmd(cmd)} placeholder='Command: "translate to Telugu", "dark mode", "extend 80px", "remove watermark"…'
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-600" />
          <button className="btn" onClick={voice} title="Voice command">🎙</button><button className="btn btn-primary" onClick={() => sendCmd(cmd)}>Run</button>
        </div>
        <div className="glass p-3 overflow-auto relative">
          <Canvas key={a.id + imgKey + (cvd ?? "")} room={a.id} imageUrl={api.imageUrl(a.id, cvd)} size={a.size} layers={a.layers} selected={sel} onSelect={setSel} user={user} onPeers={setPeers} />
          {busy && <div className="absolute inset-0 grid place-items-center bg-ink/60 backdrop-blur-sm text-sm text-white">{busy}…</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="chip">deviation {(a.deviation * 100).toFixed(2)}%</span><span className="chip">{a.iterations} render pass{a.iterations === 1 ? "" : "es"}</span>
          <span className="chip">RAG: {a.kb}</span><span className="chip">● {peers + 1} in room</span><span className="chip">room {a.id}</span>
          <button className="btn ml-auto" onClick={() => run("Undo", () => api.undo(a.id)).then(() => refresh(a.id))}>Undo</button>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <ul className="text-xs text-slate-500 font-mono max-h-24 overflow-auto">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </section>

      {/* inspector */}
      <aside className="glass p-3 h-fit lg:sticky lg:top-20">
        <div className="flex gap-1 mb-3">{(["code", "edit", "a11y", "tokens", "telemetry"] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`tab capitalize ${tab === t ? "tab-on" : ""}`}>{t}</button>)}</div>
        {tab === "code" && <div>
          <div className="flex flex-wrap gap-1 mb-2">{TARGETS.map((t) => <button key={t} onClick={() => setTarget(t)} className={`chip ${t === target ? "bg-aether-500/30 text-white border-aether-500" : ""}`}>{t}</button>)}</div>
          <pre className="text-[11px] leading-relaxed font-mono bg-black/40 rounded-xl p-3 max-h-[52vh] overflow-auto whitespace-pre-wrap">{code}</pre>
          <div className="flex gap-2 mt-2"><button className="btn flex-1" onClick={() => navigator.clipboard.writeText(code)}>Copy</button><button className="btn btn-primary flex-1" onClick={download}>Download</button></div></div>}
        {tab === "edit" && <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-500">{sel == null ? "Select a layer on the canvas or in the list." : `Editing layer #${sel} (${a.layers[sel].kind})`}</p>
          <div className="space-y-2"><label className="text-slate-400 text-xs">Pixel-perfect text replacement</label>
            <div className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="New text" className="flex-1 bg-black/30 border border-edge rounded-lg px-2 py-1.5 outline-none" />
              <button disabled={!box || !text} className="btn" onClick={() => run("Replace text", () => api.replaceText(a.id, box!, text)).then(() => refresh(a.id))}>Apply</button></div></div>
          <div className="flex gap-2"><button disabled={!box} className="btn flex-1" onClick={() => run("Smart erase", () => api.erase(a.id, [box!])).then(() => refresh(a.id))}>Smart erase</button>
            <button className="btn flex-1" onClick={() => api.darkmode(a.id).then((r: any) => { setTab("code"); setCode(r.code[target]); })}>Dark variant</button></div>
          <div className="space-y-2"><label className="text-slate-400 text-xs">Generative outpainting</label>
            <div className="flex gap-2 items-center"><input type="range" min={20} max={300} value={px} onChange={(e) => setPx(+e.target.value)} className="flex-1" /><span className="kbd">{px}px</span>
              <button className="btn" onClick={() => run("Outpaint", () => api.outpaint(a.id, { top: px, right: px, bottom: px, left: px })).then(() => refresh(a.id))}>Extend</button></div></div>
          <div className="space-y-2"><label className="text-slate-400 text-xs">Localize ({LANGS.length} languages)</label>
            <div className="flex gap-2"><select value={lang} onChange={(e) => setLang(e.target.value)} className="flex-1 bg-black/30 border border-edge rounded-lg px-2 py-1.5">{LANGS.map((c) => <option key={c} value={c}>{lname(c)}</option>)}</select>
              <button className="btn" onClick={() => run(`Translate → ${lname(lang)}`, () => api.translate(a.id, lang)).then(() => refresh(a.id))}>Translate</button></div></div></div>}
        {tab === "a11y" && <A11y a={a} cvd={cvd} setCvd={setCvd} />}
        {tab === "tokens" && <pre className="text-[11px] font-mono bg-black/40 rounded-xl p-3 max-h-[60vh] overflow-auto whitespace-pre-wrap">{a.tokens?.css}{"\n\n"}{JSON.stringify(a.tokens?.tailwind, null, 2)}</pre>}
        {tab === "telemetry" && <Telemetry t={tele} />}
      </aside>
    </main>
  );
}

function A11y({ a, cvd, setCvd }: { a: Analysis; cvd?: string; setCvd: (s?: string) => void }) {
  const r = a.a11y;
  return <div className="text-sm space-y-3">
    <div className="grid grid-cols-2 gap-2"><div className="glass p-3"><div className="text-2xl font-semibold text-emerald-400">{r.passed}</div><div className="text-xs text-slate-500">pass WCAG {r.level}</div></div>
      <div className="glass p-3"><div className="text-2xl font-semibold text-amber-400">{r.failed}</div><div className="text-xs text-slate-500">need fixes</div></div></div>
    <ul className="space-y-2 max-h-[34vh] overflow-auto">{r.issues.map((i: any, k: number) => <li key={k} className="glass p-2 text-xs flex items-center gap-2">
      <span className="h-5 w-5 rounded" style={{ background: i.bg }}><span className="block text-center leading-5 font-bold" style={{ color: i.fg }}>A</span></span>
      <span className="text-slate-400">{i.ratio}:1</span><span className="ml-auto">→</span>
      <span className="h-5 w-5 rounded" style={{ background: i.bg }}><span className="block text-center leading-5 font-bold" style={{ color: i.suggested_fg }}>A</span></span><span className="font-mono">{i.suggested_fg}</span></li>)}</ul>
    <div><div className="text-xs text-slate-500 mb-1">Colour-vision simulation</div><div className="flex flex-wrap gap-1">
      {[undefined, "protanopia", "deuteranopia", "tritanopia"].map((k) => <button key={k ?? "normal"} onClick={() => setCvd(k)} className={`chip ${cvd === k ? "bg-aether-500/30 text-white border-aether-500" : ""}`}>{k ?? "normal"}</button>)}</div></div></div>;
}

function Telemetry({ t }: { t: any }) {
  if (!t) return <p className="text-xs text-slate-500">Connecting…</p>; const s = t.stats;
  const cards = [["Events", s.events], ["RAG hits", s.rag_hits], ["Heal iterations", s.self_heal_iterations], ["Render success", s.render_success_rate == null ? "—" : `${(s.render_success_rate * 100).toFixed(0)}%`]];
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2">{cards.map(([k, v]) => <div key={k as string} className="glass p-3"><div className="text-xl font-semibold text-white">{v as any}</div><div className="text-[11px] text-slate-500">{k}</div></div>)}</div>
    <ul className="text-[11px] font-mono space-y-0.5 max-h-[38vh] overflow-auto">{[...t.events].reverse().map((e: any, i: number) => <li key={i} className="text-slate-400"><span className="text-neon">{e.source}</span> {e.event} <span className="text-slate-600">{e.deviation != null ? `dev=${(+e.deviation).toFixed(3)}` : ""}</span></li>)}</ul></div>;
}
