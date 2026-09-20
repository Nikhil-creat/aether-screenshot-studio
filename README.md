<div align="center">

# Aether AI Screenshot Studio
**Autonomous, private, self-healing screenshot intelligence.**

Designed & built by **[NIKHIL CHARY SRIRAMOJU](https://github.com/Nikhil-creat)**
[GitHub](https://github.com/Nikhil-creat) · [LinkedIn](https://in.linkedin.com/in/nikhil-chary-sriramoju-95041b38a) · [sriramojunikhil66@gmail.com](mailto:sriramojunikhil66@gmail.com) Instagram: [@nikhil__sriramoju](https://www.instagram.com/nikhil__sriramoju)
- Facebook: [Profile](https://www.facebook.com/profile.php?id=100079201124141)

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


## Author

**NIKHIL CHARY SRIRAMOJU**
BTech CSE (Final Year)

- GitHub: [Nikhil-creat](https://github.com/Nikhil-creat)
- LinkedIn: [nikhil-chary-sriramoju](https://in.linkedin.com/in/nikhil-chary-sriramoju-95041b38a)
- Email: sriramojunikhil66@gmail.com
- Instagram: [@nikhil__sriramoju](https://www.instagram.com/nikhil__sriramoju)
- Facebook: [Profile](https://www.facebook.com/profile.php?id=100079201124141)


© NIKHIL CHARY SRIRAMOJU 
