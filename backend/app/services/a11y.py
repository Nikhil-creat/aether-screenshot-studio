"""WCAG contrast (AA/AAA), auto-fix, and colour-vision-deficiency simulation."""
import numpy as np

def _rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def _hex(c): return "#{:02X}{:02X}{:02X}".format(*[int(round(max(0, min(255, v)))) for v in c])
def _lin(v):
    v /= 255.0; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
def luminance(c): r, g, b = (_lin(v) for v in c); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(_rgb(a)), luminance(_rgb(b))), reverse=True); return (la + 0.05) / (lb + 0.05)

def is_large(size_px: float, bold: bool) -> bool: return size_px >= 24 or (bold and size_px >= 18.66)
def required(level: str, large: bool) -> float: return {"AA": 4.5, "AAA": 7.0}[level] if not large else {"AA": 3.0, "AAA": 4.5}[level]

def check(fg: str, bg: str, size_px=16, bold=False) -> dict:
    r = contrast(fg, bg); L = is_large(size_px, bold)
    return {"ratio": round(r, 2), "large": L, "AA": r >= required("AA", L), "AAA": r >= required("AAA", L)}

def fix_foreground(fg: str, bg: str, level="AAA", size_px=16, bold=False) -> str:
    """Move fg toward black/white (whichever reaches the target) with minimal shift."""
    need = required(level, is_large(size_px, bold)); f = np.array(_rgb(fg), float)
    if contrast(fg, bg) >= need: return fg
    for target in (np.zeros(3), np.full(3, 255.0)):
        if contrast(_hex(target), bg) < need: continue
        lo, hi = 0.0, 1.0
        for _ in range(24):
            mid = (lo + hi) / 2
            if contrast(_hex(f + (target - f) * mid), bg) >= need: hi = mid
            else: lo = mid
        return _hex(f + (target - f) * hi)
    return "#000000" if luminance(_rgb(bg)) > 0.18 else "#FFFFFF"

_CVD = {"protanopia": [[.567, .433, 0], [.558, .442, 0], [0, .242, .758]],
        "deuteranopia": [[.625, .375, 0], [.7, .3, 0], [0, .3, .7]],
        "tritanopia": [[.95, .05, 0], [0, .433, .567], [0, .475, .525]]}
def simulate_cvd(rgb: np.ndarray, kind: str) -> np.ndarray:
    m = np.array(_CVD[kind]); out = rgb.astype(np.float32) @ m.T; return np.clip(out, 0, 255).astype(np.uint8)

def audit_layers(layers: list, level="AAA") -> dict:
    issues, ok = [], 0
    for i, l in enumerate(layers):
        if l["kind"] != "typography" or len(l.get("palette") or []) < 2: continue
        bg = l["palette"][0]
        fg = max(l["palette"][1:], key=lambda c: contrast(c, bg))
        f = l.get("font") or {}; res = check(fg, bg, f.get("size_px", 16), f.get("weight", 400) >= 700)
        if res[level]: ok += 1
        else: issues.append({"layer": i, "fg": fg, "bg": bg, **res,
                             "suggested_fg": fix_foreground(fg, bg, level, f.get("size_px", 16), f.get("weight", 400) >= 700)})
    return {"level": level, "passed": ok, "failed": len(issues), "issues": issues}
