"""Bake the pack's looping wave fan. Frame zero and frame 32 share a phase."""
from pathlib import Path

import numpy as np
from PIL import Image


WIDTH, HEIGHT = 384, 192
COLUMNS, ROWS = 8, 4
PALETTE = np.array([
    [238, 42, 113], [243, 132, 70], [249, 214, 87], [96, 235, 163],
    [93, 184, 249], [140, 97, 247], [240, 72, 197],
]) / 255


def frame(phase):
    y, x = np.mgrid[0:HEIGHT, 0:WIDTH]
    rise = 1 - (y + 0.5) / HEIGHT
    # The mouth occupies 1/2.1 of the image. Perspective spreads the same
    # continuous stripes towards the top rather than adding new colours there.
    spread = 1 + 1.08 * rise
    across = ((x + 0.5) / WIDTH - 0.5 + 0.025 * rise) * 2.1 / spread
    wave = 2 * np.pi * (2.5 * rise - phase)
    across += (0.006 + 0.008 * rise) * np.sin(wave + across * 4)
    across += 0.003 * np.sin(wave * 2 - across * 3)
    stripe = (across + 0.5) * 23
    # A subpixel blend antialiases each boundary without blurring the inks.
    edge = 0.055 / spread
    index = np.floor(stripe - edge).astype(int)
    mix = np.clip((stripe - index - 1 + edge) / (2 * edge), 0, 1)[..., None]
    rgb = PALETTE[index % 7] * (1 - mix) + PALETTE[(index + 1) % 7] * mix
    rgb += (1 - rgb) * (0.40 * np.exp(-rise * 22))[..., None]
    sides = np.clip((0.5 - abs(across)) * WIDTH * spread / 2.1 + 0.5, 0, 1)
    top = np.clip((y + 0.5 - 0.12 * x * HEIGHT / WIDTH) + 0.5, 0, 1)
    return Image.fromarray(np.uint8(np.dstack((rgb, sides * top)) * 255 + 0.5))


if __name__ == '__main__':
    atlas = Image.new('RGBA', (WIDTH * COLUMNS, HEIGHT * ROWS))
    for index in range(COLUMNS * ROWS):
        atlas.paste(frame(index / (COLUMNS * ROWS)), (index % COLUMNS * WIDTH, index // COLUMNS * HEIGHT))
    asset = Path(__file__).resolve().parents[1] / 'public/art/seam-spectrum.webp'
    atlas.save(asset, lossless=True, method=4)
