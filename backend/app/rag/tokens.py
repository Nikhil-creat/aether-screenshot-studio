def synthesize_tokens(layers: list) -> dict:
    """Design-token JSON + CSS variables + Tailwind extension from extracted layers."""
    colors = {}
    for l in layers:
        for c in (l.get("palette") or [])[:2]:
            colors.setdefault(c, f"c{len(colors)+1}")
    css = ":root{" + "".join(f"--color-{n}:{h};" for h, n in colors.items()) + "}"
    return {"json": {"color": {n: {"value": h} for h, n in colors.items()}}, "css": css,
            "tailwind": {"theme": {"extend": {"colors": {n: h for h, n in colors.items()}}}}}
