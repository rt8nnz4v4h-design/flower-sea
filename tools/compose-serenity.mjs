import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sampleRate = 22050;
const duration = 32;
const chordDuration = 4;
const frameCount = sampleRate * duration;
const left = new Float32Array(frameCount);
const right = new Float32Array(frameCount);

const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);

// D major, kept open and unresolved so the loop feels like a quiet breath.
const chords = [
  [50, 57, 61, 64, 66],
  [47, 54, 57, 62, 64],
  [43, 50, 54, 57, 59],
  [45, 52, 57, 62, 64],
  [42, 49, 52, 57, 59],
  [47, 54, 57, 61, 62],
  [40, 47, 50, 54, 55],
  [45, 52, 55, 59, 62],
];

function addTone(sample, frequency, gain, attack, decay, pan, warmth = 1) {
  const start = Math.round(sample * sampleRate);
  const length = Math.min(frameCount - start, Math.round(sampleRate * 5.5));
  if (length <= 0) return;

  const leftGain = gain * Math.sqrt((1 - pan) / 2);
  const rightGain = gain * Math.sqrt((1 + pan) / 2);
  const twoPi = Math.PI * 2;

  for (let i = 0; i < length; i++) {
    const time = i / sampleRate;
    const attackEnvelope = Math.min(1, time / Math.max(0.005, attack));
    const envelope = attackEnvelope * Math.exp(-time * decay);
    const phase = twoPi * frequency * time;
    const shimmer = Math.sin(phase * 2.01 + time * 0.22) * 0.16;
    const body = Math.sin(phase) + Math.sin(phase * 2) * 0.2 * warmth;
    const air = Math.sin(phase * 3.99 + Math.sin(time * 0.35) * 0.08) * 0.055;
    const value = (body + shimmer + air) * envelope * 0.48;
    const frame = start + i;
    left[frame] += value * leftGain;
    right[frame] += value * rightGain;
  }
}

function addPad(sample, notes, gain) {
  const start = Math.round(sample * sampleRate);
  const length = Math.min(frameCount - start, Math.round(sampleRate * 4.8));
  if (length <= 0) return;

  for (const note of notes) {
    const hz = midiToHz(note);
    for (const [detune, pan] of [[-0.0018, -0.55], [0, 0], [0.0021, 0.55]]) {
      const frequency = hz * (1 + detune);
      const leftGain = (gain / notes.length) * Math.sqrt((1 - pan) / 2);
      const rightGain = (gain / notes.length) * Math.sqrt((1 + pan) / 2);
      const phaseOffset = (note % 5) * 0.7 + detune * 10000;
      for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        const attack = Math.min(1, time / 1.35);
        const release = Math.min(1, (length / sampleRate - time) / 1.8);
        const breath = 0.76 + Math.sin(time * 0.34 + note * 0.11) * 0.12;
        const envelope = attack * release * breath;
        const value =
          Math.sin(Math.PI * 2 * frequency * time + phaseOffset) +
          Math.sin(Math.PI * 2 * frequency * 2.002 * time + phaseOffset * 0.7) * 0.08;
        const frame = start + i;
        left[frame] += value * envelope * leftGain;
        right[frame] += value * envelope * rightGain;
      }
    }
  }
}

const arpOrder = [2, 4, 1, 3, 4, 0, 2, 1];
for (let chordIndex = 0; chordIndex < chords.length; chordIndex++) {
  const chord = chords[chordIndex];
  const start = chordIndex * chordDuration;
  addPad(start, chord, 0.047);

  // Sparse felt-piano sparkle, intentionally leaving plenty of silence.
  for (let step = 0; step < arpOrder.length; step++) {
    const noteIndex = arpOrder[step] % chord.length;
    const note = chord[noteIndex] + (step % 4 === 3 ? 24 : 12);
    const time = start + 0.48 + step * 0.45;
    const gain = 0.049 - step * 0.0018;
    addTone(time, midiToHz(note), gain, 0.018 + (step % 3) * 0.008, 2.9, Math.sin(step * 1.7) * 0.32);
  }

  // A low, almost felted root anchors each four-second phrase.
  addTone(start + 0.05, midiToHz(chord[0] - 12), 0.065, 0.16, 0.46, -0.05, 1.45);
  addTone(start + 0.02, midiToHz(chord[0] + 24), 0.011, 0.45, 1.15, 0.25, 0.7);
}

function addEcho(input, delaySeconds, gain, panSwap) {
  const delay = Math.round(delaySeconds * sampleRate);
  for (let i = 0; i < frameCount; i++) {
    const source = input[i] * gain;
    const target = (i + delay) % frameCount;
    if (panSwap) {
      left[target] += source;
      right[target] += source * 0.72;
    } else {
      left[target] += source * 0.72;
      right[target] += source;
    }
  }
}

addEcho(left, 0.071, 0.12, false);
addEcho(right, 0.113, 0.11, true);
addEcho(left, 0.193, 0.08, true);
addEcho(right, 0.317, 0.065, false);
addEcho(left, 0.487, 0.045, false);

let peak = 0;
let sumSquares = 0;
const seam = Math.round(sampleRate * 0.35);
for (let i = 0; i < frameCount; i++) {
  const edge = Math.min(1, i / seam, (frameCount - 1 - i) / seam);
  const fade = 0.5 - Math.cos(Math.PI * edge) * 0.5;
  left[i] *= fade;
  right[i] *= fade;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  sumSquares += left[i] ** 2 + right[i] ** 2;
}

const normalizer = peak > 0 ? 0.88 / peak : 1;
const pcm = Buffer.alloc(frameCount * 4);
for (let i = 0; i < frameCount; i++) {
  const l = Math.max(-1, Math.min(1, left[i] * normalizer));
  const r = Math.max(-1, Math.min(1, right[i] * normalizer));
  pcm.writeInt16LE(Math.round(l * 32767), i * 4);
  pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

const output = path.resolve(import.meta.dirname, "..", "assets", "music", "serenity.wav");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, Buffer.concat([header, pcm]));

const rms = Math.sqrt(sumSquares / (frameCount * 2)) * normalizer;
console.log(
  `Wrote ${output}\nDuration ${duration}s, ${sampleRate} Hz stereo, peak ${(0.88).toFixed(2)}, RMS ${rms.toFixed(3)}`,
);
