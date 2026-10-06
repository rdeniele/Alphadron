/**
 * Instant, friendly replies to everyday chit-chat (greetings, thanks, "how are you"...).
 * Exact-phrase matching only, so real requests are never swallowed. Most replies end with a
 * question so the conversation keeps going. Pure; unit-testable.
 */

export interface SmallTalkOpts {
  name?: string | null;
  hour: number;
  /** Injectable for tests; defaults to a random choice. */
  pick?: <T>(items: T[]) => T;
}

const random = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CAPABILITIES =
  'Here is what I can do, all on your phone:\n' +
  '• Reminders: "Remind me tomorrow at 9 to call John"\n' +
  '• Tasks: "Add task finish the proposal by Friday"\n' +
  '• Schedule: "What do I have tomorrow?"\n' +
  '• Notes and memory: "Note: the wifi code is on the fridge"\n' +
  '• Or just chat with me. What would you like to try?';

export function smallTalk(text: string, opts: SmallTalkOpts): string | null {
  const t = normalize(text);
  if (!t || t.split(' ').length > 7) {
    return null;
  }
  const pick = opts.pick ?? random;
  const who = opts.name ? `, ${opts.name}` : '';
  const part = opts.hour < 12 ? 'morning' : opts.hour < 18 ? 'afternoon' : 'evening';

  if (/^(hi|hello|hey|yo|hiya|howdy|hey there|hi there|hello there)( alphadex)?$/.test(t)) {
    return `Hey${who}! ${pick(["What are we getting done today?", "How's your day going?", "What's on your mind?"])}`;
  }
  const gm = t.match(/^good (morning|afternoon|evening)( alphadex)?$/) || t.match(/^(morning|evening)$/);
  if (gm) {
    return `Good ${part}${who}! ${pick(["Anything you want to plan for today?", "How are you feeling?", "Want me to run through your day?"])}`;
  }
  if (/^(how are you|how are you doing|how's it going|hows it going|what's up|whats up|sup)( today)?( alphadex)?$/.test(t)) {
    return `Doing great, thanks for asking! How about you — how's your day been?`;
  }
  if (/^(thanks|thank you|thx|ty|cheers|thanks a lot|thank you so much|thanks so much|appreciate it)( alphadex)?$/.test(t)) {
    return pick(["Anytime! Anything else I can help with?", "You're welcome! Need anything else?", "Happy to help. What's next?"]);
  }
  if (/^(who are you|what are you|what's your name|whats your name|what is your name|introduce yourself)$/.test(t)) {
    return "I'm Alphadex, your private assistant. I live entirely on your phone, so nothing you tell me ever leaves it. I can keep your reminders, tasks, notes and schedule, and chat with you. What would you like to do?";
  }
  if (/^(help|what can you do|what do you do|what can i ask you|what can i say|how do you work|commands|options)$/.test(t)) {
    return CAPABILITIES;
  }
  if (/^(good night|goodnight|night night)( alphadex)?$/.test(t)) {
    return `Good night${who}! Sleep well. Want me to set a reminder for tomorrow morning first?`;
  }
  if (/^(bye|goodbye|see you|see you later|talk later|cya|later)( alphadex)?$/.test(t)) {
    return "Bye! I'll be here whenever you need me.";
  }
  if (/^(ok|okay|cool|nice|great|awesome|got it|alright|sounds good|perfect|sure|alright then)$/.test(t)) {
    return pick(["Great! Let me know if there's anything else.", "Sounds good. Anything else on your list?", "Perfect. I'm here if you need me."]);
  }
  if (/^(good|fine|great|not bad|pretty good|i'm good|im good|i am good|i'm fine|im fine|i'm great|im great|doing good|doing well|all good)$/.test(t)) {
    return pick(["Glad to hear it! Anything I can help you get done?", "Nice! Want to plan anything for today?"]);
  }

  const feel = t.match(/^(?:i'm|im|i am|feeling|i feel) (?:so |really |very |a bit |kinda )?(stressed|anxious|overwhelmed|swamped|busy|tired|exhausted|sad|down|bored)$/);
  if (feel) {
    const f = feel[1];
    if (['stressed', 'overwhelmed', 'swamped', 'busy', 'anxious'].includes(f)) {
      return "That sounds like a lot. Want me to look at what's on your plate today and help you pick just one thing to start with?";
    }
    if (['tired', 'exhausted'].includes(f)) {
      return "Sounds like you could use a break. Want me to set a reminder to rest, or move something off today's list?";
    }
    if (['sad', 'down'].includes(f)) {
      return "I'm sorry you're feeling that way. I'm here to listen. What's on your mind?";
    }
    return "Let's fix that! Want a quick idea to try, or should we plan something fun?";
  }
  return null;
}
