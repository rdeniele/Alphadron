import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAudio, cleanTranscript, pcm16ToFloat32, chunkLevel, SAMPLE_RATE } from '../src/core/voice/audioUtils.ts';

const peakOf = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test('quiet speech is amplified to near full scale', () => {
  const quiet = new Float32Array(16000).map((_, i) => 0.05 * Math.sin(i / 10));
  const out = prepareAudio(quiet);
  assert.ok(peakOf(out) > 0.85 && peakOf(out) <= 1, `peak ${peakOf(out)}`);
});
test('normal-level audio is left alone', () => {
  const loud = new Float32Array(16000).map((_, i) => 0.7 * Math.sin(i / 10));
  assert.ok(Math.abs(peakOf(prepareAudio(loud)) - peakOf(loud)) < 1e-6);
});
test('silence is not blown up into noise', () => {
  const out = prepareAudio(new Float32Array(16000));
  assert.equal(peakOf(out), 0);
});
test('gain is capped so noise does not explode', () => {
  const hiss = new Float32Array(16000).fill(0.002);
  assert.ok(peakOf(prepareAudio(hiss)) <= 0.002 * 20 + 1e-6);
});
test('padding added at both ends', () => {
  const out = prepareAudio(new Float32Array(1000).fill(0.6));
  assert.equal(out.length, 1000 + Math.round(SAMPLE_RATE * 0.25) + Math.round(SAMPLE_RATE * 0.5));
  assert.equal(out[0], 0);
  assert.equal(out[out.length - 1], 0);
});
test('pcm16 decode incl. negative values and odd chunk boundaries', () => {
  // samples: 16384 (0x4000), -16384 (0xC000) split across chunks
  const f = pcm16ToFloat32([new Uint8Array([0x00, 0x40, 0x00]), new Uint8Array([0xc0])]);
  assert.equal(f.length, 2);
  assert.ok(Math.abs(f[0] - 0.5) < 1e-4 && Math.abs(f[1] + 0.5) < 1e-4);
});
test('level meter: silence 0, speech > 0', () => {
  assert.equal(chunkLevel(new Uint8Array(100)), 0);
  assert.ok(chunkLevel(new Uint8Array([0x00, 0x20, 0x00, 0xe0, 0x00, 0x20, 0x00, 0xe0])) > 0.3);
});
test('transcript cleaning', () => {
  assert.equal(cleanTranscript(' [BLANK_AUDIO] Remind me (music) tomorrow '), 'Remind me tomorrow');
  assert.equal(cleanTranscript('[ Silence ]'), '');
});
