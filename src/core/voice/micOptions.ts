/** Android AudioRecord sources. Phones differ in which one actually delivers audio. */
export type MicSource = 'mic' | 'voice' | 'camcorder' | 'communication' | 'unprocessed';
export type MicSetting = 'auto' | MicSource;

export const MIC_OPTIONS: { key: MicSource; label: string; hint: string; androidSource: number }[] = [
  { key: 'mic', label: 'Standard mic', hint: 'Works on most phones.', androidSource: 1 },
  { key: 'camcorder', label: 'Camcorder mic', hint: 'Often louder and clearer.', androidSource: 5 },
  { key: 'voice', label: 'Voice recognition', hint: 'Tuned for speech, silent on some phones.', androidSource: 6 },
  { key: 'unprocessed', label: 'Raw (unprocessed)', hint: 'No filtering; can be quiet.', androidSource: 9 },
  { key: 'communication', label: 'Voice call mic', hint: 'Echo-cancelled, like a call.', androidSource: 7 },
];

/** Order tried in Auto mode when a source records silence. */
export const MIC_ORDER: MicSource[] = MIC_OPTIONS.map(o => o.key);

export const micSourceId = (key: MicSource) => MIC_OPTIONS.find(o => o.key === key)?.androidSource ?? 1;
export const micLabel = (key: MicSource) => MIC_OPTIONS.find(o => o.key === key)?.label ?? key;

export function nextMic(cur: MicSource): MicSource {
  return MIC_ORDER[(MIC_ORDER.indexOf(cur) + 1) % MIC_ORDER.length];
}
