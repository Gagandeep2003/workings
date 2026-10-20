"""
Real-browser tests for the image, PDF and QR tools. Every download is verified independently of the site's own code:
images with Pillow, PDFs with pypdf and poppler (pdftoppm), ZIPs with zipfile, QR codes with the jsqr decoder.

  npm run build && npm start -- -p 3111      # in one terminal
  pip install playwright numpy pillow reportlab pypdf && playwright install chromium
  BASE=http://localhost:3111 python3 qa/file_tools.py
"""
import io, os, re, subprocess, sys, tempfile, traceback, zipfile
from playwright.sync_api import sync_playwright
from PIL import Image
from pypdf import PdfReader
sys.path.insert(0, os.path.dirname(__file__))
import file_fixtures

BASE = os.environ.get("BASE", "http://localhost:3111")
HERE = os.path.dirname(os.path.abspath(__file__))
FX = file_fixtures.make(os.path.join(tempfile.gettempdir(), "workings-fx"))
DL = os.path.join(tempfile.gettempdir(), "workings-dl")
os.makedirs(DL, exist_ok=True)
fx = lambda *n: [os.path.join(FX, x) for x in n]
results = []


def check(name, cond, detail=""):
    results.append((bool(cond), name, detail))
    print(("PASS " if cond else "FAIL ") + name + ((" — " + str(detail)) if detail and not cond else ""))


def open_page(browser, path, width=1280, height=900):
    ctx = browser.new_context(viewport={"width": width, "height": height}, accept_downloads=True)
    page = ctx.new_page()
    page.errors = []
    page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.goto(BASE + path, wait_until="networkidle")
    page.wait_for_selector("input.dropzone__input, #qr-url, #qr-ssid, #up-vpa", state="attached", timeout=30000)
    return page


def save_download(page, click, name):
    with page.expect_download(timeout=90000) as d:
        click()
    p = os.path.join(DL, name)
    d.value.save_as(p)
    return p


def no_console_errors(page, label):
    errs = [e for e in page.errors if "favicon" not in e]
    check(f"{label}: no console errors", not errs, errs[:2])


def pdf_text(path):
    return "\n".join((p.extract_text() or "") for p in PdfReader(path).pages)


def order(text, pattern=r"\b[A-Z]-\d\b"):
    """Headings in order of appearance, each once (the body text of a page repeats its heading many times)."""
    return list(dict.fromkeys(re.findall(pattern, text)))


def render_first_page(path, dpi=30):
    out = os.path.join(DL, "render")
    subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-f", "1", "-l", "1", path, out], check=True)
    f = [x for x in os.listdir(DL) if x.startswith("render")][0]
    img = Image.open(os.path.join(DL, f)).convert("RGB")
    os.remove(os.path.join(DL, f))
    return img


def decode_qr(png_path):
    return subprocess.run(["node", os.path.join(HERE, "decode_qr.mjs"), png_path], capture_output=True, text=True, cwd=os.path.dirname(HERE)).stdout


def poll(cond, timeout=90, step=0.25):
    """Wait until cond() is truthy. Done on the Python side because the site's CSP forbids eval in the page."""
    import time
    end = time.time() + timeout
    while time.time() < end:
        try:
            if cond():
                return True
        except Exception:
            pass
        time.sleep(step)
    raise TimeoutError("condition not met in time")


def body_has(page, *texts):
    return all(t in page.inner_text("body") for t in texts)


def wait_done(page, n=1, timeout=90000):
    poll(lambda: page.locator(".file-row--done").count() >= n, timeout / 1000)


