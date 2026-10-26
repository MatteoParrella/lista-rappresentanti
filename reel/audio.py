"""Colonna sonora sintetizzata del reel: beat a 130 bpm + effetti sincronizzati
con le animazioni di reel.html. Uso: python3 audio.py out.wav"""
import sys
import wave
import numpy as np

SR = 48000
DURATA = 19.0
BATT = 0.4615          # ~130 bpm, uguale a reel.html
BOTTO = 16.05          # il drop su VAMORAGA
rng = np.random.default_rng(3)
L = np.zeros(int(SR * DURATA))
R = np.zeros_like(L)


def t_arr(d):
    return np.arange(int(SR * d)) / SR


def metti(x, t, vol=1.0, pan=0.0):
    i = int(t * SR)
    if i >= len(L):
        return
    x = x[: len(L) - i] * vol
    L[i:i + len(x)] += x * (1 - max(pan, 0))
    R[i:i + len(x)] += x * (1 + min(pan, 0))


def passabasso(x, a):
    # filtro a un polo, a in (0,1): più basso = più scuro
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def kick(d=0.45, f0=150, f1=42):
    t = t_arr(d)
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    fase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(fase) * np.exp(-t * 7) + 0.3 * np.sin(fase) * np.exp(-t * 40)


def hat(d=0.06):
    t = t_arr(d)
    n = rng.standard_normal(len(t))
    n = n - passabasso(n, 0.5)
    return n * np.exp(-t * 70) * 0.5


def clap(d=0.25):
    t = t_arr(d)
    n = rng.standard_normal(len(t))
    n = n - passabasso(n, 0.15)
    env = np.exp(-t * 18) + 0.6 * np.exp(-((t - 0.012) ** 2) / 1e-5) + 0.5 * np.exp(-((t - 0.024) ** 2) / 1e-5)
    return n * env * 0.5


def basso(freq, d):
    t = t_arr(d)
    saw = 2 * ((t * freq) % 1) - 1
    x = passabasso(saw, 0.06) * 1.6 + 0.5 * np.sin(2 * np.pi * freq * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 3.5)
    return x * env


def whoosh(d=0.5, su=True):
    t = t_arr(d)
    n = rng.standard_normal(len(t))
    a = np.linspace(0.02, 0.35, len(t)) if su else np.linspace(0.35, 0.02, len(t))
    y = np.empty_like(n)
    acc = 0.0
    for i, v in enumerate(n):
        acc += a[i] * (v - acc)
        y[i] = acc
    env = np.sin(np.pi * t / d) ** 2
    return y * env * 2.2


def boom(d=1.2):
    t = t_arr(d)
    f = 30 + 110 * np.exp(-t * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3)
    n = passabasso(rng.standard_normal(len(t)), 0.08) * np.exp(-t * 6) * 1.5
    return s + n


def pop(f=900, d=0.12):
    t = t_arr(d)
    ff = f * (1 + 0.8 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t * 35)


def click(d=0.03):
    t = t_arr(d)
    n = rng.standard_normal(len(t))
    return (n - passabasso(n, 0.3)) * np.exp(-t * 200)


def ding(d=0.9):
    t = t_arr(d)
    x = sum(np.sin(2 * np.pi * f * t) * a for f, a in [(1318.5, 1), (1975.5, 0.5), (2637, 0.25)])
    return x * np.exp(-t * 5) * np.minimum(1, t / 0.003)


def riser(d):
    t = t_arr(d)
    f = 200 * (2 ** (t / d * 3))
    tono = np.sin(2 * np.pi * np.cumsum(f) / SR)
    n = rng.standard_normal(len(t))
    n = n - passabasso(n, 0.2)
    return (tono * 0.4 + n * 0.5) * (t / d) ** 2


