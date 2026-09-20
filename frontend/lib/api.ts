export const API = process.env.NEXT_PUBLIC_API ?? "http://localhost:8000";
export type Layer = { kind: string; bbox: [number, number, number, number]; palette: string[]; gradient?: any; shadow?: any; text?: string | null; font?: any; font_match?: any };
export type Analysis = { id: string; size: [number, number]; engine: string; kb: string; layers: Layer[]; tokens: any; a11y: any; deviation: number; iterations: number; code: Record<string, string> };

async function j<T>(r: Response): Promise<T> { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? r.statusText); return r.json(); }
const post = (p: string, body?: unknown) => fetch(`${API}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(j<any>);

export const api = {
  analyze: (f: File) => { const fd = new FormData(); fd.append("file", f); return fetch(`${API}/v1/analyze`, { method: "POST", body: fd }).then(j<Analysis>); },
  erase: (id: string, boxes: number[][]) => post(`/v1/projects/${id}/erase`, { boxes }),
  replaceText: (id: string, bbox: number[], text: string) => post(`/v1/projects/${id}/replace-text`, { bbox, text }),
  outpaint: (id: string, o: Record<string, number>) => post(`/v1/projects/${id}/outpaint`, o),
  translate: (id: string, lang: string) => post(`/v1/projects/${id}/translate`, { lang }),
  darkmode: (id: string) => post(`/v1/projects/${id}/darkmode`),
  command: (id: string, command: string) => post(`/v1/projects/${id}/command`, { command }),
  undo: (id: string) => post(`/v1/projects/${id}/undo`),
  exportCode: (id: string, t: string) => fetch(`${API}/v1/projects/${id}/export?target=${t}`).then((r) => r.text()),
  a11y: (id: string, level = "AAA") => fetch(`${API}/v1/projects/${id}/a11y?level=${level}`).then(j<any>),
  telemetry: () => fetch(`${API}/v1/telemetry`).then(j<any>),
  about: () => fetch(`${API}/v1/about`).then(j<any>),
  imageUrl: (id: string, cvd?: string) => `${API}/v1/projects/${id}/${cvd ? `cvd/${cvd}` : "image"}?t=${Date.now()}`,
};
export const LANGS = "en hi te ta kn ml mr bn gu pa ur ar he fa es fr de it pt nl sv no da fi pl cs sk hu ro bg el tr ru uk sr hr lt lv et id ms vi th zh ja ko sw af ne si km my tl".split(" ");
export const TARGETS = ["react-tailwind", "html-css", "vue", "swiftui", "flutter", "compose", "figma-json"];
