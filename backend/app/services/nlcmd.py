"""Natural-language / voice edit commands -> structured edit ops (rule-based; LLM planner can replace it)."""
import re
from .i18n import LANGS
_COLORS = {"red":"#EF4444","blue":"#3B82F6","green":"#22C55E","purple":"#8B5CF6","orange":"#F97316","black":"#000000","white":"#FFFFFF","pink":"#EC4899","teal":"#14B8A6","yellow":"#EAB308"}
_NAMES = {v[0].lower(): k for k, v in LANGS.items()}

def parse(cmd: str) -> dict:
    c = cmd.lower().strip()
    if m := re.search(r"translate.*?(?:to|into)\s+([a-z]+)", c):
        if m.group(1) in _NAMES: return {"op": "translate", "lang": _NAMES[m.group(1)]}
    if re.search(r"dark\s*(mode|theme)", c): return {"op": "darkmode"}
    if re.search(r"(remove|erase|delete)\s+(the\s+)?(watermark|clutter)", c): return {"op": "erase", "target": "watermark"}
    if m := re.search(r"(remove|erase|delete)\s+(?:the\s+)?(button|card|image|text|icon)", c): return {"op": "erase", "target": m.group(2)}
    if m := re.search(r"(?:change|replace|set)\s+(?:the\s+)?text\s+(?:to|with)\s+[\"“']?(.+?)[\"”']?$", cmd, re.I): return {"op": "replace_text", "text": m.group(1)}
    if m := re.search(r"make\s+(?:the\s+)?(button|card|background|text)\s+(\w+)", c):
        if m.group(2) in _COLORS: return {"op": "recolor", "target": m.group(1), "color": _COLORS[m.group(2)]}
    if re.search(r"(fix|improve).*(contrast|accessib)", c): return {"op": "a11y_fix", "level": "AAA"}
    if m := re.search(r"(?:extend|expand|outpaint).*?(\d+)\s*(?:px)?", c): return {"op": "outpaint", "px": int(m.group(1))}
    if m := re.search(r"export.*(react|vue|swift|flutter|compose|html|figma)", c): return {"op": "export", "target": m.group(1)}
    return {"op": "unknown", "hint": "Try: 'translate to Hindi', 'dark mode', 'remove watermark', 'make the button blue', 'fix contrast'"}
