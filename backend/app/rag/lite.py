"""Zero-dependency fallback design KB (used when chromadb / sentence-transformers are absent).
Small built-in open-source font catalog + token-overlap scoring. Swap for DesignKB in production."""
from .tokens import synthesize_tokens

# family, category, weights, tags
FONTS = [
 ("Inter","sans-serif",(100,900),"ui neutral modern screen dense ios"),
 ("Roboto","sans-serif",(100,900),"android material neutral"),
 ("Open Sans","sans-serif",(300,800),"friendly humanist web"),
 ("Lato","sans-serif",(100,900),"warm humanist"),
 ("Montserrat","sans-serif",(100,900),"geometric headline wide"),
 ("Poppins","sans-serif",(100,900),"geometric rounded friendly startup"),
 ("Nunito","sans-serif",(200,1000),"rounded soft friendly"),
 ("DM Sans","sans-serif",(100,1000),"geometric clean low-contrast"),
 ("Manrope","sans-serif",(200,800),"modern fintech clean"),
 ("Work Sans","sans-serif",(100,900),"grotesque neutral"),
 ("Space Grotesk","sans-serif",(300,700),"techy futuristic quirky"),
 ("Outfit","sans-serif",(100,900),"geometric minimal futuristic"),
 ("Plus Jakarta Sans","sans-serif",(200,800),"modern saas"),
 ("Source Sans 3","sans-serif",(200,900),"adobe humanist ui"),
 ("Noto Sans","sans-serif",(100,900),"multilingual universal"),
 ("Noto Sans Devanagari","sans-serif",(100,900),"hindi devanagari multilingual"),
 ("Noto Sans Telugu","sans-serif",(100,900),"telugu multilingual"),
 ("Playfair Display","serif",(400,900),"editorial elegant high-contrast"),
 ("Merriweather","serif",(300,900),"readable long-form"),
 ("Lora","serif",(400,700),"calligraphic editorial"),
 ("Roboto Mono","monospace",(100,700),"code terminal"),
 ("JetBrains Mono","monospace",(100,800),"code developer ligatures"),
 ("Fira Code","monospace",(300,700),"code ligatures"),
 ("SF Pro (use Inter)","sans-serif",(100,900),"apple ios system"),
]

class LiteKB:
    def __init__(self): self.hits = 0
    def match_font(self, descriptor: str, k=3):
        q = set(descriptor.lower().replace("-", " ").split()); scored = []
        w = next((int(t) for t in q if t.isdigit()), 400)
        for fam, cat, (lo, hi), tags in FONTS:
            score = len(q & set(tags.split())) + (2 if cat in q else 0) + (1 if fam.lower().split()[0] in q else 0)
            score += 1 if lo <= w <= hi else 0
            scored.append((score, fam, cat, lo, hi))
        scored.sort(key=lambda t: -t[0]); self.hits += 1
        return [{"id": f.lower().replace(" ", "-"), "family": f, "category": c, "weight": w,
                 "distance": round(1 - s / 6, 3), "license": "OFL"} for s, f, c, lo, hi in scored[:k]]
    def match_tokens(self, descriptor: str, system=None, k=5): return []
    @staticmethod
    def synthesize_tokens(layers: list) -> dict: return synthesize_tokens(layers)
