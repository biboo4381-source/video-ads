"""Phonemize script text for Kokoro, with custom IPA for Indonesian brand words."""
import re


def build_phonemes(text, tokenizer, pronounce):
    keys = sorted(pronounce, key=len, reverse=True)
    pattern = re.compile("(" + "|".join(re.escape(k) for k in keys) + ")") if keys else None
    parts = pattern.split(text) if pattern else [text]
    out = []
    for part in parts:
        if not part:
            continue
        if part in pronounce:
            out.append(pronounce[part])
        elif part.strip() and re.search(r"[A-Za-z0-9]", part):
            out.append(tokenizer.phonemize(part.strip(), lang="en-us"))
        else:
            # pure punctuation between brand words, keep as-is so Kokoro pauses
            out.append(part.strip())
    ph = " ".join(p for p in out if p)
    ph = re.sub(r"\s+([,.!?])", r"\1", ph)
    return ph
