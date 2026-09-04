# Pure-Python ikoon-generator vir Spoedmeter (geen Pillow nodig nie)
# Teken: donker agtergrond + amber spoedmeter-ring + naald.
import struct, zlib, math, os

def smooth(edge, x):
    # 1 waar x < edge-1, 0 waar x > edge+1
    d = x - edge
    if d <= -1: return 1.0
    if d >= 1: return 0.0
    return 0.5 - d / 2

def make_icon(size):
    px = bytearray()
    C = (size - 1) / 2
    bg = (11, 14, 20)          # #0b0e14
    panel = (19, 26, 38)       # #131a26
    amber = (255, 213, 74)     # #ffd54a
    white = (234, 242, 255)    # #eaf2ff
    Ro, Ri = 0.415 * size, 0.345 * size
    needle_len = 0.30 * size
    needle_w = 0.024 * size
    hub_r = 0.075 * size
    for y in range(size):
        for x in range(size):
            dx, dy = x - C, y - C
            r = math.hypot(dx, dy)
            # hoek vanaf "bo" (12-uur), kloksgewys positief
            phi = math.degrees(math.atan2(dx, -dy))   # -180..180
            col = bg
            # binne-sirkel paneel
            a = smooth(Ro + 1, r) * smooth(r, Ri - 14) * 0  # nie gebruik nie
            if r <= Ri - 2:
                col = panel
            # ring: 240° boog van -120..120
            if Ri <= r <= Ro and abs(phi) <= 120.5:
                aa = smooth(Ro, r) * smooth(r, Ri) * min(1.0, max(0.0, (120.5 - abs(phi)) * 4))
                col = tuple(int(col[i] + (amber[i] - col[i]) * aa) for i in range(3))
            # naald (op 0° = bo)
            elif r <= needle_len:
                # afstand na die lyn x=0 (vertikaal) — naald wys bo
                if abs(dx) <= needle_w and phi > -95 and phi < 95:
                    edge = smooth(needle_w, abs(dx))
                    col = tuple(int(col[i] + (white[i] - col[i]) * edge) for i in range(3))
            # naald-puntjie bo
            # hub
            if r <= hub_r:
                col = amber
            px.extend(col + (255,))
    # PNG enkodering
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(px[y * stride:(y + 1) * stride])
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    return png

os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons'), exist_ok=True)
outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    with open(os.path.join(outdir, name), 'wb') as f:
        f.write(make_icon(size))
    print('geskryf', name, size)