# ---------- beat ----------
inizio_griglia = BOTTO - 34 * BATT  # così il drop cade esattamente su un battito
note = [55.0, 55.0, 65.41, 49.0]    # La, La, Do, Sol (bassi)
b = 0
while True:
    tb = inizio_griglia + b * BATT
    if tb >= DURATA:
        break
    if tb >= 0:
        prima_drop = tb < BOTTO
        pausa = BOTTO - 0.95 < tb < BOTTO       # silenzio prima del drop
        intro = tb < 2.3
        if not pausa:
            metti(kick(), tb, 0.55 if prima_drop else 0.8)
            if not intro:
                metti(hat(), tb + BATT / 2, 0.22 if prima_drop else 0.3, pan=0.3)
                metti(basso(note[(b // 4) % 4], BATT * 0.9), tb, 0.22 if prima_drop else 0.32)
            if b % 2 == 1 and not intro:
                metti(clap(), tb, 0.35 if prima_drop else 0.5, pan=-0.15)
        if not prima_drop:
            metti(hat(), tb + BATT / 4, 0.12, pan=-0.3)
            metti(hat(), tb + 3 * BATT / 4, 0.12, pan=0.3)
    b += 1

# ---------- effetti sincronizzati con reel.html ----------
metti(boom(1.0), 0.05, 0.5)                       # logo che atterra
for i in range(9):                                 # lettere di CAPOLISTA
    metti(pop(500 + i * 60, 0.08), 0.42 + i * 0.045, 0.18, pan=(i - 4) / 6)
metti(whoosh(0.5), 1.85, 0.5)                       # zoom attraverso il logo
for i, ts in enumerate([2.3, 3.1, 3.9]):           # domande a raffica
    metti(boom(0.7), ts + 0.15, 0.55)
    metti(whoosh(0.25, su=False), ts - 0.05, 0.3)
for ts in [4.75, 7.6, 11.0, 13.1, 15.2]:           # swipe bianchi
    metti(whoosh(0.5), ts - 0.25, 0.55)
for i in range(5):                                 # bolle dei messaggi
    metti(pop(700 + (i % 2) * 250), 5.2 + i * 0.32, 0.4, pan=-0.4 if i % 2 == 0 else 0.4)
metti(whoosh(0.45), 7.15, 0.35)                      # bolle che volano via
metti(whoosh(0.6), 7.75, 0.35)                       # telefono che entra
for ts in np.concatenate([np.arange(8.75, 9.3, 0.055), np.arange(9.4, 10.0, 0.045)]):
    metti(click(), ts + rng.uniform(-0.01, 0.01), 0.35, pan=rng.uniform(-0.3, 0.3))  # digitazione
metti(click(0.05), 8.6, 0.5)
metti(pop(300, 0.1), 10.22, 0.5)                    # tap su INVIA
metti(ding(), 10.36, 0.3)                           # richiesta inviata
metti(click(0.05), 11.6, 0.9)                       # lucchetto che si chiude
metti(pop(200, 0.08), 11.6, 0.5)
metti(boom(1.0), 11.86, 0.7)                        # timbro 100% ANONIMO
for i in range(3):
    metti(pop(1000 + i * 120, 0.07), 12.1 + i * 0.16, 0.15)
for i in range(4):                                 # VOI SCRIVETE NOI AGIAMO
    metti(whoosh(0.28, su=False), 13.18 + i * 0.22, 0.4, pan=-0.5 if i % 2 == 0 else 0.5)
metti(pop(600, 0.15), 14.12, 0.45)                  # link
metti(riser(BOTTO - 15.2), 15.2, 0.45)              # salita verso il drop
for i in range(8):                                 # lettere di VAMORAGA
    metti(pop(400 + i * 90, 0.1), 15.38 + i * 0.08, 0.3, pan=(i - 3.5) / 5)
metti(boom(1.6), BOTTO, 1.0)                        # il botto
n = rng.standard_normal(int(SR * 1.2))             # coriandoli: crepitio
metti((n - passabasso(n, 0.4)) * np.exp(-np.arange(len(n)) / SR * 2.5) * (rng.random(len(n)) > 0.985), BOTTO + 0.05, 0.6)

# dissolvenza finale e normalizzazione
fade = np.ones_like(L)
nf = int(SR * 0.6)
fade[-nf:] = np.linspace(1, 0, nf)
st = np.stack([L * fade, R * fade], axis=1)
st = np.tanh(st * 1.3)  # un filo di saturazione per compattare
st = st / np.max(np.abs(st)) * 0.89
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
