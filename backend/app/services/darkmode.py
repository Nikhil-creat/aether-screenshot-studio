"""Generate a dark-mode variant of the layer tree by luminance-aware palette remapping."""
import colorsys, copy
def _h2r(h): h=h.lstrip("#"); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def _r2h(r,g,b): return "#{:02X}{:02X}{:02X}".format(*[round(v*255) for v in (r,g,b)])
def remap(hexc: str) -> str:
    h,l,s = colorsys.rgb_to_hls(*_h2r(hexc)); l2 = 1 - l; l2 = min(max(l2, 0.08), 0.94); s2 = s * (0.9 if l > .5 else 1.0)
    return _r2h(*colorsys.hls_to_rgb(h, l2, s2))
def to_dark(layers: list) -> list:
    out = copy.deepcopy(layers)
    for l in out:
        l["palette"] = [remap(c) for c in l.get("palette", [])]
        g = l.get("gradient")
        if g: g["from"], g["to"] = remap(g["from"]), remap(g["to"])
        if l.get("shadow"): l["shadow"]["opacity"] = min(.7, l["shadow"]["opacity"] * 1.5)
    return out
