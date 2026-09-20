import { AUTHOR } from "@/lib/author";
export default function AuthorBadge({ compact = false }: { compact?: boolean }) {
  const initials = AUTHOR.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-aether-500 to-plasma grid place-items-center text-sm font-bold shadow-glow">{initials}</div>
      <div className="leading-tight">
        <div className="text-[11px] uppercase tracking-widest text-slate-500">Designed &amp; built by</div>
        <a href="/about" className="text-sm font-semibold text-white hover:text-aether-400">{AUTHOR.name}</a>
      </div>
      {!compact && (
        <div className="hidden md:flex gap-2 ml-2">
          <a className="chip hover:text-white" href={AUTHOR.github} target="_blank" rel="noreferrer">GitHub</a>
          <a className="chip hover:text-white" href={AUTHOR.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          <a className="chip hover:text-white" href={`mailto:${AUTHOR.email}`}>Email</a>
        </div>
      )}
    </div>
  );
}
