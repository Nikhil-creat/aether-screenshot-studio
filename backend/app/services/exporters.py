"""Layer tree -> production code for 6 targets."""
from __future__ import annotations
from .a11y import contrast
from ..branding import HEADER

RADIUS = {"button": 12, "card": 16, "container": 8, "image": 12, "iconography": 6, "typography": 0}

def _c(l):
    p = l.get("palette") or ["#FFFFFF"]; bg = p[0]
    fg = max(p[1:], key=lambda c: contrast(c, bg)) if len(p) > 1 else "#111111"
    return bg, fg
def _grad(l):
    g = l.get("gradient"); return f"linear-gradient({g['angle_deg']}deg, {g['from']}, {g['to']})" if g else None
def _shadow(l):
    s = l.get("shadow"); return f"0 {s['offset_y']}px {s['blur']}px rgba(0,0,0,{s['opacity']})" if s else None
def _box(l): x0, y0, x1, y1 = l["bbox"]; return x0, y0, x1 - x0, y1 - y0
def _txt(l): return l.get("text") or ("Text" if l["kind"] == "typography" else "")
def _hex_swift(h): h = h.lstrip("#"); return f"Color(red: {int(h[0:2],16)/255:.3f}, green: {int(h[2:4],16)/255:.3f}, blue: {int(h[4:6],16)/255:.3f})"
def _hex_flutter(h): return f"Color(0xFF{h.lstrip('#').upper()})"
def _hex_kt(h): return f"Color(0xFF{h.lstrip('#').upper()})"

def _dims(layers):
    return max((l["bbox"][2] for l in layers), default=390), max((l["bbox"][3] for l in layers), default=844)

def html_css(layers, tokens=None):
    W, H = _dims(layers); css = [f".screen{{position:relative;width:{W}px;height:{H}px;overflow:hidden;font-family:Inter,system-ui,sans-serif}}"]
    body = []
    for i, l in enumerate(layers):
        x, y, w, h = _box(l); bg, fg = _c(l); f = l.get("font") or {}
        r = [f"left:{x}px", f"top:{y}px", f"width:{w}px", f"height:{h}px", "position:absolute"]
        if l["kind"] == "typography":
            r += [f"color:{fg}", f"font-size:{f.get('size_px',16)}px", f"font-weight:{f.get('weight',400)}", f"line-height:{f.get('leading_em',1.3)}",
                  f"letter-spacing:{f.get('tracking_em',0)}em", "display:flex", "align-items:center"]
        else:
            r += [f"background:{_grad(l) or bg}", f"border-radius:{RADIUS.get(l['kind'],8)}px"]
            if _shadow(l): r.append(f"box-shadow:{_shadow(l)}")
            if l.get("backdrop_blur_px"): r.append(f"backdrop-filter:blur({l['backdrop_blur_px']}px)")
        css.append(f".l{i}{{{';'.join(r)}}}"); body.append(f'  <div class="l{i}" data-kind="{l["kind"]}">{_txt(l)}</div>')
    return f"<!-- {HEADER} -->\n<style>\n" + "\n".join(css) + "\n</style>\n<div class=\"screen\">\n" + "\n".join(body) + "\n</div>\n"

def react_tailwind(layers, tokens=None):
    W, H = _dims(layers); rows = []
    for l in layers:
        x, y, w, h = _box(l); bg, fg = _c(l); f = l.get("font") or {}
        if l["kind"] == "typography":
            st = f"{{{{left:{x},top:{y},width:{w},height:{h},color:'{fg}',fontSize:{f.get('size_px',16)},fontWeight:{f.get('weight',400)}}}}}"
            rows.append(f'      <p className="absolute flex items-center" style={st}>{_txt(l)}</p>')
        else:
            g = _grad(l) or bg; sh = _shadow(l)
            st = f"{{{{left:{x},top:{y},width:{w},height:{h},background:'{g}',borderRadius:{RADIUS.get(l['kind'],8)}" + (f",boxShadow:'{sh}'" if sh else "") + "}}"
            rows.append(f'      <div className="absolute" style={st}/>')
    return f"// {HEADER}\nexport default function Screen() {{\n  return (\n    <div className=\"relative overflow-hidden font-sans\" style={{{{width:{W},height:{H}}}}}>\n" + "\n".join(rows) + "\n    </div>\n  );\n}\n"

def vue(layers, tokens=None):
    return f"<!-- {HEADER} -->\n<template>\n" + "\n".join(
        f'  <div class="l" :style="{{left:\'{_box(l)[0]}px\',top:\'{_box(l)[1]}px\',width:\'{_box(l)[2]}px\',height:\'{_box(l)[3]}px\',background:\'{"transparent" if l["kind"]=="typography" else (_grad(l) or _c(l)[0])}\',color:\'{_c(l)[1]}\',borderRadius:\'{RADIUS.get(l["kind"],8)}px\'}}">{_txt(l)}</div>'
        for l in layers) + "\n</template>\n<style scoped>.l{position:absolute;display:flex;align-items:center}</style>\n"

