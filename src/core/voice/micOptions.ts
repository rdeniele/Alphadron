/** Android AudioRecord sources the user can pick between (some phones only work with certain ones). */
export type MicSource = 'mic' | 'voice' | 'camcorder' | 'communication' | 'unprocessed';

export const MIC_OPTIONS: { key: MicSource; label: string; hint: string; androidSource: number }[] = [
  { key: 'mic', label: 'Standard mic', hint: 'Works on most phones. Recommended first try.', androidSource: 1 },
  { key: 'voice', label: 'Voice recognition', hint: 'Tuned for speech, but quiet or silent on some phones.', androidSource: 6 },
  { key: 'camcorder', label: 'Camcorder mic', hint: 'Often louder and clearer, good for far-away speech.', androidSource: 5 },
  { key: 'communication', label: 'Voice call mic', hint: 'Echo-cancelled, like a phone call.', androidSource: 7 },
  { key: 'unprocessed', label: 'Raw (unprocessed)', hint: 'No filtering. Can be very quiet, but cleanest signal.', androidSource: 9 },
];

export const micSourceId = (key: MicSource) => MIC_OPTIONS.find(o => o.key === key)?.androidSource ?? 1;
