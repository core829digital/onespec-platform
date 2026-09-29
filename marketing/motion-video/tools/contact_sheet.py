import json, sys
from PIL import Image, ImageDraw, ImageFont
items = json.load(open(sys.argv[1]))
TW, COLS = 300, 8
rows = (len(items) + COLS - 1) // COLS
LH = 22
sheet = Image.new("RGB", (COLS * TW, rows * (TW + LH)), "#1d1d1f")
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except OSError:
    font = ImageFont.load_default()
for i, it in enumerate(items):
    im = Image.open(it["file"]).convert("RGB").resize((TW, TW), Image.LANCZOS)
    x, y = (i % COLS) * TW, (i // COLS) * (TW + LH)
    sheet.paste(im, (x, y + LH))
    d.text((x + 6, y + 4), it["label"], fill="#16d19d", font=font)
sheet.save(sys.argv[2])
print("contact sheet:", sys.argv[2], sheet.size)