def swiftui(layers, tokens=None):
    W, H = _dims(layers); rows = []
    for l in layers:
        x, y, w, h = _box(l); bg, fg = _c(l); f = l.get("font") or {}
        if l["kind"] == "typography":
            rows.append(f'            Text("{_txt(l)}").font(.system(size: {f.get("size_px",16)}, weight: .{"bold" if f.get("weight",400)>=600 else "regular"})).foregroundColor({_hex_swift(fg)}).frame(width: {w}, height: {h}, alignment: .leading).position(x: {x+w/2:.0f}, y: {y+h/2:.0f})')
        else:
            sh = l.get("shadow"); s = f".shadow(color: .black.opacity({sh['opacity']}), radius: {sh['blur']/2:.0f}, y: {sh['offset_y']})" if sh else ""
            rows.append(f'            RoundedRectangle(cornerRadius: {RADIUS.get(l["kind"],8)}).fill({_hex_swift(bg)}){s}.frame(width: {w}, height: {h}).position(x: {x+w/2:.0f}, y: {y+h/2:.0f})')
    return f"// {HEADER}\nimport SwiftUI\n\nstruct ScreenView: View {{\n    var body: some View {{\n        ZStack {{\n" + "\n".join(rows) + f"\n        }}\n        .frame(width: {W}, height: {H})\n    }}\n}}\n"

def flutter(layers, tokens=None):
    W, H = _dims(layers); rows = []
    for l in layers:
        x, y, w, h = _box(l); bg, fg = _c(l); f = l.get("font") or {}
        if l["kind"] == "typography":
            child = f"Text('{_txt(l)}', style: TextStyle(fontSize: {f.get('size_px',16)}, fontWeight: FontWeight.w{f.get('weight',400)}, color: {_hex_flutter(fg)}))"
        else:
            sh = l.get("shadow"); bs = f", boxShadow: [BoxShadow(blurRadius: {sh['blur']}, offset: Offset(0, {sh['offset_y']}), color: Colors.black.withOpacity({sh['opacity']}))]" if sh else ""
            child = f"Container(decoration: BoxDecoration(color: {_hex_flutter(bg)}, borderRadius: BorderRadius.circular({RADIUS.get(l['kind'],8)}){bs}))"
        rows.append(f"        Positioned(left: {x}, top: {y}, width: {w}, height: {h}, child: {child}),")
    return f"// {HEADER}\nimport 'package:flutter/material.dart';\n\nclass ScreenView extends StatelessWidget {{\n  const ScreenView({{super.key}});\n  @override\n  Widget build(BuildContext context) => SizedBox(width: {W}, height: {H}, child: Stack(children: [\n" + "\n".join(rows) + "\n  ]));\n}\n"

def compose(layers, tokens=None):
    rows = []
    for l in layers:
        x, y, w, h = _box(l); bg, fg = _c(l); f = l.get("font") or {}
        if l["kind"] == "typography":
            rows.append(f'    Text("{_txt(l)}", color = {_hex_kt(fg)}, fontSize = {f.get("size_px",16)}.sp, modifier = Modifier.offset({x}.dp, {y}.dp).size({w}.dp, {h}.dp))')
        else:
            rows.append(f'    Box(Modifier.offset({x}.dp, {y}.dp).size({w}.dp, {h}.dp).shadow({(l.get("shadow") or {}).get("blur",0)/2:.0f}.dp, RoundedCornerShape({RADIUS.get(l["kind"],8)}.dp)).background({_hex_kt(bg)}, RoundedCornerShape({RADIUS.get(l["kind"],8)}.dp)))')
    return f"// {HEADER}\nimport androidx.compose.foundation.background\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.foundation.shape.RoundedCornerShape\nimport androidx.compose.material3.Text\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.draw.shadow\nimport androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.unit.*\n\n@Composable\nfun ScreenView() = Box(Modifier.fillMaxSize()) {{\n" + "\n".join(rows) + "\n}\n"

def figma_json(layers, tokens=None):
    import json
    return json.dumps({"generator": HEADER, "nodes": [{"id": str(i), "type": "TEXT" if l["kind"] == "typography" else "RECTANGLE",
        "x": l["bbox"][0], "y": l["bbox"][1], "width": _box(l)[2], "height": _box(l)[3], "fills": [{"color": _c(l)[0]}],
        "characters": l.get("text")} for i, l in enumerate(layers)]}, indent=2)

EXPORTERS = {"html-css": html_css, "react-tailwind": react_tailwind, "vue": vue, "swiftui": swiftui,
             "flutter": flutter, "compose": compose, "figma-json": figma_json}
def export_all(layers, tokens=None): return {k: fn(layers, tokens) for k, fn in EXPORTERS.items()}
