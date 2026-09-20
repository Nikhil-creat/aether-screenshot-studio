"""Smart erase, generative-style outpainting, pixel-matched text replacement, edit renderer."""
from __future__ import annotations
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

def smart_erase(rgb: np.ndarray, mask: np.ndarray, radius=4, diffusion=None) -> np.ndarray:
    """mask: HxW uint8 (255 = remove). `diffusion` may be a callable(rgb, mask)->rgb (e.g. SD inpainting)."""
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    if diffusion is not None:
        try: return diffusion(rgb, mask)
        except Exception: pass
    return cv2.inpaint(rgb, mask, radius, cv2.INPAINT_TELEA)

def erase_boxes(rgb, boxes, pad=2):
    m = np.zeros(rgb.shape[:2], np.uint8)
    for x0, y0, x1, y1 in boxes: m[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad] = 255
    return smart_erase(rgb, m)

def outpaint(rgb: np.ndarray, top=0, right=0, bottom=0, left=0) -> np.ndarray:
    """Extend canvas: reflect for pattern continuity, blend to blurred edge-replicate for gradient continuity."""
    refl = cv2.copyMakeBorder(rgb, top, bottom, left, right, cv2.BORDER_REFLECT_101)
    rep = cv2.copyMakeBorder(rgb, top, bottom, left, right, cv2.BORDER_REPLICATE)
    rep = cv2.GaussianBlur(rep, (0, 0), 9)
    H, W = refl.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    d = np.maximum.reduce([np.clip(top - yy, 0, None), np.clip(yy - (H - bottom - 1), 0, None),
                           np.clip(left - xx, 0, None), np.clip(xx - (W - right - 1), 0, None)]).astype(np.float32)
    span = max(top, right, bottom, left, 1); a = np.clip(d / (0.6 * span), 0, 1)[..., None]
    out = (refl * (1 - a) + rep * a).astype(np.uint8)
    out[top:top + rgb.shape[0], left:left + rgb.shape[1]] = rgb; return out

_FONT_CANDIDATES = ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "Arial.ttf", "LiberationSans-Regular.ttf"]
def load_font(size: int, bold=False, path: str | None = None):
    for p in ([path] if path else []) + (["DejaVuSans-Bold.ttf"] if bold else []) + _FONT_CANDIDATES:
        try: return ImageFont.truetype(p, size)
        except Exception: continue
    return ImageFont.load_default()

def _draw_tracked(d: ImageDraw.ImageDraw, xy, text, font, fill, tracking_px):
    x, y = xy
    if abs(tracking_px) < 0.05: d.text((x, y), text, font=font, fill=fill); return
    for ch in text: d.text((x, y), ch, font=font, fill=fill); x += d.textlength(ch, font=font) + tracking_px

def ring_bg(rgb, bb, m=3):
    x0, y0, x1, y1 = bb; H, W = rgb.shape[:2]
    parts = [rgb[max(0, y0 - m):y0, x0:x1], rgb[y1:min(H, y1 + m), x0:x1], rgb[y0:y1, max(0, x0 - m):x0], rgb[y0:y1, x1:min(W, x1 + m)]]
    px = np.concatenate([p.reshape(-1, 3) for p in parts if p.size]) if any(p.size for p in parts) else rgb[y0:y1, x0:x1].reshape(-1, 3)
    return np.median(px, axis=0)

def replace_text(rgb, bb, new_text, color=None, params=None, font_path=None, bold=False, tracking_em=0.0, align="left"):
    """Erase old text (inpaint), colour-correct fill with feedback bias, render new text fitted to bbox."""
    params = params or {}; x0, y0, x1, y1 = bb; w, h = x1 - x0, y1 - y0
    out = erase_boxes(rgb, [bb], pad=1); bias = np.array(params.get("bg_bias", [0, 0, 0]), np.float32)
    reg = out[y0:y1, x0:x1].astype(np.float32) + bias; out[y0:y1, x0:x1] = np.clip(reg, 0, 255).astype(np.uint8)
    bg = ring_bg(rgb, bb)
    if color is None:
        color = (0, 0, 0) if (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) > 140 else (255, 255, 255)
    size = max(8, int(h * 0.8 + params.get("font_size_delta", 0)))
    img = Image.fromarray(out); d = ImageDraw.Draw(img)
    while size > 8:
        f = load_font(size, bold, font_path); tw = d.textlength(new_text, font=f) + tracking_em * size * max(0, len(new_text) - 1)
        if tw <= w: break
        size -= 1
    f = load_font(size, bold, font_path); tr = (tracking_em + params.get("tracking", 0.0)) * size
    tw = d.textlength(new_text, font=f) + tr * max(0, len(new_text) - 1)
    ox = x0 + ({"left": 0, "center": (w - tw) / 2, "right": w - tw}[align]); oy = y0 + (h - size) / 2 - size * 0.08
    _draw_tracked(d, (ox, oy), new_text, f, tuple(int(c) for c in color), tr)
    return np.array(img)

def apply_edits(rgb: np.ndarray, edits: list, params: dict | None = None) -> np.ndarray:
    out = rgb.copy()
    for e in edits:
        t = e.get("type")
        if t == "erase": out = erase_boxes(out, [e["bbox"]])
        elif t == "replace_text":
            out = replace_text(out, e["bbox"], e["text"], color=e.get("color"), params=params, bold=e.get("bold", False),
                               tracking_em=e.get("tracking_em", 0.0), align=e.get("align", "left"))
    return out