# ---------------------------------------------------------------------------------------------------------------------
def t_compressor(b):
    page = open_page(b, "/image-pdf/image-compressor")
    orig = os.path.getsize(fx("photo1.jpg")[0])
    page.set_input_files("input.dropzone__input", fx("photo1.jpg"))
    wait_done(page)
    p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), "c1.jpg")
    im = Image.open(p)
    check("compressor: output is a valid JPEG with the same dimensions", im.format == "JPEG" and im.size == (3000, 2000), (im.format, im.size))
    check("compressor: file is much smaller than the original", os.path.getsize(p) < orig * 0.6, (orig, os.path.getsize(p)))
    row = page.locator(".file-row__line").first.inner_text()
    check("compressor: row shows sizes and percent saved", "smaller" in row and "→" in row, row)
    page.locator("button:has-text('Before / after')").click()
    page.wait_for_selector(".compare img")
    check("compressor: before/after preview shows both pictures", page.locator(".compare img").count() == 2)
    no_console_errors(page, "compressor")

    # target size
    page.select_option("#ic-mode", "target")
    page.fill("#ic-kb", "100")
    poll(lambda: page.locator(".file-row__note").count() > 0, 60)
    wait_done(page)
    p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), "c2.jpg")
    check("compressor target: result is at most 100 KB (100,000 bytes)", os.path.getsize(p) <= 100000, os.path.getsize(p))
    check("compressor target: result is a valid image", Image.open(p).format == "JPEG")
    page.close()

    # batch + zip
    page = open_page(b, "/image-pdf/image-compressor")
    page.set_input_files("input.dropzone__input", fx("photo1.jpg", "photo2.jpg", "photo3.jpg"))
    wait_done(page, 3)
    p = save_download(page, lambda: page.locator("button:has-text('Download all (ZIP)')").click(), "batch.zip")
    z = zipfile.ZipFile(p)
    check("compressor batch: ZIP is valid with 3 files", z.testzip() is None and len(z.namelist()) == 3, z.namelist())
    ok = all(Image.open(io.BytesIO(z.read(n))).format == "JPEG" for n in z.namelist())
    check("compressor batch: every file in the ZIP opens as a JPEG", ok)
    page.close()

    # PNG with transparency stays PNG with alpha
    page = open_page(b, "/image-pdf/image-compressor")
    page.set_input_files("input.dropzone__input", fx("logo_alpha.png"))
    wait_done(page)
    p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), "logo.png")
    im = Image.open(p)
    alpha = im.convert("RGBA").getchannel("A")
    check("compressor: transparent PNG stays PNG with transparency", im.format == "PNG" and alpha.getextrema()[0] == 0, (im.format, alpha.getextrema()))
    page.close()

    # errors
    page = open_page(b, "/image-pdf/image-compressor")
    page.set_input_files("input.dropzone__input", fx("notimage.txt"))
    page.wait_for_selector(".notice--warn")
    check("compressor: non-image file is rejected with a clear message", "isn't an image" in page.locator(".notice--warn").inner_text())
    page.set_input_files("input.dropzone__input", fx("corrupt.jpg"))
    page.wait_for_selector(".file-row--error", timeout=30000)
    check("compressor: corrupt image gives a readable error", "couldn't be read as an image" in page.locator(".file-row--error").inner_text())
    page.close()


def t_converter(b):
    page = open_page(b, "/image-pdf/image-converter")
    page.select_option("#cv-to", "jpeg")
    page.set_input_files("input.dropzone__input", fx("logo_alpha.png"))
    wait_done(page)
    check("converter: warns that transparency is lost when saving as JPG", "Transparent areas" in page.locator(".file-row__note--warn").inner_text())
    p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), "conv.jpg")
    im = Image.open(p)
    check("converter: PNG → real JPEG file", im.format == "JPEG", im.format)
    r, g, bb = im.convert("RGB").getpixel((5, 5))
    check("converter: transparent corner became white", r > 240 and g > 240 and bb > 240, (r, g, bb))
    page.close()
    for src, to, fmt in [("photo2.jpg", "png", "PNG"), ("pic.webp", "jpeg", "JPEG"), ("photo2.jpg", "webp", "WEBP")]:
        page = open_page(b, "/image-pdf/image-converter")
        page.select_option("#cv-to", to)
        page.set_input_files("input.dropzone__input", fx(src))
        wait_done(page)
        p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), f"conv_{to}")
        check(f"converter: {src} → {to} is genuinely {fmt}", Image.open(p).format == fmt, Image.open(p).format)
        page.close()
    page = open_page(b, "/image-pdf/image-converter")
    page.select_option("#cv-to", "png")
    page.set_input_files("input.dropzone__input", fx("photo2.jpg"))
    wait_done(page)
    with page.expect_download() as d:
        page.locator(".file-row__actions button:has-text('Download')").first.click()
    check("converter: suggested file name has the new extension", d.value.suggested_filename.endswith(".png"), d.value.suggested_filename)
    page.close()


