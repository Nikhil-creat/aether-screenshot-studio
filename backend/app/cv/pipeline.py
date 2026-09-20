"""CNN style-extraction pipeline: ResNet-101 + FPN multi-task model."""
from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np, torch, torch.nn as nn, torch.nn.functional as F
from torchvision.models import resnet101, ResNet101_Weights
from torchvision.ops import FeaturePyramidNetwork
from PIL import Image

UI_CLASSES = ["background", "typography", "iconography", "button", "card", "image", "container"]
FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]


class UISceneParser(nn.Module):
    """Shared ResNet-101 backbone + FPN; heads: semantic segmentation, font weight, font metrics."""

    def __init__(self, n_classes=len(UI_CLASSES), fpn_ch=256, pretrained=True):
        super().__init__()
        bb = resnet101(weights=ResNet101_Weights.DEFAULT if pretrained else None)
        self.stem = nn.Sequential(bb.conv1, bb.bn1, bb.relu, bb.maxpool)
        self.layers = nn.ModuleList([bb.layer1, bb.layer2, bb.layer3, bb.layer4])
        self.fpn = FeaturePyramidNetwork([256, 512, 1024, 2048], fpn_ch)
        self.seg_head = nn.Sequential(
            nn.Conv2d(fpn_ch * 4, fpn_ch, 3, padding=1), nn.BatchNorm2d(fpn_ch), nn.ReLU(),
            nn.Conv2d(fpn_ch, n_classes, 1))
        self.font_weight_head = nn.Linear(fpn_ch, len(FONT_WEIGHTS))
        self.font_metrics_head = nn.Linear(fpn_ch, 4)  # size_px, tracking_em, leading_em, kerning_bias

    def forward(self, x: torch.Tensor):
        H, W = x.shape[-2:]
        feats, h = {}, self.stem(x)
        for i, layer in enumerate(self.layers):
            h = layer(h); feats[str(i)] = h
        p = self.fpn(feats)
        target = p["0"].shape[-2:]
        fused = torch.cat([F.interpolate(v, size=target, mode="bilinear", align_corners=False)
                           for v in p.values()], dim=1)
        seg = F.interpolate(self.seg_head(fused), size=(H, W), mode="bilinear", align_corners=False)
        return {"seg": seg, "pyramid": p}

    def text_heads(self, pooled: torch.Tensor):
        """pooled: RoI-pooled FPN features of a text crop, shape [N, fpn_ch]."""
        return self.font_weight_head(pooled), self.font_metrics_head(pooled)


@dataclass
class Layer:
    kind: str
    bbox: tuple
    palette: list = field(default_factory=list)
    gradient: dict | None = None
    shadow: dict | None = None
    backdrop_blur_px: float | None = None
    text: str | None = None
    font: dict | None = None


def rgba_hex(c) -> str:
    return "#{:02X}{:02X}{:02X}".format(*[int(v) for v in c[:3]])


def extract_palette(crop: np.ndarray, k=5) -> list:
    from sklearn.cluster import KMeans
    px = crop.reshape(-1, crop.shape[-1])[:, :3].astype(np.float32)
    if len(px) > 5000: px = px[np.random.choice(len(px), 5000, replace=False)]
    km = KMeans(n_clusters=min(k, len(px)), n_init=3).fit(px)
    order = np.argsort(-np.bincount(km.labels_))
    return [rgba_hex(km.cluster_centers_[i]) for i in order]


def estimate_gradient(crop: np.ndarray) -> dict | None:
    """Linear gradient estimate from mean luminance gradient; angle in CSS convention."""
    g = crop[..., :3].mean(-1)
    h, w = g.shape
    if h < 4 or w < 4: return None
    gy, gx = np.gradient(g)
    mx, my = gx.mean(), gy.mean()
    if np.hypot(mx, my) < 0.05: return None
    angle = (np.degrees(np.arctan2(my, mx)) + 90) % 360
    return {"type": "linear", "angle_deg": round(float(angle), 1),
            "from": rgba_hex(crop[0, 0]), "to": rgba_hex(crop[-1, -1])}


def estimate_shadow(img: np.ndarray, bbox, pad=24) -> dict | None:
    """Approximate shadow from luminance falloff just below a box."""
    x0, y0, x1, y1 = bbox; H = img.shape[0]
    if y1 >= H - 4: return None
    band = img[y1:min(H, y1 + pad), x0:x1, :3].mean(-1).mean(-1)
    if len(band) < 4: return None
    drop = float(band[-1] - band[0])
    if drop < 4: return None
    return {"offset_y": 4, "blur": round(pad * 0.6, 1), "spread": 0,
            "opacity": round(min(0.6, drop / 255 * 2), 2)}


class StyleExtractor:
    def __init__(self, device="cuda" if torch.cuda.is_available() else "cpu", weights: str | None = None):
        self.device = device
        self.model = UISceneParser().to(device).eval()
        if weights: self.model.load_state_dict(torch.load(weights, map_location=device))
        self.mean = torch.tensor([0.485, 0.456, 0.406], device=device).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225], device=device).view(1, 3, 1, 1)

    @torch.inference_mode()
    def segment(self, img: Image.Image) -> np.ndarray:
        x = torch.from_numpy(np.array(img.convert("RGB"))).permute(2, 0, 1).float().div(255)[None].to(self.device)
        out = self.model((x - self.mean) / self.std)["seg"]
        return out.argmax(1)[0].cpu().numpy()

    def regions(self, mask: np.ndarray, min_area=64):
        import cv2
        for cid, name in enumerate(UI_CLASSES[1:], start=1):
            m = (mask == cid).astype(np.uint8)
            n, _, stats, _ = cv2.connectedComponentsWithStats(m)
            for i in range(1, n):
                x, y, w, h, a = stats[i]
                if a >= min_area: yield name, (int(x), int(y), int(x + w), int(y + h))

    def analyze(self, img: Image.Image, ocr=None) -> list:
        arr = np.array(img.convert("RGBA")); mask = self.segment(img); layers = []
        for kind, bb in self.regions(mask):
            x0, y0, x1, y1 = bb; crop = arr[y0:y1, x0:x1]
            L = Layer(kind, bb, palette=extract_palette(crop), gradient=estimate_gradient(crop),
                      shadow=estimate_shadow(arr, bb) if kind in {"card", "button"} else None)
            if kind == "typography" and ocr is not None:
                L.text, L.font = ocr(crop)  # plug PaddleOCR/TrOCR + font heads here
            layers.append(L)
        return layers
