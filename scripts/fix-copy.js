// One-off copy pass: grammar, consistency (US spelling, serial commas) and no em dashes in the UI.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const edits = {
  'src/core/ai/modelManifest.ts': [
    ["name: 'Qwen3 0.6B — the brain'", "name: 'Qwen3 0.6B (assistant brain)'"],
    ["name: 'Whisper base — hearing'", "name: 'Whisper base (hearing)'"],
    ["name: 'Kokoro 82M — voice'", "name: 'Kokoro 82M (voice)'"],
  ],
  'src/core/ai/assistant.ts': [
    [
      'I can still set reminders, tasks and notes without the AI brain. For open chat, though, I need it: download it in Settings (about 400 MB, one time).',
      'I can still set reminders, tasks, and notes without the AI brain. For open chat, though, I need it. You can download it in Settings (about 400 MB, one time).',
    ],
  ],
  'src/core/ai/modelManager.ts': [
    [
      'The connection kept dropping (${detail}). Your progress is not saved between launches; try again on a steadier Wi-Fi connection.',
      'The connection kept dropping (${detail}). Please try again on a steadier Wi-Fi connection.',
    ],
    ["'Download cancelled.'", "'Download canceled.'"],
  ],
  'src/core/ai/smallTalk.ts': [
    [
      "Doing great, thanks for asking! How about you — how's your day been?",
      "Doing great, thanks for asking! How about you? How's your day been?",
    ],
    [
      'I can keep your reminders, tasks, notes and schedule, and chat with you. What would you like to do?',
      "I can keep track of your reminders, tasks, notes, and schedule, and I'm happy to chat too. What would you like to do?",
    ],
  ],
  'src/core/tools/executor.ts': [
    ['I don\'t have a tool called "${name}".', "I can't do that yet."],
    ['`I couldn\'t do that: ${v.error}.`', "`I couldn't do that. Some details were missing or unclear.`"],
    ["chip: 'Cancelled'", "chip: 'Canceled'"],
    ["summary: 'Okay, cancelled.'", "summary: 'Okay, canceled.'"],
  ],
  'src/core/tools/format.ts': [
    ['`${i.time} — ${i.title}` : `${i.title}  (task due)`', '`${i.time}: ${i.title}` : `${i.title} (task due)`'],
    ['`${r.when} — ${r.title}`', '`${r.when}: ${r.title}`'],
    [
      "You're all clear — enjoy it, or add a task to plan ahead.",
      "You're all clear. Enjoy it, or add a task to plan ahead.",
    ],
    ['`${t.title}  (${t.overdue', '`${t.title} (${t.overdue'],
  ],
  'src/core/tools/tools.ts': [
    ["chip: 'Could not complete'", "chip: \"Couldn't complete\""],
    [
      "' (Notifications are turned off, so it will not alert you. Enable them in system settings.)'",
      "' Notifications are turned off for Alphadron, so you will not get an alert. You can turn them on in Android settings.'",
    ],
    ["Cancelled the reminder", 'Canceled the reminder'],
    ["chip: 'Reminder cancelled'", "chip: 'Reminder canceled'"],
    ['so I did not save that.', "so I didn't save that."],
    [
      'Notifications are turned off for Alphadron in system settings.',
      'Notifications are turned off for Alphadron. Turn them on in Android settings.',
    ],
  ],
  'src/features/assistant/AssistantProvider.tsx': [
    [
      "I couldn't make out words. Speak a little closer and clearly, then tap ✓.",
      "I couldn't make out any words. Try speaking a little closer and more clearly, then tap ✓.",
    ],
    ["listening: 'Listening… release to send'", "listening: 'Listening…'"],
  ],
  'src/features/assistant/ChatScreen.tsx': [
    ['First answer takes a little longer while the AI loads', 'The first answer takes a little longer while the AI loads'],
  ],
  'src/features/assistant/HomeScreen.tsx': [
    [
      'Nothing planned for today. Tap + or hold the mic to add something.',
      'Nothing is planned for today. Tap Add or the mic to get started.',
    ],
    ["'Nothing here today.'", "'Nothing here for today.'"],
  ],
  'src/features/assistant/RecordingBar.tsx': [
    ["'Speak, then tap ✓ to send · ✕ to cancel'", "'Speak, then tap ✓ to send or ✕ to cancel.'"],
    ['"I can\'t hear you yet — speak closer to the mic"', '"I can\'t hear you yet. Speak closer to the mic."'],
  ],
  'src/features/memory/MemoryScreen.tsx': [
    ['Add a memory, e.g. My birthday is March 3', 'Add a memory, for example: My birthday is March 3'],
  ],
  'src/features/models/ModelsPanel.tsx': [["`${(b / 1048576).toFixed(0)} MB` : '—'", "`${(b / 1048576).toFixed(0)} MB` : 'unknown size'"]],
  'src/features/settings/MicTest.tsx': [
    ["'Silent — this microphone recorded nothing. Pick a different option above and test again.'", "'Silent. This microphone recorded nothing. Pick a different option above, then test again.'"],
    ['Level {Math.round(result.peak * 100)}% — {verdict(result.peak).text}', 'Level {Math.round(result.peak * 100)}%. {verdict(result.peak).text}'],
    ["'No words recognized.'", "'No words were recognized.'"],
  ],
  'src/features/settings/SettingsScreen.tsx': [
    ["'Online — only needed to download these once.'", "'Online. This is only needed to download the models once.'"],
    ["'Offline — everything still works.'", "'Offline. Everything still works.'"],
    ['placeholder="Your name (optional, so I can greet you)"', 'placeholder="Your name (optional)"'],
    ['One soft chime at the due time for reminders, events and tasks. It never repeats or nags.', 'One soft chime at the due time for reminders, events, and tasks. It never repeats or nags.'],
    ['Alarm volume rings at your alarm volume, even when the phone is on silent.', 'Alarm volume plays at your alarm volume, even when the phone is on silent.'],
    ['Delete all chat history? Tasks, reminders and memories are kept.', 'Delete all chat history? Your tasks, reminders, and memories will be kept.'],
    ['Everything stays on this phone. Chats, tasks, reminders, notes and memories are never sent anywhere. The microphone only records after you tap it.', 'Everything stays on this phone. Chats, tasks, reminders, notes, and memories are never sent anywhere. The microphone only records after you tap it.'],
    ['Remember things I ask it to', 'Let Alphadron remember things'],
  ],
};

let changed = 0;
for (const [file, pairs] of Object.entries(edits)) {
  const p = path.join(root, file);
  let src = fs.readFileSync(p, 'utf8');
  for (const [from, to] of pairs) {
    if (!src.includes(from)) {
      console.log('NOT FOUND in', file, '->', from.slice(0, 70));
      continue;
    }
    src = src.split(from).join(to);
    changed++;
  }
  fs.writeFileSync(p, src);
}
console.log('applied', changed, 'edits');
