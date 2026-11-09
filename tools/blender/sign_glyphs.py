"""The title's own letters, drawn for the sign: no font. Plain Python, build_sign.py turns them into meshes.

Outlines are in cap heights: a letter stands from y = 0 to y = 1, x = 0 is its left edge. Depths are in meters,
from the back of the plate. Each glyph is a width and a list of steps run in order. ('add', outline) welds plate
on, ('cut', outline) cuts it away. A step can name its own mesh and depth: the wrench Y, the hammer I and the
nut O are tools, thicker than the plate letters. An outline is a list of (x, y) points, or a list of
(outline, z) rings for a shape that tapers, like the nut.
"""
import math

STEM = 0.22    # upright strokes
BAR = 0.19     # crossing strokes, a little thinner so they look as heavy
CUT = 0.16     # torch-cut corners outside
NICK = 0.07    # and inside
SLANT = 0.27   # width of a slanted stroke, measured across


def box(x0, y0, x1, y1, bl=0, br=0, tr=0, tl=0):
    """A rectangle, each corner cut off by its own amount."""
    points = [(x0, y0 + bl), (x0 + bl, y0)] if bl else [(x0, y0)]
    points += [(x1 - br, y0), (x1, y0 + br)] if br else [(x1, y0)]
    points += [(x1, y1 - tr), (x1 - tr, y1)] if tr else [(x1, y1)]
    points += [(x0 + tl, y1), (x0, y1 - tl)] if tl else [(x0, y1)]
    return points


def slant(p, q, width=SLANT):
    """A stroke from p to q with level ends, width measured along the ends."""
    half = width / 2
    return [(p[0] - half, p[1]), (p[0] + half, p[1]), (q[0] + half, q[1]), (q[0] - half, q[1])]


def circle(center, radius, sides=24, start=0.0):
    return [(center[0] + radius * math.cos(start + 2 * math.pi * n / sides),
             center[1] + radius * math.sin(start + 2 * math.pi * n / sides)) for n in range(sides)]


def turn(points, center, degrees):
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    return [(center[0] + (x - center[0]) * c - (y - center[1]) * s,
             center[1] + (x - center[0]) * s + (y - center[1]) * c) for x, y in points]


def hole(center, radius, rng, sides=11):
    """A bullet hole: torn, not drilled. Radii wander, so no two holes match."""
    return [(center[0] + radius * rng.uniform(0.8, 1.15) * math.cos(2 * math.pi * n / sides),
             center[1] + radius * rng.uniform(0.8, 1.15) * math.sin(2 * math.pi * n / sides)) for n in range(sides)]


def bite(center, radius, rng, teeth=9, sides=54):
    """A bite out of an edge: a rough half moon with a tooth mark every few degrees."""
    points = []
    phase = rng.uniform(0, math.pi)
    for n in range(sides):
        a = 2 * math.pi * n / sides
        tooth = max(0.0, math.cos(teeth * a + phase)) ** 6
        r = radius * (0.92 + 0.16 * tooth + rng.uniform(-0.03, 0.03))
        points.append((center[0] + r * math.cos(a), center[1] + r * math.sin(a)))
    return points


def wrench():
    """Y: an open-end wrench standing on its handle, the jaw opening up. The head is set at 15 degrees, like a real one."""
    x = 0.31
    head = (x, 0.71)
    jaw = turn(box(x - 0.115, 0.70, x + 0.115, 1.4), head, 15)
    throat = turn(circle((x, 0.70), 0.115, 16), head, 15)
    handle = [(x - 0.09, 0.0), (x + 0.09, 0.0), (x + 0.11, 0.05), (x + 0.125, 0.56), (x - 0.125, 0.56), (x - 0.11, 0.05)]
    return 0.62, [
        ('add', handle, 'Tools', 0.1),
        ('add', circle(head, 0.3, 28), 'Tools', 0.1),
        ('cut', jaw, 'Tools'),
        ('cut', throat, 'Tools'),
        ('cut', circle((x, 0.11), 0.036, 12), 'Tools')
    ]


def hammer():
    """I: a claw hammer standing on its handle, the head across the top. A rubber grip on the lower half."""
    x = 0.3
    handle = [(x - 0.09, 0.0), (x + 0.09, 0.0), (x + 0.09, 0.05), (x + 0.07, 0.1), (x + 0.06, 0.8), (x - 0.06, 0.8),
              (x - 0.07, 0.1), (x - 0.09, 0.05)]
    claw = [(0.4, 0.99), (0.5, 0.97), (0.58, 0.92), (0.64, 0.85), (0.68, 0.76), (0.63, 0.78), (0.56, 0.82), (0.48, 0.83),
            (0.4, 0.8)]
    return 0.7, [
        ('add', handle, 'Tools', 0.1),
        ('add', box(0.0, 0.75, 0.13, 1.0, bl=0.025, tl=0.025), 'Tools', 0.17),
        ('add', box(0.1, 0.79, 0.22, 0.96), 'Tools', 0.15),
        ('add', box(0.2, 0.74, 0.41, 1.0, tr=0.02), 'Tools', 0.17),
        ('add', claw, 'Tools', 0.13),
        ('add', box(x - 0.085, 0.07, x + 0.085, 0.43, bl=0.02, br=0.02, tr=0.02, tl=0.02), 'Grip', 0.13)
    ]


