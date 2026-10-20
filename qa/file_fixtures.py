"""Generates the sample images and PDFs used by file_tools.py (needs numpy, Pillow, reportlab, pypdf)."""
import os
import numpy as np
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader, PdfWriter


def photo(w, h, seed=0, noise=18):
    r = np.random.default_rng(seed)
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    base = np.stack([(np.sin(x * 6 + seed) + 1) * 100 + 30 + 0 * y, (np.cos(y * 5 + seed) + 1) * 100 + 30 + 0 * x, (x * y) * 200 + 40], axis=-1)
    base = base + r.normal(0, noise, (h, w, 3))
    img = Image.fromarray(np.clip(base, 0, 255).astype("uint8"))
    d = ImageDraw.Draw(img)
    d.ellipse([w * 0.3, h * 0.2, w * 0.7, h * 0.8], fill=(224, 180, 150))
    d.ellipse([w * 0.4, h * 0.4, w * 0.45, h * 0.45], fill=(30, 30, 30))
    d.ellipse([w * 0.55, h * 0.4, w * 0.6, h * 0.45], fill=(30, 30, 30))
    return img


def text_pdf(path, label, pages):
    c = canvas.Canvas(path, pagesize=A4)
    for i in range(1, pages + 1):
        c.setFont("Helvetica", 40)
        c.drawString(100, 700, f"{label}-{i}")
        c.setFont("Helvetica", 12)
        for k in range(30):
            c.drawString(100, 650 - k * 14, f"Line {k} of page {label}-{i}: the quick brown fox jumps over the lazy dog.")
        c.showPage()
    c.save()


def make(d):
    os.makedirs(d, exist_ok=True)
    p = lambda n: os.path.join(d, n)
    photo(3000, 2000, 1).save(p("photo1.jpg"), quality=95)
    photo(1600, 1200, 2).save(p("photo2.jpg"), quality=92)
    photo(1200, 1600, 3).save(p("photo3.jpg"), quality=92)
    photo(2400, 3000, 4, noise=10).save(p("passport.jpg"), quality=95)
    im = Image.new("RGB", (800, 600), (255, 255, 255))
    ImageDraw.Draw(im).rectangle([0, 0, 799, 120], fill=(200, 0, 0))  # red bar along the stored top edge
    ex = im.getexif(); ex[0x0112] = 6  # EXIF orientation 6: displayed rotated 90 degrees clockwise (bar ends up on the right)
    im.save(p("exif6.jpg"), quality=90, exif=ex)
    a = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
    ad = ImageDraw.Draw(a)
    ad.ellipse([50, 50, 350, 350], fill=(220, 30, 30, 255))
    ad.rectangle([300, 100, 560, 300], fill=(30, 90, 220, 200))
    a.save(p("logo_alpha.png"))
    s = Image.new("RGB", (1200, 500), (235, 235, 230))
    ImageDraw.Draw(s).line([(100, 300), (220, 150), (300, 380), (420, 160), (520, 360), (700, 200), (900, 330), (1080, 180)], fill=(20, 30, 120), width=9)
    s.save(p("sig.jpg"), quality=92)
    photo(1000, 800, 5).save(p("pic.webp"), quality=85)
    open(p("notimage.txt"), "w").write("hello")
    open(p("corrupt.jpg"), "wb").write(b"\xff\xd8\xff\xe0garbage-not-a-real-jpeg")
    text_pdf(p("doc_a.pdf"), "A", 3)
    text_pdf(p("doc_b.pdf"), "B", 2)
    text_pdf(p("six.pdf"), "P", 6)
    text_pdf(p("textonly.pdf"), "T", 20)
    photo(2400, 1800, 11).save(p("big1.jpg"), quality=93)
    photo(2400, 1800, 12).save(p("big2.jpg"), quality=93)
    c = canvas.Canvas(p("photo.pdf"), pagesize=A4)
    for i, f in enumerate(["big1.jpg", "big2.jpg"], 1):
        c.setFont("Helvetica", 30); c.drawString(60, 780, f"Scan page {i}")
        c.drawImage(p(f), 40, 100, width=515, height=386)
        c.showPage()
    c.save()
    w = PdfWriter()
    for pg in PdfReader(p("doc_a.pdf")).pages:
        w.add_page(pg)
    w.encrypt("secret")
    w.write(open(p("locked.pdf"), "wb"))
    open(p("fake.pdf"), "wb").write(b"this is not a pdf")
    return d