def t_resizer(b):
    cases = [
        ("px", {"#rz-w": "800", "#rz-h": ""}, (800, 533)),
        ("percent", {"#rz-w": "50"}, (1500, 1000)),
    ]
    for unit, fields, expected in cases:
        page = open_page(b, "/image-pdf/image-resizer")
        page.select_option("#rz-unit", unit)
        for k, v in fields.items():
            page.fill(k, v)
        page.set_input_files("input.dropzone__input", fx("photo1.jpg"))
        wait_done(page)
        p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), f"rz_{unit}.jpg")
        check(f"resizer: {unit} gives {expected}", Image.open(p).size == expected, Image.open(p).size)
        page.close()
    page = open_page(b, "/image-pdf/image-resizer")
    page.select_option("#rz-unit", "cm")
    page.fill("#rz-w", "3.5"); page.fill("#rz-h", "4.5"); page.fill("#rz-dpi", "300")
    page.select_option("#rz-keep", "exact")
    page.set_input_files("input.dropzone__input", fx("passport.jpg"))
    wait_done(page)
    p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), "rz_cm.jpg")
    check("resizer: 3.5 × 4.5 cm at 300 DPI, exact → 413 × 531 px", Image.open(p).size == (413, 531), Image.open(p).size)
    page.fill("#rz-w", "-5")
    page.wait_for_selector(".file-row--error", timeout=20000)
    check("resizer: invalid size gives a readable error", "greater than zero" in page.locator(".file-row--error").inner_text() or "above zero" in page.locator(".file-row--error").inner_text())
    page.close()


def t_photo(b):
    page = open_page(b, "/image-pdf/passport-photo-resizer")
    page.set_input_files("input.dropzone__input", fx("passport.jpg"))
    page.wait_for_selector(".photo-result img", timeout=60000)
    page.wait_for_timeout(800)
    p = save_download(page, lambda: page.locator("button:has-text('Download JPG')").click(), "photo.jpg")
    im = Image.open(p); size = os.path.getsize(p)
    check("photo: exactly 200 × 230 px", im.size == (200, 230) and im.format == "JPEG", (im.size, im.format))
    check("photo: file size within 20–50 KB (20,480 … 50,000 bytes)", 20480 <= size <= 50000, size)
    check("photo: panel says it is within the limit", "Within your size limit" in page.locator(".photo-result").inner_text())
    # moving the frame changes the output
    page.locator(".crop").focus()
    for _ in range(6): page.keyboard.press("ArrowRight")
    page.fill("#pr-min", ""); page.fill("#pr-max", "1")
    page.wait_for_selector(".notice--warn:has-text('above your 1 KB limit')", timeout=30000)
    check("photo: impossible limit is reported honestly", "smallest JPG" in page.locator(".photo-result").inner_text())
    page.fill("#pr-min", "20"); page.fill("#pr-max", "10")
    page.wait_for_selector(".notice--error:has-text('minimum size is larger')", timeout=15000)
    check("photo: min greater than max is explained", True)
    page.close()

    page = open_page(b, "/image-pdf/passport-photo-resizer")
    page.select_option("#pr-unit", "cm"); page.fill("#pr-w", "3.5"); page.fill("#pr-h", "4.5"); page.fill("#pr-dpi", "300"); page.fill("#pr-min", ""); page.fill("#pr-max", "50")
    page.set_input_files("input.dropzone__input", fx("passport.jpg"))
    page.wait_for_selector(".photo-result img", timeout=60000); page.wait_for_timeout(800)
    p = save_download(page, lambda: page.locator("button:has-text('Download JPG')").click(), "photo_cm.jpg")
    check("photo: 3.5 × 4.5 cm at 300 DPI → 413 × 531 px, ≤ 50 KB", Image.open(p).size == (413, 531) and os.path.getsize(p) <= 50000, (Image.open(p).size, os.path.getsize(p)))
    page.close()

    page = open_page(b, "/image-pdf/signature-resizer")
    page.set_input_files("input.dropzone__input", fx("sig.jpg"))
    page.wait_for_selector(".photo-result img", timeout=60000); page.wait_for_timeout(800)
    p = save_download(page, lambda: page.locator("button:has-text('Download JPG')").click(), "sig_out.jpg")
    im = Image.open(p); size = os.path.getsize(p)
    check("signature: 140 × 60 px valid JPEG", im.size == (140, 60) and im.format == "JPEG", (im.size, im.format))
    check("signature: padded into the 10–20 KB window", 10240 <= size <= 20000, size)
    im.load()
    px = im.convert("L").getpixel((2, 2))
    check("signature: paper cleaned to near-white", px > 235, px)
    page.select_option("#pr-fmt", "png")
    page.wait_for_timeout(1500); page.wait_for_selector("button:has-text('Download PNG')", timeout=30000)
    p = save_download(page, lambda: page.locator("button:has-text('Download PNG')").click(), "sig_out.png")
    im = Image.open(p); im.load()
    check("signature PNG: valid, 140 × 60 and padded to ≥ 10 KB", im.format == "PNG" and im.size == (140, 60) and os.path.getsize(p) >= 10240, (im.format, im.size, os.path.getsize(p)))
    no_console_errors(page, "signature")
    page.close()