def nut():
    """O: a hex nut face on, flats at top and bottom. Its outer edge is chamfered and the bore countersunk."""
    radius = 0.46 / math.sin(math.pi / 3)
    center = (radius, 0.5)
    hexagon = lambda r: circle(center, r, 6)
    rings = [(hexagon(radius), 0.0), (hexagon(radius), 0.15), (hexagon(radius * 0.9), 0.2)]
    bore = [(circle(center, 0.24, 28), -1.0), (circle(center, 0.24, 28), 0.17), (circle(center, 0.29, 28), 0.21)]
    return 2 * radius, [
        ('add', rings, 'Tools'),
        ('cut', bore, 'Tools')
    ]


def letters():
    m = 0.42  # where the middle bar of S starts
    return {
        'S': (0.6, [
            ('add', box(0, 0, 0.6, BAR, br=CUT)),
            ('add', box(0, 0, STEM, BAR + 0.1)),
            ('add', box(0.6 - STEM, 0, 0.6, m + BAR, br=CUT, tr=CUT)),
            ('add', box(0, m, 0.6, m + BAR, bl=CUT, tr=CUT)),
            ('add', box(0, m, STEM, 1, bl=CUT, tl=CUT)),
            ('add', box(0, 1 - BAR, 0.6, 1, tl=CUT)),
            ('add', box(0.6 - STEM, 0.9 - BAR, 0.6, 1))
        ]),
        'C': (0.58, [
            ('add', box(0, 0, 0.58, 1, bl=CUT, tl=CUT)),
            ('cut', box(STEM, BAR, 0.7, 1 - BAR, bl=NICK, tl=NICK))
        ]),
        'R': (0.64, [
            ('add', box(0, 0, STEM, 1)),
            ('add', box(0, 0.4, 0.64, 1, tr=0.2, br=0.14)),
            ('cut', box(STEM, 0.4 + BAR, 0.64 - STEM, 1 - BAR, tr=NICK, br=NICK)),
            ('add', slant((0.64 - SLANT / 2, 0), (0.38, 0.4)))
        ]),
        'A': (0.7, [
            ('add', box(0, 0, 0.7, 1, tl=0.3, tr=0.3)),
            ('cut', box(STEM, 0.5, 0.7 - STEM, 0.76, tl=0.12, tr=0.12)),
            ('cut', box(STEM, -0.1, 0.7 - STEM, 0.31))
        ]),
        'P': (0.62, [
            ('add', box(0, 0, STEM, 1)),
            ('add', box(0, 0.38, 0.62, 1, tr=0.2, br=0.2)),
            ('cut', box(STEM, 0.38 + BAR, 0.62 - STEM, 1 - BAR, tr=NICK, br=NICK))
        ]),
        'D': (0.64, [
            ('add', box(0, 0, 0.64, 1, tr=0.24, br=0.24)),
            ('cut', box(STEM, BAR, 0.64 - STEM, 1 - BAR, tr=0.1, br=0.1))
        ]),
        'K': (0.64, [
            ('add', box(0, 0, STEM, 1)),
            ('add', slant((0.3, 0.3), (0.64 - SLANT / 2, 1))),
            ('add', slant((0.36, 0.52), (0.64 - SLANT / 2, 0)))
        ]),
        'N': (0.66, [
            ('add', box(0, 0, STEM, 1)),
            ('add', box(0.66 - STEM, 0, 0.66, 1)),
            ('add', slant((0.66 - SLANT / 2, 0), (SLANT / 2, 1)))
        ]),
        'G': (0.64, [
            ('add', box(0, 0, 0.64, 1, bl=CUT, tl=CUT, br=CUT)),
            ('cut', box(STEM, BAR, 0.64 - STEM, 1 - BAR, bl=NICK, tl=NICK)),
            ('cut', box(0.63 - STEM, 0.56, 0.8, 1 - BAR)),
            ('add', box(0.32, 0.38, 0.64, 0.38 + BAR))
        ]),
        'M': (0.84, [
            ('add', box(0, 0, STEM, 1)),
            ('add', box(0.84 - STEM, 0, 0.84, 1)),
            ('add', slant((0.42, 0.28), (SLANT / 2, 1))),
            ('add', slant((0.42, 0.28), (0.84 - SLANT / 2, 1)))
        ]),
        'Y': wrench(),
        'I': hammer(),
        'O': nut()
    }


GLYPHS = letters()
