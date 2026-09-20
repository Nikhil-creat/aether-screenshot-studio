"""Engine selection: CNN (PyTorch) when weights are configured, classical CV otherwise. RAG: Chroma or built-in lite KB."""
import os, numpy as np
from .cv.classical import detect_layers
from .services.telemetry import TELEMETRY

class Engine:
    def __init__(self):
        self.cnn = None; self.mode = "classical-cv"
        w = os.getenv("AETHER_WEIGHTS")
        if w:
            try:
                from .cv.pipeline import StyleExtractor
                self.cnn = StyleExtractor(weights=w); self.mode = "cnn-resnet101-fpn"
            except Exception as e: TELEMETRY.emit("cnn", "load_failed", error=str(e))
    def analyze(self, rgb: np.ndarray) -> list:
        TELEMETRY.emit("cnn", "analyze", mode=self.mode, size=list(rgb.shape[:2]))
        if self.cnn:
            from PIL import Image
            return [l.__dict__ | {"bbox": list(l.bbox)} for l in self.cnn.analyze(Image.fromarray(rgb))]
        return detect_layers(rgb)

def make_kb():
    try:
        from .rag.store import DesignKB
        return DesignKB(), "chromadb"
    except Exception:
        from .rag.lite import LiteKB
        return LiteKB(), "lite"
