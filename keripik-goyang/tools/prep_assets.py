"""Rectify the pouch fronts from the product photos into flat textures for the 3D pouches."""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "renderer" / "tex"
OUT.mkdir(parents=True, exist_ok=True)

def coeffs(dst, src):
    A, B = [], []
    for (x, y), (X, Y) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -X * x, -X * y]); B.append(X)
        A.append([0, 0, 0, x, y, 1, -Y * x, -Y * y]); B.append(Y)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()

W, H = 640, 1000
jobs = {
    "pouch-manis": ("pack-manis-ngegas.png", [(194, 160), (886, 151), (859, 1188), (263, 1192)]),
    "pouch-pedas": ("pack-pedas-nampol.png", [(230, 236), (866, 236), (850, 1214), (246, 1212)]),
}
for name, (src, corners) in jobs.items():
    im = Image.open(ROOT / "assets" / src).convert("RGB")
    c = coeffs([(0, 0), (W, 0), (W, H), (0, H)], corners)
    flat = im.transform((W, H), Image.PERSPECTIVE, c, Image.BICUBIC)
    flat.save(OUT / f"{name}.jpg", quality=92)
    print("wrote", name)
# end card photo
duo = Image.open(ROOT / "assets" / "pack-duo.png").convert("RGB")
duo.save(OUT / "pack-duo.jpg", quality=92)
from PIL import ImageFilter, ImageEnhance
blur = duo.resize((272, 362)).filter(ImageFilter.GaussianBlur(9))
ImageEnhance.Brightness(blur).enhance(0.55).save(OUT / "pack-duo-blur.jpg", quality=90)