def t_jpg_to_pdf(b):
    page = open_page(b, "/image-pdf/jpg-to-pdf")
    page.set_input_files("input.dropzone__input", fx("exif6.jpg", "photo2.jpg", "photo3.jpg", "pic.webp"))
    page.wait_for_selector(".file-row")
    page.locator("button[aria-label='Rotate photo3.jpg right']").click()
    page.click("button:has-text('Create PDF')")
    page.wait_for_selector(".photo-result button:has-text('Download PDF')", timeout=60000)
    page.wait_for_selector(".thumb-strip img", timeout=30000)
    check("jpg→pdf: page previews are drawn", page.locator(".thumb-strip img").count() == 4)
    p = save_download(page, lambda: page.locator("button:has-text('Download PDF')").click(), "images.pdf")
    r = PdfReader(p)
    check("jpg→pdf: 4 pages", len(r.pages) == 4, len(r.pages))
    sizes = [(round(float(pg.mediabox.width)), round(float(pg.mediabox.height))) for pg in r.pages]
    check("jpg→pdf: page 1 (EXIF-rotated phone photo) is portrait A4", sizes[0] == (595, 842), sizes)
    check("jpg→pdf: page 2 (landscape photo) is landscape A4", sizes[1] == (842, 595), sizes)
    check("jpg→pdf: page 3 (portrait photo rotated right) became landscape", sizes[2] == (842, 595), sizes)
    img = render_first_page(p, 40)
    w, h = img.size
    right = img.getpixel((w - 30, h // 2)); top = img.getpixel((w // 2, 62)); left = img.getpixel((30, h // 2))
    # exif6: the red bar (stored top) must end up on the right after a 90° clockwise display rotation
    check("jpg→pdf: EXIF orientation applied (red edge is on the right, not the top or left)", right[0] > 150 and right[1] < 80 and top[1] > 200 and left[1] > 200, (right, top, left))
    raw = next(iter(r.pages[1]["/Resources"]["/XObject"].values())).get_object()._data  # the stream exactly as stored in the PDF
    check("jpg→pdf: JPEG embedded without re-compression (bytes identical)", raw == open(fx("photo2.jpg")[0], "rb").read())
    no_console_errors(page, "jpg→pdf")
    page.close()


def t_merge(b):
    page = open_page(b, "/image-pdf/merge-pdf")
    page.set_input_files("input.dropzone__input", fx("doc_a.pdf", "doc_b.pdf", "fake.pdf"))
    page.wait_for_selector(".file-row--error", timeout=30000)
    poll(lambda: body_has(page, "3 pages", "2 pages"), 30)
    check("merge: page counts shown; fake PDF flagged", "isn't a PDF" in page.locator(".file-row--error").inner_text())
    page.locator("button[aria-label='Remove fake.pdf']").click()
    page.locator("button[aria-label='Move doc_b.pdf up']").click()
    poll(lambda: body_has(page, "5 pages in total"), 30)
    page.click("button:has-text('Merge 2 PDFs')")
    page.wait_for_selector("button:has-text('Download merged PDF')", timeout=60000)
    p = save_download(page, lambda: page.locator("button:has-text('Download merged PDF')").click(), "merged.pdf")
    r = PdfReader(p)
    txt = list(dict.fromkeys(re.findall(r"\b[AB]-\d\b", pdf_text(p))))  # the order in which the page headings appear
    check("merge: 5 pages in the chosen order (B first)", len(r.pages) == 5 and txt == ["B-1", "B-2", "A-1", "A-2", "A-3"], (len(r.pages), txt))
    page.close()

    page = open_page(b, "/image-pdf/merge-pdf")
    page.set_input_files("input.dropzone__input", fx("locked.pdf", "doc_b.pdf"))
    page.wait_for_selector("input[type=password]", timeout=30000)
    page.fill("input[type=password]", "wrong"); page.click("button:has-text('Unlock')")
    page.wait_for_selector("text=didn't open the PDF", timeout=15000)
    check("merge: wrong password is rejected, and the password box stays for another try", page.locator("input[type=password]").count() == 1)
    page.fill("input[type=password]", "secret"); page.click("button:has-text('Unlock')")
    poll(lambda: body_has(page, "5 pages in total"), 20)
    page.click("button:has-text('Merge 2 PDFs')")
    page.wait_for_selector("button:has-text('Download merged PDF')", timeout=60000)
    p = save_download(page, lambda: page.locator("button:has-text('Download merged PDF')").click(), "merged_unlocked.pdf")
    r = PdfReader(p)
    check("merge: protected file merged after unlocking; output not encrypted", (not r.is_encrypted) and len(r.pages) == 5 and "A-1" in pdf_text(p), (r.is_encrypted, len(r.pages)))
    no_console_errors(page, "merge")
    page.close()


def t_split(b):
    def go():
        pg = open_page(b, "/image-pdf/split-pdf")
        pg.set_input_files("input.dropzone__input", fx("six.pdf"))
        pg.wait_for_selector("text=6 pages", timeout=30000)
        return pg
    page = go()
    page.fill("#sp-ranges", "2-3, 5")
    page.click("button:has-text('Extract pages')")
    page.wait_for_selector("button:has-text('Download'):visible", timeout=60000)
    p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), "extract.pdf")
    check("split: extract 2-3, 5 → pages P2, P3, P5", order(pdf_text(p)) == ["P-2", "P-3", "P-5"], order(pdf_text(p)))
    page.fill("#sp-ranges", "9"); page.click("button:has-text('Extract pages')")
    page.wait_for_selector(".notice--error", timeout=15000)
    check("split: page past the end gives a clear error", "past the last page" in page.locator(".notice--error").inner_text())
    page.close()
    page = go()
    page.select_option("#sp-mode", "each"); page.click("button:has-text('Split PDF')")
    page.wait_for_selector("button:has-text('Download all (6) as ZIP')", timeout=60000)
    p = save_download(page, lambda: page.locator("button:has-text('Download all (6) as ZIP')").click(), "each.zip")
    z = zipfile.ZipFile(p)
    ok = z.testzip() is None and len(z.namelist()) == 6 and all(len(PdfReader(io.BytesIO(z.read(n))).pages) == 1 for n in z.namelist())
    check("split: every page → valid ZIP of 6 single-page PDFs", ok, z.namelist())
    page.close()
    page = go()
    page.select_option("#sp-mode", "remove"); page.fill("#sp-ranges", "1,6"); page.click("button:has-text('Remove pages')")
    page.wait_for_selector(".file-row__actions button:has-text('Download')", timeout=60000)
    p = save_download(page, lambda: page.locator(".file-row__actions button:has-text('Download')").first.click(), "removed.pdf")
    check("split: remove pages 1 and 6 → P2..P5 remain", order(pdf_text(p)) == ["P-2", "P-3", "P-4", "P-5"], order(pdf_text(p)))
    page.close()
    page = go()
    page.select_option("#sp-mode", "every"); page.fill("#sp-n", "4"); page.click("button:has-text('Split PDF')")
    page.wait_for_selector("button:has-text('Download all (2) as ZIP')", timeout=60000)
    p = save_download(page, lambda: page.locator("button:has-text('Download all (2) as ZIP')").click(), "every4.zip")
    z = zipfile.ZipFile(p)
    counts = sorted(len(PdfReader(io.BytesIO(z.read(n))).pages) for n in z.namelist())
    check("split: every 4 pages of 6 → parts of 4 and 2 pages", counts == [2, 4], counts)
    no_console_errors(page, "split")
    page.close()


