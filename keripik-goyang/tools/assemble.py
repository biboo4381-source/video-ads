"""Assemble the final ad: concat rendered shots, synthesize music + SFX, mix with the
voiceover, burn word-by-word captions, export 1080x1920 H.264/AAC.

usage: python3 tools/assemble.py [--preview]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
OUT = ROOT / "out"
SR = 48000
BEAT = 0.46  # seconds per beat (~130 BPM) — same spacing as the "Kriuk!" hits
rng = np.random.default_rng(7)


def run(cmd):
    print("+", " ".join(str(c) for c in cmd[:6]), "...")
    subprocess.run([str(c) for c in cmd], check=True)


# ---------------------------------------------------------------- synth helpers
def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def kick():
    n = int(0.32 * SR)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_exp(n, 0.09) * 0.9


def noise_hit(dur, tau, hp=True):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    if hp:
        x = np.diff(x, prepend=0)
    return x * env_exp(n, tau)


def clap():
    x = np.zeros(int(0.2 * SR))
    for k, d in enumerate([0, 0.011, 0.022]):
        h = noise_hit(0.17, 0.035 if k == 2 else 0.008) * 0.35
        o = int(d * SR)
        x[o:o + len(h)] += h[: len(x) - o]
    return x


def hat(open_=False):
    x = noise_hit(0.12 if open_ else 0.05, 0.03 if open_ else 0.01)
    return np.diff(x, prepend=0) * 0.18


def tone(freq, dur, kind="marimba", amp=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == "marimba":
        y = np.sin(2 * np.pi * freq * t) * env_exp(n, 0.28) + 0.35 * np.sin(2 * np.pi * freq * 3.98 * t) * env_exp(n, 0.04)
    elif kind == "bass":
        y = sum(np.sin(2 * np.pi * freq * k * t) / k ** 1.4 for k in range(1, 6)) * env_exp(n, 0.22)
    elif kind == "pad":
        y = sum(np.sin(2 * np.pi * freq * k * t + k) / k ** 2 for k in range(1, 4))
        a = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.4)
        y = y * a
    else:
        y = np.sin(2 * np.pi * freq * t)
    atk = np.minimum(1, t / 0.004)
    return y * atk * amp


def place(buf, clip, t, gain=1.0):
    o = int(t * SR)
    if o >= len(buf) or o + len(clip) <= 0:
        return
    s = max(0, -o)
    e = min(len(clip), len(buf) - o)
    buf[o + s:o + e] += clip[s:e] * gain


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


# chord progression C - Am - F - G (1 bar = 4 beats)
CHORDS = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])]
MELODY = [72, None, 74, 76, None, 79, 76, None, 74, None, 72, 74, 76, None, 72, None]  # 8th notes over 2 bars


def groove(buf, t0, t1, *, drums=True, bass=True, keys=True, melody=False, hats=True, gain=1.0):
    step = BEAT / 2
    i = 0
    t = t0
    while t < t1 - 1e-6:
        bar = int(i // 8)
        root, chord = CHORDS[bar % 4]
        pos = i % 8  # 8th-note position within bar
        if drums:
            if pos in (0, 4) or (pos == 6 and bar % 2):
                place(buf, kick(), t, 0.8 * gain)
            if pos in (2, 6):
                place(buf, clap(), t, 0.55 * gain)
        if hats:
            place(buf, hat(open_=(pos % 2 == 1 and pos == 7)), t, (0.5 if pos % 2 else 0.3) * gain)
        if bass and pos in (0, 3, 4, 6):
            place(buf, tone(midi(root if pos != 6 else root + 7), step * 1.6, "bass", 0.32), t, gain)
        if keys and pos in (1, 5):
            for k, m in enumerate(chord):
                place(buf, tone(midi(m), 0.6, "marimba", 0.14), t + k * 0.012, gain)
        if melody:
            m = MELODY[i % 16]
            if m:
                place(buf, tone(midi(m), 0.5, "marimba", 0.2), t, gain)
        t += step
        i += 1


def crunch():
    """A crunchy chip bite: a cluster of short bright crackles."""
    n = int(0.26 * SR)
    x = np.zeros(n)
    for _ in range(26):
        o = int(rng.uniform(0, 0.17) * SR)
        L = int(rng.uniform(0.004, 0.02) * SR)
        b = rng.standard_normal(L) * env_exp(L, rng.uniform(0.002, 0.006))
        b = np.diff(b, prepend=0)  # brighten
        x[o:o + L] += b[: n - o] * rng.uniform(0.3, 1.0)
    body = noise_hit(0.12, 0.03, hp=False) * 0.25
    x[: len(body)] += body
    return x / np.max(np.abs(x)) * 0.9


def record_scratch():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 300 + 900 * np.abs(np.sin(2 * np.pi * 3.5 * t)) * np.exp(-t * 2)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    nz = rng.standard_normal(n) * 0.3
    return (saw * 0.5 + nz) * np.exp(-t * 5) * 0.6


def crickets(buf, t0, t1):
    t = t0
    while t < t1:
        for k in range(3):
            n = int(0.035 * SR)
            tt = np.arange(n) / SR
            c = np.sin(2 * np.pi * 4300 * tt) * np.sin(np.pi * tt / 0.035) * 0.05
            place(buf, c, t + k * 0.06)
        t += rng.uniform(0.55, 0.9)


def ding():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1318 * t) + 0.5 * np.sin(2 * np.pi * 1975 * t) + 0.3 * np.sin(2 * np.pi * 2637 * t)) * env_exp(n, 0.35) * 0.35


def whoosh():
    n = int(0.35 * SR)
    x = rng.standard_normal(n)
    # crude band sweep: moving average of decreasing width
    out = np.zeros(n)
    for i in range(0, n, 256):
        w = int(2 + 30 * (1 - i / n))
        seg = x[i:i + 256]
        out[i:i + 256] = np.convolve(seg, np.ones(w) / w, mode="same")
    tt = np.arange(n) / n
    return out * np.sin(np.pi * tt) ** 2 * 0.5


# ---------------------------------------------------------------- captions
def ass_color(hex_, alpha=0):
    h = hex_.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H{alpha:02X}{b}{g}{r}".upper()


BRAND = {"keripik", "goyang", "goyang.", "goyang,", "pedas", "nampol.", "nampol", "keripiknya,", "rasanya!"}


def ts(t):
    t = max(0, t)
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def build_ass(tl, path, total):
    W, H = 720, 1280
    y = 790
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,Fredoka Bold,64,{ass_color('#FFFFFF')},{ass_color('#FFFFFF')},{ass_color('#141414')},{ass_color('#000000', 0x60)},0,0,0,0,100,100,0,0,1,5.5,2.5,5,20,20,0,1
Style: Brand,Fredoka Bold,68,{ass_color('#FFC21A')},{ass_color('#FFFFFF')},{ass_color('#7A1010')},{ass_color('#000000', 0x60)},0,0,0,0,100,100,0,0,1,6,2.5,5,20,20,0,1
Style: Kriuk,Fredoka Bold,104,{ass_color('#FFD43B')},{ass_color('#FFFFFF')},{ass_color('#B3121C')},{ass_color('#000000', 0x50)},0,0,0,0,100,100,0,0,1,8,3,5,20,20,0,1
Style: Tag,Fredoka Bold,58,{ass_color('#FFFFFF')},{ass_color('#FFFFFF')},{ass_color('#B3121C')},{ass_color('#000000', 0x50)},0,0,0,0,100,100,0,0,1,6,2,2,30,30,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    words = [w for b in tl["beats"] for w in b["words"]]
    beat_of = {}
    for b in tl["beats"]:
        for w in b["words"]:
            beat_of[id(w)] = b
    last_beat = tl["beats"][-1]
    for i, w in enumerate(words):
        b = beat_of[id(w)]
        if b is last_beat:
            continue  # the tagline is shown as a full end-card title instead
        nxt = words[i + 1]["s"] if i + 1 < len(words) else w["e"] + 0.4
        end = nxt if nxt - w["e"] < 0.5 else w["e"] + 0.3
        txt = w["w"].strip()
        txt = txt.rstrip(",.") if not txt.endswith("?") else txt
        style = "Word"
        if b["kriuk"]:
            style, txt = "Kriuk", "KRIUK!"
            end = w["s"] + 0.42
        elif txt.lower().strip("!?,.") in {x.strip("!?,.") for x in BRAND}:
            style = "Brand"
        pop = r"{\fscx72\fscy72\t(0,90,\fscx100\fscy100)}" if style != "Kriuk" else r"{\fscx60\fscy60\frz-6\t(0,80,\fscx118\fscy118\frz4)\t(80,170,\fscx100\fscy100\frz0)}"
        yy = 600 if style == "Kriuk" else y
        lines.append(f"Dialogue: 1,{ts(w['s'])},{ts(end)},{style},,0,0,0,,{{\\pos(360,{yy})}}{pop}{txt}")
    # end-card tagline
    s0 = last_beat["start"]
    lines.append(
        f"Dialogue: 2,{ts(s0)},{ts(total)},Tag,,0,0,0,,{{\\fad(150,0)\\fscx80\\fscy80\\t(0,160,\\fscx100\\fscy100)}}"
        r"{\c&H1AC2FF&}Goyang Keripiknya,\N{\c&HFFFFFF&}Nampol Rasanya!"
    )
    path.write_text(head + "\n".join(lines) + "\n")


# ---------------------------------------------------------------- main
def main():
    tl = json.loads((BUILD / "timeline.json").read_text())
    shots = json.loads((BUILD / "shots.json").read_text())
    total = tl["total"]
    OUT.mkdir(exist_ok=True)

    # 1. concat video segments
    lst = BUILD / "segments.txt"
    lst.write_text("".join(f"file 'segments/{s['id']}.mp4'\n" for s in shots))
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", BUILD / "video_silent.mp4"])

    # 2. audio
    run(["ffmpeg", "-v", "error", "-y", "-i", BUILD / "vo.wav", "-ar", str(SR), "-ac", "1", BUILD / "vo48.wav"])
    vo, _ = sf.read(BUILD / "vo48.wav")
    n = int((total + 0.5) * SR)
    vo = np.pad(vo, (0, max(0, n - len(vo))))[:n]
    music = np.zeros(n)
    sfx = np.zeros(n)
    beats = {b["id"]: b for b in tl["beats"]}
    t_stop = beats["b19"]["start"]
    t_grind = beats["b27"]["start"]
    t_party = beats["b36"]["start"]
    t_end = beats["b40"]["start"]

    groove(music, 0.0, t_stop, melody=False, gain=0.85)
    place(sfx, record_scratch(), t_stop - 0.02, 0.9)
    crickets(sfx, t_stop + 0.5, t_grind - 0.2)
    place(music, tone(midi(48), t_grind - t_stop - 0.6, "pad", 0.05), t_stop + 0.4)
    groove(music, t_grind, t_party, keys=False, melody=False, gain=0.8)
    groove(music, t_party, total, melody=True, gain=1.0)
    for e in tl["sfx"]:
        if e["type"] == "crunch":
            place(sfx, crunch(), e["t"], 0.75)
    place(sfx, ding(), beats["b18"]["start"] - 0.02, 0.7)
    for s in shots:
        if s["scene"] in ("court_day_wide", "street_night", "hero_party_room", "endcard"):
            place(sfx, whoosh(), s["start"] - 0.15, 0.35)

    # duck music under the voice
    win = int(0.05 * SR)
    venv = np.sqrt(np.convolve(vo ** 2, np.ones(win) / win, mode="same"))
    duck = 1 - 0.55 * np.clip(venv / 0.05, 0, 1)
    duck = np.convolve(duck, np.ones(int(0.12 * SR)) / int(0.12 * SR), mode="same")
    music_gain = np.full(n, 0.28)
    # swell on the end card after the VO
    ve = beats["b40"]["end"]
    idx = np.arange(n) / SR
    music_gain = np.where(idx > ve, 0.28 + 0.25 * np.clip((idx - ve) / 0.4, 0, 1), music_gain)
    mix = vo * 1.0 + music * music_gain * duck + sfx
    fade = np.clip((total - idx) / 0.6, 0, 1)
    mix *= fade
    mix = mix / max(1e-6, np.max(np.abs(mix))) * 0.95
    sf.write(BUILD / "mix.wav", mix.astype(np.float32), SR)

    # 3. captions + final encode
    ass = BUILD / "captions.ass"
    build_ass(tl, ass, total)
    fonts = ROOT / "renderer" / "fonts"
    preview = "--preview" in sys.argv
    out = OUT / ("preview.mp4" if preview else "keripik-goyang_in-this-town.mp4")
    vf = f"scale=1080:1920:flags=lanczos,ass={ass}:fontsdir={fonts}"
    run(["ffmpeg", "-v", "error", "-y", "-i", BUILD / "video_silent.mp4", "-i", BUILD / "mix.wav",
         "-vf", vf, "-c:v", "libx264", "-preset", "fast" if preview else "slow", "-crf", "21", "-pix_fmt", "yuv420p",
         "-r", "30", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
         "-movflags", "+faststart", "-shortest", out])
    print("wrote", out)


if __name__ == "__main__":
    main()
