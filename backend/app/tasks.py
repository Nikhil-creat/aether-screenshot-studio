from celery import Celery
celery = Celery("aether", broker="redis://redis:6379/0", backend="redis://redis:6379/1")

@celery.task
def analyze_task(image_bytes: bytes):
    import io
    import numpy as np
    from PIL import Image
    from .main import engine, run_graph
    img = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    out = run_graph(img, engine.analyze(img), [])
    return {"layers": out["layers"], "code": out["code"]}