def t_pdf_compress(b):
    orig = os.path.getsize(fx("photo.pdf")[0])
    page = open_page(b, "/image-pdf/pdf-compressor")
    page.set_input_files("input.dropzone__input", fx("photo.pdf"))
    page.wait_for_selector("text=2 pages", timeout=30000)
    page.click("button:has-text('Compress PDF')")
    page.wait_for_selector(".photo-result .stat-list", timeout=120000)
    p = save_download(page, lambda: page.locator("button:has-text('Download compressed PDF')").click(), "compressed.pdf")
    size = os.path.getsize(p)
    r = PdfReader(p)
    check("pdf compress (keep text): file is much smaller", size < orig * 0.6, (orig, size))
    check("pdf compress (keep text): 2 pages, text still selectable", len(r.pages) == 2 and "Scan page 1" in pdf_text(p), pdf_text(p)[:60])
    img = render_first_page(p, 30)
    extrema = img.convert("L").getextrema()
    check("pdf compress (keep text): page still renders (not blank)", extrema[1] - extrema[0] > 60, extrema)
    page.close()

    page = open_page(b, "/image-pdf/pdf-compressor")
    page.set_input_files("input.dropzone__input", fx("photo.pdf"))
    page.wait_for_selector("text=2 pages", timeout=30000)
    page.select_option("#pc-method", "pages"); page.fill("#pc-target", "200")
    page.click("button:has-text('Compress PDF')")
    page.wait_for_selector(".photo-result .stat-list", timeout=180000)
    p = save_download(page, lambda: page.locator("button:has-text('Download compressed PDF')").click(), "maximum.pdf")
    size = os.path.getsize(p)
    check("pdf compress (maximum + 200 KB target): file ≤ 200,000 bytes", size <= 200000, size)
    check("pdf compress (maximum): 2 pages and not selectable text (honest trade-off)", len(PdfReader(p).pages) == 2 and "Scan page" not in pdf_text(p))
    check("pdf compress (maximum): pages still render", render_first_page(p).convert("L").getextrema()[1] > 150)
    no_console_errors(page, "pdf compress")
    page.close()

    page = open_page(b, "/image-pdf/pdf-compressor")
    page.set_input_files("input.dropzone__input", fx("textonly.pdf"))
    page.wait_for_selector("text=20 pages", timeout=30000)
    page.click("button:has-text('Compress PDF')")
    page.wait_for_selector(".photo-result .stat-list", timeout=120000)
    txt = page.locator(".photo-result").inner_text()
    check("pdf compress: text-only PDF reports that there were no pictures and only a small structural saving",
          "no embedded pictures" in txt and "No pictures were compressed" in txt, txt[:200])
    p = save_download(page, lambda: page.locator("button:has-text('Download compressed PDF')").click(), "textonly_out.pdf")
    check("pdf compress: text-only output still has all 20 pages and its text", len(PdfReader(p).pages) == 20 and "T-20" in pdf_text(p))
    page.close()


