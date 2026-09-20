import { AUTHOR } from "@/lib/author";
const STACK = ["Next.js 14", "TypeScript", "Tailwind", "Fabric.js", "Yjs CRDT", "ONNX Runtime Web (WebNN/WASM)", "FastAPI", "PyTorch", "LangGraph", "ChromaDB", "Celery + Redis", "OpenCV"];
export default function About() {
  const rows: [string, string, string?][] = [
    ["GitHub", AUTHOR.github.replace("https://", ""), AUTHOR.github], ["LinkedIn", "nikhil-chary-sriramoju", AUTHOR.linkedin],
    ["Email", AUTHOR.email, `mailto:${AUTHOR.email}`], ["Mobile", AUTHOR.mobile, `tel:${AUTHOR.mobile.replace(/\s/g, "")}`],
  ];
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <div className="glass p-8 md:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-plasma/20 blur-3xl" />
        <p className="text-xs uppercase tracking-[.25em] text-neon">Creator</p>
        <h1 className="mt-2 text-4xl font-bold text-white">{AUTHOR.name}</h1>
        <p className="mt-1 text-slate-400">{AUTHOR.role}</p>
        <p className="mt-6 text-slate-300 leading-relaxed">
          Aether AI Screenshot Studio was designed, architected and built end-to-end by {AUTHOR.name}: computer-vision pipeline, RAG design knowledge base,
          self-healing multi-agent orchestration, real-time CRDT collaboration and the full-stack product around them.
        </p>
        <dl className="mt-8 divide-y divide-edge border-y border-edge">
          {rows.map(([k, v, href]) => (
            <div key={k} className="flex items-center justify-between py-3 text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd><a className="text-aether-400 hover:text-white" href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{v}</a></dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap gap-2">{STACK.map((s) => <span key={s} className="chip">{s}</span>)}</div>
        <a href="/" className="btn btn-primary mt-8">Open the Studio →</a>
      </div>
    </main>
  );
}
