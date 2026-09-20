"""Classical CV layer detector — runs with no trained weights (numpy + OpenCV only).
Used as fallback and as a prior/teacher signal for the CNN. Produces the same Layer schema."""
from __future__ import annotations
import cv2, numpy as np

def hex_of(c): return "#{:02X}{:02X}{:02X}".format(int(c[0]), int(c[1]), int(c[2]))

def palette(crop: np.ndarray, k=4) -> list:
    px = crop.reshape(-1, 3).astype(np.float32)
    if len(px) > 4000: px = px[np.random.RandomState(0).choice(len(px), 4000, replace=False)]
    k = max(1, min(k, len(np.unique(px, axis=0))))
    _, labels, centers = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 15, 1.0),
                                    2, cv2.KMEANS_PP_CENTERS)
    order = np.argsort(-np.bincount(labels.ravel(), minlength=k))
    return [hex_of(centers[i]) for i in order]

def gradient(crop: np.ndarray):
    g = crop.mean(-1)
    if g.shape[0] < 6 or g.shape[1] < 6: return None
    gy, gx = np.gradient(cv2.GaussianBlur(g, (0, 0), 2)); mx, my = float(gx.mean()), float(gy.mean())
    if np.hypot(mx, my) < 0.08: return None
    ang = (np.degrees(np.arctan2(my, mx)) + 90) % 360
    return {"type": "linear", "angle_deg": round(float(ang), 1), "from": hex_of(crop[0, 0]), "to": hex_of(crop[-1, -1])}

def shadow(img: np.ndarray, bb, pad=20):
    x0, y0, x1, y1 = bb; H = img.shape[0]
    if y1 >= H - 6: return None
    band = img[y1:min(H, y1 + pad), x0:x1].mean(-1).mean(-1)
    if len(band) < 5: return None
    d = float(band[-1] - band[0])
    return {"offset_y": 4, "blur": 12.0, "spread": 0, "opacity": round(min(.5, d / 255 * 2), 2)} if d > 4 else None

def detect_layers(rgb: np.ndarray) -> list:
    H, W = rgb.shape[:2]; gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY); layers = []; used = []
    # 1) text lines on the whole image; re-run locally inside boxes later (handles light-on-dark text)
    texts = _find_text(gray, 0, 0, W)
    # 2) boxes: edges -> contours -> rectangles (skip regions that are just text)
    edges = cv2.Canny(gray, 40, 120); edges = cv2.dilate(edges, np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for c in sorted(cnts, key=lambda c: -cv2.contourArea(c)):
        x, y, w, h = cv2.boundingRect(c); area = w * h
        if area < 0.004 * W * H or area > 0.95 * W * H or w < 24 or h < 18: continue
        bb = (x, y, x + w, y + h)
        if any(_cover(bb, t) > 0.55 for t in texts): continue          # a text blob, not a container
        if any(_iou(bb, u) > .6 for u in used): continue
        crop = rgb[y:y + h, x:x + w]; ar = w / h
        inner = [u for u in used if _cover(bb, u) > .9 and (u[2]-u[0])*(u[3]-u[1]) > 3 * area]
        if inner:
            if 0.7 <= ar <= 1.4 and w <= 64: used.append(bb); layers.append(_mk("iconography", bb, rgb))
            continue
        if 1.8 <= ar <= 8 and h <= 90: kind = "button"
        elif float(crop.std()) > 42 and area > 0.03 * W * H: kind = "image"
        elif area > 0.02 * W * H: kind = "card"
        else: kind = "container"
        used.append(bb); layers.append(_mk(kind, bb, rgb))
    for L in list(layers):                                              # local text pass inside boxes
        if L["kind"] in ("button", "card"):
            x0, y0, x1, y1 = L["bbox"]
            texts += [(a + x0, b + y0, c + x0, d + y0) for a, b, c, d in _find_text(gray[y0:y1, x0:x1], 0, 0, x1 - x0)]
    final = []
    for bb in _merge_texts(texts):
        if not any(_iou(bb, f) > .5 for f in final): final.append(bb)
    for bb in final: layers.append(_mk("typography", bb, rgb))
    layers.sort(key=lambda l: (l["bbox"][1], l["bbox"][0])); return layers

def _find_text(gray, ox, oy, W):
    grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    con = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (27, 2)))
    n, _, st, _ = cv2.connectedComponentsWithStats(con); out = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if 8 <= h <= 70 and w >= 1.5 * h and a / (w * h) > 0.25 and w < W * .95: out.append((x + ox, y + oy, x + ox + w, y + oy + h))
    return out

def _cover(a, b):
    """fraction of box a covered by box b"""
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    return ix * iy / max(1, (a[2]-a[0]) * (a[3]-a[1]))

def _merge_texts(boxes):
    """merge word boxes on the same line (small horizontal gaps)"""
    boxes = sorted(boxes, key=lambda b: (b[1], b[0])); out = []
    for b in boxes:
        for i, o in enumerate(out):
            if abs(b[1] - o[1]) < 8 and abs(b[3] - o[3]) < 10 and 0 <= b[0] - o[2] < 22:
                out[i] = (o[0], min(o[1], b[1]), b[2], max(o[3], b[3])); break
        else: out.append(b)
    return out

def _iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1])); i = ix * iy
    u = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - i
    return i / u if u else 0

def _mk(kind, bb, rgb):
    x0, y0, x1, y1 = bb; crop = rgb[y0:y1, x0:x1]
    L = {"kind": kind, "bbox": [int(v) for v in bb], "palette": palette(crop), "gradient": None if kind == "typography" else gradient(crop),
         "shadow": shadow(rgb, bb) if kind in ("card", "button") else None, "backdrop_blur_px": None, "text": None, "font": None}
    if kind == "typography":
        L["font"] = {"family": "sans", "weight": 400 if (y1 - y0) < 26 else 600, "size_px": int((y1 - y0) * 0.75),
                     "category": "sans-serif", "tracking_em": 0.0, "leading_em": 1.3}
    return L
