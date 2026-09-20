"""Run with pytest, or `python -m tests.test_core` (no pytest needed)."""
import numpy as np, cv2, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app.cv.classical import detect_layers
from app.services import a11y, i18n, editing, exporters, nlcmd, darkmode
from app.rag.lite import LiteKB
from app.agents.graph import build_graph, visual_regression

def synthetic_ui():
    img = np.full((600, 400, 3), 245, np.uint8)
    cv2.rectangle(img, (30, 40), (370, 240), (255, 255, 255), -1); cv2.rectangle(img, (30, 40), (370, 240), (200, 200, 205), 2)
    cv2.rectangle(img, (60, 300), (340, 360), (37, 99, 235), -1)
    cv2.putText(img, "Sign in", (150, 340), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    cv2.putText(img, "Welcome back", (60, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)
    return img

def test_contrast_known_values():
    assert abs(a11y.contrast("#000000", "#FFFFFF") - 21.0) < 0.01
    assert a11y.check("#777777", "#FFFFFF")["AAA"] is False
    fixed = a11y.fix_foreground("#777777", "#FFFFFF", "AAA")
    assert a11y.contrast(fixed, "#FFFFFF") >= 7.0

def test_i18n_coverage_and_glossary():
    assert len(i18n.LANGS) >= 50
    assert i18n.translate("Sign in", "hi")["text"] == "साइन इन"
    assert i18n.translate("Unknown phrase", "fr")["source"] == "untranslated"

def test_detect_and_export():
    layers = detect_layers(synthetic_ui()); kinds = {l["kind"] for l in layers}
    assert layers and ("button" in kinds or "card" in kinds), kinds
    code = exporters.export_all(layers)
    assert set(code) == set(exporters.EXPORTERS)
    assert "Nikhil Chary Sriramoju" in code["react-tailwind"] and "SwiftUI" in code["swiftui"]

def test_outpaint_and_erase():
    img = synthetic_ui(); big = editing.outpaint(img, 20, 30, 40, 50)
    assert big.shape == (660, 480, 3) and (big[20:620, 50:450] == img).all()
    m = np.zeros(img.shape[:2], np.uint8); m[300:360, 60:340] = 255
    out = editing.smart_erase(img, m); assert out.shape == img.shape and out[330, 200].tolist() != [37, 99, 235][::-1]

def test_self_healing_converges():
    """Renderer with an injected colour-management cast: the loop must detect >2% drift and cancel it."""
    img = synthetic_ui(); img[:] = (150, 160, 170)           # mid-tone bg: correction has headroom (no clipping)
    cv2.putText(img, "Old title", (70, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 20, 20), 2)
    layers = detect_layers(img); box = [60, 70, 340, 110]
    def render(s):
        out = editing.apply_edits(s["original"], s["edits"], s.get("params")).astype(np.int16)
        x0, y0, x1, y1 = box; out[y0:y1, x0:x1] += np.array([40, -30, 25], np.int16)   # simulated cast
        return np.clip(out, 0, 255).astype(np.uint8)
    g = build_graph(LiteKB(), render, exporters.EXPORTERS)
    out = g.invoke({"original": img, "layers": layers, "edits": [{"type": "replace_text", "bbox": box, "text": "Hello"}]})
    devs = [a["deviation"] for a in out["audit"] if a["agent"] == "executor"]
    assert len(devs) >= 2 and devs[0] > 0.02, devs          # drift was detected
    assert devs[-1] <= 0.02, devs                            # and healed
    assert any(a["agent"] == "heal" for a in out["audit"])
    assert set(out["code"]) == set(exporters.EXPORTERS)

def test_replace_text_changes_pixels():
    img = synthetic_ui(); out = editing.apply_edits(img, [{"type": "replace_text", "bbox": [60, 70, 340, 110], "text": "Hello"}])
    assert (out != img).any() and out.shape == img.shape

def test_nl_and_dark():
    assert nlcmd.parse("Translate this to Telugu")["lang"] == "te"
    assert nlcmd.parse("make the button blue")["color"] == "#3B82F6"
    d = darkmode.to_dark([{"kind": "card", "bbox": [0, 0, 5, 5], "palette": ["#FFFFFF"], "gradient": None, "shadow": None}])
    assert d[0]["palette"][0] != "#FFFFFF"

def test_cvd_sim():
    a = np.full((2, 2, 3), (255, 0, 0), np.uint8); assert a11y.simulate_cvd(a, "protanopia").shape == a.shape

if __name__ == "__main__":
    fns = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for f in fns:
        try: f(); print("PASS", f.__name__)
        except Exception as e:
            import traceback; print("FAIL", f.__name__, repr(e)); traceback.print_exc()
