"""Recorte do fundo do vídeo da yorkshire, quadro a quadro (uso: python matte.py <pasta_entrada> <pasta_saida> [preview] [dark]).

"dark" gera a variante para o tema escuro (borda mais fina e fios da beirada escurecidos).

1. Fundo de estúdio: transparência pela distância até a cor do fundo (rampa suave).
2. Faixa de baixo (patas e chão): some também o que é cinza claro (sombra do chão), mantendo o
   que tem cor (pelo dourado) ou é escuro (pelo azul-aço, sombras do próprio corpo).
3. Manchas soltas no fundo (resquícios de compressão) saem: fica só o que está ligado à cachorra.
4. Borda: alfa afinado 1 px e suavizado; cor de cada pixel recalculada sem o fundo claro que estava
   misturado nela (tira a franja branca).
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

BG = np.array([0.885, 0.905, 0.935])


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def shift_min(a):
    p = np.pad(a, 1, mode="edge")
    h, w = a.shape
    return np.min([p[dy : dy + h, dx : dx + w] for dy in range(3) for dx in range(3)], axis=0)


def box(a):
    p = np.pad(a, 1, mode="edge")
    h, w = a.shape
    return np.mean([p[dy : dy + h, dx : dx + w] for dy in range(3) for dx in range(3)], axis=0)


def main_blob(a, k=4):
    """Máscara só da mancha ligada ao centro da cachorra (descarta manchas soltas no fundo)."""
    h, w = a.shape
    hh, ww = h // k, w // k
    small = a[: hh * k, : ww * k].reshape(hh, k, ww, k).max(axis=(1, 3)) > 0.3
    seen = np.zeros_like(small)
    sy, sx = int(hh * 0.62), ww // 2
    if not small[sy, sx]:
        ys, xs = np.nonzero(small)
        if len(ys) == 0:
            return np.ones_like(a)
        i = np.argmin((ys - sy) ** 2 + (xs - sx) ** 2)
        sy, sx = ys[i], xs[i]
    q = deque([(sy, sx)])
    seen[sy, sx] = True
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < hh and 0 <= nx < ww and small[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    p = np.pad(seen, 1)
    grown = np.max([p[dy : dy + hh, dx : dx + ww] for dy in range(3) for dx in range(3)], axis=0)
    full = np.zeros_like(a)
    full[: hh * k, : ww * k] = np.repeat(np.repeat(grown, k, axis=0), k, axis=1)
    return full


DARK = False


def matte(img):
    c = np.asarray(img.convert("RGB"), dtype=np.float64) / 255
    h, w, _ = c.shape
    d = np.linalg.norm(c - BG, axis=2)
    a = smooth(0.055, 0.15, d)

    mx = c.max(axis=2)
    mn = c.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    lum = c.mean(axis=2)
    keep = np.maximum(smooth(0.12, 0.22, sat), 1 - smooth(0.30, 0.44, lum))
    # Fundo mais claro que a referência (entre pelos do rabo, cantos): muito claro e sem cor sai também.
    bright = smooth(0.74, 0.82, lum) * (1 - smooth(0.06, 0.11, sat))
    a = a * (1 - bright)
    y = np.linspace(0, 1, h)[:, None]
    weight = smooth(0.80, 0.87, y)
    a = a * (1 - weight * (1 - keep))

    blob = main_blob(a)
    if DARK:
        # Tema escuro: borda 2 px mais fina e semitransparentes mais transparentes (a franja clara
        # dos pelos finos some sobre o fundo escuro).
        a = box(shift_min(shift_min(a))) * blob
        a = a**1.6
    else:
        a = box(shift_min(a)) * blob
    a = np.where(a < 0.03, 0, a)

    f = (c - (1 - a)[..., None] * BG) / np.maximum(a, 0.05)[..., None]
    f = np.clip(f, 0, 1)
    if DARK:
        # Fios da beirada escurecidos: o que restar de fundo branco misturado não brilha no escuro.
        f = f * (0.45 + 0.55 * a)[..., None]
    f[a == 0] = 0  # pixels invisíveis com cor lisa: o vídeo comprime muito melhor
    rgba = np.dstack([f, a])
    return Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")


def main():
    global DARK
    DARK = "dark" in sys.argv[3:]
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    files = sorted(src.glob("*.png"))
    for i, fp in enumerate(files):
        matte(Image.open(fp)).save(dst / fp.name)
        if (i + 1) % 20 == 0:
            print(f"{i + 1}/{len(files)}", flush=True)
    if "preview" in sys.argv[3:]:  # prévia sobre escuro, cinza-médio e claro
        for fp in files:
            m = Image.open(dst / fp.name)
            for name, col in {"dark": (15, 25, 40), "mid": (122, 122, 120), "light": (242, 237, 228)}.items():
                bg = Image.new("RGBA", m.size, col + (255,))
                bg.alpha_composite(m)
                bg.convert("RGB").save(dst / f"prev-{fp.stem}-{name}.png")


if __name__ == "__main__":
    main()
