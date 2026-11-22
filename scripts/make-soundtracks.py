#!/usr/bin/env python3
"""Compose one distinct synthesized soundtrack per film, in stdlib only.

Each track concentrates its energy in the audible 400 to 2000 Hz band
(fundamentals and harmonics live there, nothing is composed below
200 Hz), then is normalised to about -15 dB RMS with a peak near
-1 dB. Run: python3 scripts/make-soundtracks.py
Outputs media-src/track-<name>.wav, then mux with ffmpeg.
"""
import math
import os
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "media-src")

# note name to frequency
def f(semi_from_a4):
    return 440.0 * (2 ** (semi_from_a4 / 12.0))

# A4 = 0 semitones. Notes used are all at or above 220 Hz fundamentals,
# with the melodic energy between 400 and 1200 Hz.
N = {
    "A3": f(-12), "B3": f(-10), "C4": f(-9), "D4": f(-7), "E4": f(-5),
    "F4": f(-4), "G4": f(-2), "A4": f(0), "B4": f(2), "C5": f(3),
    "D5": f(5), "E5": f(7), "F5": f(8), "G5": f(10), "A5": f(12),
    "C3": f(-21), "E3": f(-17), "F3": f(-16), "G3": f(-14),
    "B5": f(14), "C6": f(15), "D6": f(17), "E6": f(19), "G5x": f(10),
}


def tone(buf, start, dur, freq, vol, kind):
    """Add one note into buf (list of floats). kind: pluck, pad, pluck2."""
    s0 = int(start * SR)
    s1 = min(len(buf), int((start + dur) * SR))
    for i in range(s0, s1):
        t = (i - s0) / SR
        if kind == "pluck":
            env = math.exp(-3.2 * t)
            harm = [1.0, 0.45, 0.18]
        elif kind == "pluck2":
            env = math.exp(-5.0 * t)
            harm = [1.0, 0.6, 0.3, 0.1]
        else:  # pad
            a = min(1.0, t / 0.4)
            r = min(1.0, max(0.0, (dur - t) / 0.5))
            env = a * r
            harm = [1.0, 0.35, 0.12]
        v = 0.0
        for h, amp in enumerate(harm, start=1):
            v += amp * math.sin(2 * math.pi * freq * h * t)
        buf[i] += vol * env * v


def chord(buf, start, dur, notes, vol, kind):
    for n in notes:
        tone(buf, start, dur, N[n], vol, kind)


def master(buf, target_rms_db=-15.0, peak_db=-1.0):
    # normalise RMS
    rms = math.sqrt(sum(x * x for x in buf) / len(buf))
    target = 10 ** (target_rms_db / 20.0)
    g = target / rms
    buf = [x * g for x in buf]
    # soft limit peaks, then re-check RMS and lift once more if needed
    peak_target = 10 ** (peak_db / 20.0)
    for _ in range(3):
        peak = max(abs(x) for x in buf)
        if peak <= peak_target:
            break
        buf = [peak_target * math.tanh(x / peak_target) for x in buf]
        rms = math.sqrt(sum(x * x for x in buf) / len(buf))
        g = target / rms
        buf = [x * g for x in buf]
    peak = max(abs(x) for x in buf)
    if peak > peak_target:
        buf = [x * (peak_target / peak) for x in buf]
    # short fade in and out
    fade = int(0.08 * SR)
    for i in range(fade):
        buf[i] *= i / fade
        buf[-1 - i] *= i / fade
    return buf


def save(name, buf):
    buf = master(buf)
    path = os.path.join(OUT, "track-%s.wav" % name)
    w = wave.open(path, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = b"".join(struct.pack("<h", int(max(-1, min(1, x)) * 32767)) for x in buf)
    w.writeframes(frames)
    w.close()
    print("wrote", path, len(buf) / SR, "s")


def blank(dur):
    return [0.0] * int(dur * SR)


def track_about(dur):
    """Calm: slow piano style arpeggio over C, F, G, C chords."""
    buf = blank(dur)
    chords = [["C5", "E5", "G5"], ["F5", "A5", "C6"], ["G5", "B5", "D6"], ["C5", "E5", "G5"]]
    bar = 3.2
    t = 0.0
    i = 0
    while t < dur - 0.3:
        ch = chords[i % len(chords)]
        for j, n in enumerate(ch):
            tone(buf, t + j * 0.42, 1.6, N[n], 0.32, "pluck")
        tone(buf, t, bar, N[ch[0]], 0.06, "pad")
        t += bar
        i += 1
    return buf


def track_home(dur):
    """Friendly light: bright pentatonic plucks, gentle bounce."""
    buf = blank(dur)
    melody = ["C5", "E5", "G5", "E5", "A5", "G5", "E5", "D5"]
    roots = ["C4", "F4", "A3", "G3"]
    step = 0.46
    t = 0.2
    i = 0
    while t < dur - 0.4:
        tone(buf, t, 0.5, N[melody[i % len(melody)]], 0.30, "pluck2")
        if i % 2 == 0:
            tone(buf, t, 0.9, N[roots[(i // 2) % len(roots)]], 0.16, "pluck")
        t += step
        i += 1
    return buf


def track_office(dur):
    """Calm professional: soft pads with a slow, even pulse."""
    buf = blank(dur)
    chords = [["A4", "C5", "E5"], ["F4", "A4", "C5"], ["C5", "E5", "G5"], ["G4", "B4", "D5"]]
    bar = 3.5
    t = 0.0
    i = 0
    while t < dur - 0.3:
        ch = chords[i % len(chords)]
        chord(buf, t, bar, ch, 0.13, "pad")
        for j in range(4):
            tone(buf, t + j * (bar / 4), 0.35, N[ch[2]], 0.10, "pluck2")
        t += bar
        i += 1
    return buf


def track_packing(dur):
    """Warm steady rhythm: marimba style pattern, regular beat."""
    buf = blank(dur)
    pattern = ["C5", "E5", "G5", "E5", "A5", "G5", "E5", "G5"]
    step = 0.38
    t = 0.15
    i = 0
    while t < dur - 0.35:
        tone(buf, t, 0.4, N[pattern[i % len(pattern)]], 0.34, "pluck2")
        if i % 4 == 0:
            tone(buf, t, 0.5, N["C5"], 0.14, "pluck")
        t += step
        i += 1
    return buf


def track_loading(dur):
    """Road feel: driving eighth note strums, forward motion."""
    buf = blank(dur)
    seq = ["E5", "E5", "G5", "A5", "G5", "E5", "D5", "E5"]
    step = 0.27
    t = 0.1
    i = 0
    while t < dur - 0.3:
        tone(buf, t, 0.3, N[seq[i % len(seq)]], 0.30, "pluck2")
        if i % 8 == 0:
            chord(buf, t, 1.9, ["E5", "G5", "B5"], 0.07, "pad")
        t += step
        i += 1
    return buf


DURATIONS = {"about": 13.08, "home": 6.92, "office": 13.96, "packing": 11.25, "loading": 7.8}
BUILDERS = {"about": track_about, "home": track_home, "office": track_office, "packing": track_packing, "loading": track_loading}

if __name__ == "__main__":
    for name, dur in DURATIONS.items():
        save(name, BUILDERS[name](dur))