def t_qr(b):
    page = open_page(b, "/image-pdf/wifi-qr-code-generator")
    page.fill("#qr-ssid", "Cafe;Net"); page.fill("#qr-wpw", 'pa:ss,w"rd1')
    page.wait_for_selector(".qr-out__img img")
    p = save_download(page, lambda: page.locator("button:has-text('PNG')").click(), "wifi.png")
    check("wifi QR: decodes to the exact Wi-Fi payload (special characters escaped)", decode_qr(p) == 'WIFI:T:WPA;S:Cafe\\;Net;P:pa\\:ss\\,w\\"rd1;;', decode_qr(p))
    page.fill("#qr-wpw", "short")
    page.wait_for_selector(".notice--warn:has-text('at least 8')")
    check("wifi QR: too-short WPA password is flagged", True)
    no_console_errors(page, "wifi QR")
    page.close()

    page = open_page(b, "/image-pdf/upi-qr-code-generator")
    page.fill("#up-vpa", "shop@okbank"); page.fill("#up-name", "Ravi Kumar Store"); page.fill("#up-am", "150.50"); page.fill("#up-note", "Order #12")
    page.wait_for_selector(".qr-out__img img")
    p = save_download(page, lambda: page.locator("button:has-text('PNG')").click(), "upi.png")
    check("UPI QR: decodes to the UPI payment link", decode_qr(p) == "upi://pay?pa=shop@okbank&pn=Ravi%20Kumar%20Store&am=150.50&cu=INR&tn=Order%20%2312", decode_qr(p))
    page.fill("#up-vpa", "bad id")
    page.wait_for_selector(".notice--warn:has-text('UPI ID looks like')")
    check("UPI QR: invalid UPI ID is explained", True)
    page.close()

    page = open_page(b, "/developer/qr-code-generator")
    page.fill("#qr-url", "https://workings-inky.vercel.app/image-pdf/merge-pdf")
    page.wait_for_selector(".qr-out__img img")
    page.locator("details.qr-style summary").click()
    page.fill("#qr-size", "1024") if False else None
    p = save_download(page, lambda: page.locator("button:has-text('PNG')").click(), "url.png")
    check("QR: URL code decodes correctly", decode_qr(p) == "https://workings-inky.vercel.app/image-pdf/merge-pdf", decode_qr(p))
    svg = save_download(page, lambda: page.locator("button:has-text('SVG')").click(), "url.svg")
    s = open(svg).read()
    check("QR: SVG download is well-formed with a path", s.startswith("<svg") and "<path" in s and s.strip().endswith("</svg>"))
    page.fill("#qr-fg", "#dddddd")
    page.wait_for_selector(".notice--warn:has-text('Contrast is low')", timeout=10000)
    check("QR: low-contrast colours trigger a scan warning", True)
    page.fill("#qr-fg", "#000000")
    page.select_option("#qr-kind", "vcard")
    page.fill("#vc-first", "Ada"); page.fill("#vc-last", "Lovelace"); page.fill("#vc-phone", "+91 98765 43210"); page.fill("#vc-email", "ada@example.com")
    page.wait_for_selector(".qr-out__img img")
    p = save_download(page, lambda: page.locator("button:has-text('PNG')").click(), "vcard.png")
    d = decode_qr(p)
    check("QR: vCard code decodes with name, phone and email", "FN:Ada Lovelace" in d and "TEL;TYPE=CELL:+919876543210" in d and "EMAIL:ada@example.com" in d, d)
    no_console_errors(page, "QR")
    page.close()


