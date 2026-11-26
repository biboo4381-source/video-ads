# Keripik Goyang — "In this town…" (TikTok ad)

**Format:** 9:16, 1080×1920, 30 fps, ~93 s · blocky toy-town 3D animation · one-word-at-a-time captions · first-person kid narrator.

**Reference:** TikTok "Huss huss huss original" (@jinjee15), story 1 of 3 (0:00–1:13): *everyone in town parties, the narrator secretly grinds, wins the big game, then the whole town starts grinding.* We kept the structure, pacing and punchlines, swapped the "HUSS!" catchphrase for the snack-crunch **"KRIUK!"**, and rewrote the grinding part so the brand drives the twist.

## What changed vs. the reference

| Reference | Keripik Goyang version |
|---|---|
| "HUSS! HUSS! HUSS!" (training sound) | "KRIUK! KRIUK! KRIUK!" — the crunch of a Keripik Goyang chip, with a real crunch SFX every time |
| Kid trains in secret | Kid trains in secret — *"One hundred shots. One bag of Keripik Goyang. Every single night."* |
| "Who's the kid in the beanie?" | "Who's the kid with the chips?" |
| Town starts grinding (guitar, karate, push-ups) | Same — **but each of them is grinding with a bag of Keripik Goyang** (grandma has two) |
| Narrator is the only one free on Friday | *"They all think the chips are my secret. Honestly? They kind of are."* → every store is **SOLD OUT** of Keripik Goyang |
| The only party guest is the mayor's goldfish | Same — and **the goldfish brought the last bag: Pedas Nampol** |
| — | End card: real product photo + tagline *Goyang Keripiknya, Nampol Rasanya!* |

Hero design ties to the mascot: red polka-dot bandana + red sneakers (like the pack mascot), orange hoodie in pack colours.

## Voiceover (en, with Indonesian brand words)

1. In this town, everybody parties every night.
2. Except me.
3. **KRIUK! KRIUK! KRIUK!**
4. You see, every single night, there's a party somewhere.
5. Pool parties. Karaoke parties. Even a birthday party for the mayor's goldfish.
6. Nobody here practices anything. Why would they?
7. My best friend Bayu goes to every party.
8. My neighbor Sari goes to every party.
9. Even my grandma goes dancing on Tuesdays.
10. But not me.
11. **KRIUK! KRIUK! KRIUK!**
12. One hundred shots. One bag of Keripik Goyang. Every single night.
13. Then came the biggest party of the year. The Summer Party Basketball Game!
14. Everybody showed up in party hats. When I walked onto the court, everybody laughed.
15. "Who's the kid with the chips?"
16. Then I got the ball.
17. **KRIUK! KRIUK! KRIUK!**
18. Fifty points. All by myself.
19. The music stopped. The whole crowd went silent.
20. Bayu walked up to me and asked,
21. "When did you get so good?"
22. I told him the truth.
23. "While you were out partying."
24. The next night, I walked through town, and something was wrong.
25. No music. No party lights. Nothing.
26. Then I heard it, from every single window…
27. **KRIUK! KRIUK! KRIUK!**
28. Bayu was practicing guitar, with a bag of Keripik Goyang.
29. Sari was practicing karate, with a bag of Keripik Goyang.
30. And my grandma was doing push-ups, with two bags.
31. They all think the chips are my secret.
32. Honestly? They kind of are.
33. Now the whole town is grinding, which is great.
34. Except every store in town is sold out of Keripik Goyang,
35. and I'm the only one who's free on a Friday night.
36. So I threw a party.
37. The only guest was the mayor's goldfish.
38. He brought the last bag. Pedas Nampol.
39. He's actually a pretty good dancer.
40. **Goyang keripiknya, nampol rasanya!** *(end card)*

Shot-by-shot scene assignments live in `beats.json` (62 shots).

## Sound

- Narrator: Kokoro TTS voice `am_fenrir`, with custom IPA so *Keripik Goyang*, *Kriuk*, *Bayu*, *Pedas Nampol* and the tagline are pronounced the Indonesian way.
- Original music bed synthesized in `tools/assemble.py` (~130 BPM so the dribble and the KRIUK hits land on the beat): party groove → **record scratch on "The music stopped"** → crickets for the silent night → stripped-down "grind" beat → full party groove for the goldfish party and end card.
- SFX: chip crunch on every KRIUK, score "ding" on "Fifty points", whooshes on big scene changes.

## Rebuild

```bash
npm install
python3 tools/prep_assets.py                       # flatten pouch fronts into textures
python3 tools/make_vo.py <dir-with-kokoro-model>   # VO + word timings -> build/
node tools/render.mjs --stills                     # preview stills
node tools/render.mjs                              # render all shots -> build/segments
python3 tools/assemble.py                          # music/SFX/captions -> out/
```

Requirements: Node 22 + Playwright Chromium, Python 3 with `kokoro-onnx`, `faster-whisper`, `soundfile`, `numpy`, `Pillow`; ffmpeg with libass. Kokoro model files: `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx releases.

Font: Fredoka (SIL Open Font License, see `renderer/fonts/OFL.txt`).
