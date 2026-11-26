"""Generate the voiceover per beat with Kokoro, align words with Whisper,
and write build/vo.wav + build/timeline.json (beats, words, shots with times).

usage: python3 tools/make_vo.py <kokoro_model_dir>
"""
import difflib
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro

sys.path.insert(0, str(Path(__file__).parent))
from phonemes import build_phonemes  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
BUILD.mkdir(exist_ok=True)
MODEL_DIR = Path(sys.argv[1])

SR = 24000
LEAD_IN = 0.15          # silence before the first beat
DEFAULT_GAP = 0.22      # silence after each beat
KRIUK_SPACING = 0.46    # seconds between the three "Kriuk!" hits


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def trim(a, thr=0.004):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(0.02 * SR))
    e = min(len(a), idx[-1] + int(0.04 * SR))
    return a[s:e]


def resample16k(a):
    x = np.arange(0, len(a), SR / 16000)
    return np.interp(x, np.arange(len(a)), a).astype(np.float32)


def align_words(words, wh_words, dur):
    """Map script words to whisper word times; interpolate gaps by char length."""
    n = len(words)
    starts = [None] * n
    ends = [None] * n
    sm = difflib.SequenceMatcher(None, [norm(w) for w in words], [norm(w["w"]) for w in wh_words], autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            i, j = blk.a + k, blk.b + k
            starts[i], ends[i] = wh_words[j]["s"], wh_words[j]["e"]
    # fill unmatched runs
    i = 0
    while i < n:
        if starts[i] is not None:
            i += 1
            continue
        j = i
        while j < n and starts[j] is None:
            j += 1
        t0 = ends[i - 1] if i > 0 else 0.0
        t1 = starts[j] if j < n else dur
        lens = [max(1, len(norm(w))) for w in words[i:j]]
        tot = sum(lens)
        t = t0
        for k, L in enumerate(lens):
            seg = (t1 - t0) * L / tot
            starts[i + k], ends[i + k] = t, t + seg
            t += seg
        i = j
    # monotonic clean-up
    for k in range(1, n):
        if starts[k] < starts[k - 1]:
            starts[k] = starts[k - 1] + 0.01
    return starts, ends


def main():
    cfg = json.loads((ROOT / "beats.json").read_text())
    kok = Kokoro(str(MODEL_DIR / "kokoro-v1.0.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))
    wm = WhisperModel("small", device="cpu", compute_type="int8")
    voice, speed = cfg["voice"], cfg["speed"]

    # one shared "Kriuk!" take so the catchphrase sounds identical every time
    kr_ph = build_phonemes("Kriuk!", kok.tokenizer, cfg["pronounce"])
    kr, _ = kok.create(kr_ph, voice=voice, speed=1.0, is_phonemes=True)
    kr = trim(kr)

    track = [np.zeros(int(LEAD_IN * SR), dtype=np.float32)]
    t = LEAD_IN
    out_beats = []
    sfx = []
    for beat in cfg["beats"]:
        words = beat["text"].split()
        if beat.get("kriuk"):
            a = np.zeros(int((KRIUK_SPACING * 2) * SR) + len(kr), dtype=np.float32)
            starts, ends = [], []
            for k in range(3):
                o = int(k * KRIUK_SPACING * SR)
                a[o:o + len(kr)] += kr
                starts.append(k * KRIUK_SPACING)
                ends.append(k * KRIUK_SPACING + len(kr) / SR)
                sfx.append({"type": "crunch", "t": t + k * KRIUK_SPACING + 0.02})
        else:
            ph = build_phonemes(beat["text"], kok.tokenizer, cfg["pronounce"])
            a, _ = kok.create(ph, voice=voice, speed=speed, is_phonemes=True)
            a = trim(a)
            segs, _ = wm.transcribe(resample16k(a), language="en", word_timestamps=True,
                                    initial_prompt=beat["text"])
            wh = [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]
            starts, ends = align_words(words, wh, len(a) / SR)
        dur = len(a) / SR
        gap = beat.get("gap", DEFAULT_GAP)
        track.append(a.astype(np.float32))
        track.append(np.zeros(int(gap * SR), dtype=np.float32))
        wlist = [{"w": w, "s": round(t + s, 3), "e": round(t + e, 3)} for w, s, e in zip(words, starts, ends)]
        out_beats.append({"id": beat["id"], "text": beat["text"], "start": round(t, 3),
                          "end": round(t + dur, 3), "words": wlist, "kriuk": bool(beat.get("kriuk")),
                          "shots": beat["shots"]})
        print(f"{beat['id']} {t:6.2f}-{t + dur:6.2f}  {beat['text']}")
        t += dur + gap

    vo = np.concatenate(track)
    total = len(vo) / SR

    # shots: cut at the first word of each shot (slightly early), last shot runs to next beat
    shots = []
    for bi, b in enumerate(out_beats):
        for si, s in enumerate(b["shots"]):
            start = b["start"] if s["at"] == 0 else b["words"][s["at"]]["s"] - 0.06
            shots.append({"beat": b["id"], "scene": s["scene"], "p": s.get("p", {}), "start": round(start, 3)})
    shots[0]["start"] = 0.0
    for i, s in enumerate(shots):
        s["end"] = shots[i + 1]["start"] if i + 1 < len(shots) else round(total, 3)
        s["dur"] = round(s["end"] - s["start"], 3)
        s["id"] = f"s{i:02d}_{s['scene']}"

    sf.write(BUILD / "vo.wav", vo, SR)
    (BUILD / "timeline.json").write_text(json.dumps(
        {"fps": 30, "total": round(total, 3), "beats": out_beats, "shots": shots, "sfx": sfx}, indent=1))
    print(f"total {total:.2f}s, {len(shots)} shots")


if __name__ == "__main__":
    main()