def t_text_tools(b):
    page = b.new_page(); page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.goto(BASE + "/developer/remove-duplicate-lines", wait_until="networkidle")
    page.wait_for_selector("text=Lines kept", timeout=15000)
    check("text tool: duplicate-line remover shows a live result", "lines kept" in page.inner_text("main").lower())
    page.goto(BASE + "/developer/csv-to-json-converter", wait_until="networkidle")
    page.wait_for_selector("text=Rows converted", timeout=15000)
    check("data tool: CSV → JSON shows a live result", "Ada Lovelace" in page.inner_text("main"))
    page.goto(BASE + "/developer/password-generator", wait_until="networkidle")
    page.click("button:has-text('Generate')")
    page.wait_for_selector("text=Strength", timeout=15000)
    check("password generator: produces a password and a strength estimate", "Strength" in page.inner_text("main"))
    check("text/data tools: no page errors", not page.errors, page.errors)
    page.close()


def t_layout(b):
    paths = ["/", "/image-pdf"] + [f"/image-pdf/{s}" for s in ["image-compressor", "image-resizer", "image-converter", "passport-photo-resizer", "signature-resizer", "jpg-to-pdf", "merge-pdf", "split-pdf", "pdf-compressor", "wifi-qr-code-generator", "upi-qr-code-generator"]] + ["/developer/qr-code-generator", "/developer/remove-duplicate-lines", "/developer/csv-to-json-converter", "/developer/password-generator"]
    bad = []
    for w in (320, 375, 768, 1280):
        ctx = b.new_context(viewport={"width": w, "height": 800})
        pg = ctx.new_page()
        for path in paths:
            pg.goto(BASE + path, wait_until="networkidle")
            pg.wait_for_timeout(300)
            over = pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            if over > 1:
                bad.append((w, path, over))
        ctx.close()
    check("layout: no horizontal overflow on any new page at 320/375/768/1280 px", not bad, bad[:5])


if __name__ == "__main__":
    only = sys.argv[1:]
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for fn in [t_compressor, t_converter, t_resizer, t_photo, t_jpg_to_pdf, t_merge, t_split, t_pdf_compress, t_qr, t_text_tools, t_layout]:
            if only and fn.__name__[2:] not in only:
                continue
            try:
                fn(browser)
            except Exception as e:  # a crashed test is a failed test
                check(f"{fn.__name__} completed without an exception", False, repr(e)[:300])
                traceback.print_exc()
        browser.close()
    failed = [r for r in results if not r[0]]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    sys.exit(1 if failed else 0)
