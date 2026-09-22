<div align="center">

# Aether AI Screenshot Studio
**Autonomous, private, self-healing screenshot intelligence.**

Designed & built by
# **NIKHIL CHARY SRIRAMOJU**
[GitHub](https://github.com/Nikhil-creat) 
· [LinkedIn](https://in.linkedin.com/in/nikhil-chary-sriramoju-95041b38a) · 
[sriramojunikhil66@gmail.com](mailto:sriramojunikhil66@gmail.com) 
· +91 6300556301

</div>

## Quick start
```bash
# 1. Zero-install demo (100% in-browser): open demo/index.html
# 2. Full stack
cp .env.example .env && docker compose up --build      # web :3000 · api :8000 · collab :8001
# 3. Backend only, no Docker
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
# 4. Tests (numpy + opencv + pillow + pyjwt only)
cd backend && python -m tests.test_core
```
Enable the ML tier with `docker compose build --build-arg WITH_ML=1` (or `pip install -r requirements-ml.txt`) and set `AETHER_WEIGHTS` once you have trained weights.

## Live editor (index.html)
Open `index.html` (or the GitHub Pages link). It edits **PDF, PNG, JPG, WebP, GIF, BMP, AVIF, SVG, HEIC, TIFF** and saved project files, entirely in the browser, and exports **PNG, JPG, WebP, PDF, SVG or a project file**. Highlights: text replacement that copies the original colour, weight, size, edge softness and (for PDFs, exactly; for images, by OCR + font fingerprinting) the font; smart erase that rebuilds gradients and film grain; on-device OCR text editing; private-info detection and redaction; translation to 30 languages (Chrome's on-device Translator when present); WCAG AAA audit and fixes; dark-mode variant; colour-blindness preview; crop, extend, multi-page PDFs, voice/typed commands, code export. New: real vector-editable PDF export (strip the original glyphs from the PDF's own content stream, redraw the replacement in a matched standard font, keep every path/image untouched — proven against real pdf-lib and poppler, not just rasterised) for pages you only text-edited; a per-page eligibility panel in the Export tab shows which pages qualify and why; batch "translate all pages" and "redact all pages"; keyboard shortcuts (1-7 tools, [ ] pages, Ctrl+E export). Tests: `node tests-web/test_core.js && node tests-web/flow_test.js && node tests-web/cine_test.js && node tests-web/pdf_export_test.js` (the last one needs `pdf-lib` installed locally and `qpdf`/`pdftotext` on PATH).

## What it does
Upload a screenshot -> detect layers (text, buttons, cards, images, icons) -> extract palettes/gradients/shadows -> match fonts & tokens via RAG -> edit (smart erase, outpaint, text replace, translate to 50+ languages, dark mode) with a **self-healing render loop** -> audit accessibility (WCAG AAA, colour-blindness sim) -> export **React/Tailwind, HTML/CSS, Vue, SwiftUI, Flutter, Compose, Figma JSON** -> collaborate live (Yjs CRDT, cursors, branches). Natural-language and voice commands drive all of it; every step lands in a live audit log.

See `docs/ARCHITECTURE.md` for the sequence diagram, feature map and API.

## Status — read this
| Verified by tests here | Written but **not executed** in the build environment | Needs your data/compute |
|---|---|---|
| contrast/AAA maths + auto-fix, i18n, classical layer detection, all 7 exporters, outpaint, erase, text replace, self-heal convergence, NL parser, dark mode | FastAPI app, Next.js UI, Yjs collab server, Celery task, ONNX loader, Docker/CI | CNN weights & font-classifier training, OCR wiring, 1M-font corpus, diffusion inpainting model, translation provider (glossary covers 5 languages x 7 UI words) |

## Repo map
`backend/app` — `main.py` API · `engine.py` · `cv/` · `rag/` · `agents/graph.py` · `services/` · `collab/` · `auth.py` · `branding.py`
`frontend` — Next.js 14 App Router studio UI · `demo/` — offline demo (GitHub Pages ready)

© NIKHIL CHARY SRIRAMOJU 
