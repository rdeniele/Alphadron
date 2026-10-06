import { ModelNotReadyError, type AIProvider, type ChatTurn } from './AIProvider';
import { parseModelAction } from './parseOutput';
import { smallTalk } from './smallTalk';
import { buildResponseSchema, buildSystemPrompt, selectTools } from './prompt';
import { groundArgs } from './ground';
import { normalizeSpoken } from './spoken';
import { claimsAction, fastPath, resolvePending, type Pending } from './fastPath';
import { executeTool, type ExecutedTool } from '../tools/executor';
import { formatReadResult } from '../tools/format';
import { TOOLS } from '../tools/tools';
import type { ToolContext } from '../tools/types';
import { searchMemories } from '../../database/repositories/memoriesRepo';
import { listTasks } from '../../database/repositories/tasksRepo';
import { getPreference } from '../../database/repositories/settingsRepo';
import {
  addMessage,
  currentConversationId,
  listMessages,
  type ChatMessage,
} from '../../database/repositories/conversationsRepo';

export interface TurnResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  action: ExecutedTool | null;
  /** True when the instant rule-based path answered (no model was used). */
  instant: boolean;
}

export type TurnStatus = 'checking' | 'loading' | 'thinking' | 'acting';

export interface TurnDeps {
  provider: AIProvider;
  ctx: Omit<ToolContext, 'now'>;
  onStatus?: (status: TurnStatus) => void;
}

/** A question we asked and are waiting to have answered (expires so stale answers are not misread). */
let pending: { p: Pending; at: number } | null = null;
const PENDING_TTL_MS = 3 * 60 * 1000;

const schemaCache = new Map<string, object>();

function schemaFor(tools: typeof TOOLS): object {
  const key = tools.map(t => t.name).join(',');
  let s = schemaCache.get(key);
  if (!s) {
    s = buildResponseSchema(tools);
    schemaCache.set(key, s);
  }
  return s;
}

const NOT_DONE_NOTE =
  "I couldn't set that up. Try something like \"Remind me tomorrow at 9 AM to call John\", or use the + button to add it yourself.";

function replyFromAction(action: ExecutedTool): string {
  if (action.readOnly && action.result.ok && action.result.data !== undefined) {
    return formatReadResult(action.tool, action.result.data) ?? action.result.summary;
  }
  return action.result.summary;
}

/**
 * One full assistant turn. Common commands (reminders, tasks, notes, "what do I have
 * tomorrow") are answered instantly by rules + SQLite. Everything else goes to the
 * local model. History is stored; permanent memory is only written via save_memory.
 */
export async function runTurn(userText: string, deps: TurnDeps): Promise<TurnResult> {
  const now = new Date();
  const convId = await currentConversationId();
  const userMessage = await addMessage(convId, 'user', userText);

  const finish = async (reply: string, action: ExecutedTool | null, instant: boolean): Promise<TurnResult> => {
    const toolJson = action
      ? JSON.stringify({ tool: action.tool, ok: action.result.ok, chip: action.result.chip })
      : null;
    const assistantMessage = await addMessage(convId, 'assistant', reply, toolJson);
    return { userMessage, assistantMessage, action, instant };
  };

  // ---- Instant path: no model needed ----
  deps.onStatus?.('checking');

  // 1) Is the user answering a question we just asked ("When should I remind you?")
  const stillWaiting = pending && now.getTime() - pending.at < PENDING_TTL_MS ? pending.p : null;
  pending = null;
  if (stillWaiting) {
    const answer = resolvePending(stillWaiting, userText);
    if (answer === 'cancel') {
      return finish("No problem, I've dropped that. What else can I do for you?", null, true);
    }
    if (answer?.kind === 'tool') {
      deps.onStatus?.('acting');
      const action = await executeTool(answer.tool, answer.args, { ...deps.ctx, now });
      return finish(replyFromAction(action), action, true);
    }
  }

  // 2) A direct command (reminder, task, note, "what do I have tomorrow"...)
  const fast = fastPath(userText);
  if (fast?.kind === 'reply') {
    if (fast.pending) {
      pending = { p: fast.pending, at: now.getTime() };
    }
    return finish(fast.text, null, true);
  }
  if (fast?.kind === 'tool') {
    deps.onStatus?.('acting');
    const action = await executeTool(fast.tool, fast.args, { ...deps.ctx, now });
    return finish(replyFromAction(action), action, true);
  }

  // 3) Everyday chit-chat gets an instant, friendly reply
  const chat = smallTalk(userText, { name: await getPreference('user_name'), hour: now.getHours() });
  if (chat) {
    return finish(chat, null, true);
  }

  // ---- Model path ---- (the model and grounding see spoken-normalised text)
  const heard = normalizeSpoken(userText);
  const history = (await listMessages(convId, 8))
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.id !== userMessage.id)
    .slice(-6)
    .map<ChatTurn>(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 240) }));

  // Offer only the tools this request could plausibly need (fewer choices = fewer mistakes).
  const offered = selectTools(TOOLS, heard);

  const [memories, openTasks, userName] = await Promise.all([
    deps.ctx.memoryEnabled ? searchMemories(heard, 4) : Promise.resolve([]),
    listTasks({ status: 'open' }),
    getPreference('user_name'),
  ]);

  const system = buildSystemPrompt({
    tools: offered,
    now,
    memories: memories.map(m => m.content),
    openTaskCount: openTasks.length,
    userName,
  });
  const messages: ChatTurn[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: heard }];

  if (!deps.provider.isLoaded()) {
    deps.onStatus?.('loading');
  }
  try {
    await deps.provider.load();
  } catch (e) {
    if (e instanceof ModelNotReadyError) {
      return finish(
        "I can still set reminders, tasks and notes without the AI brain. For open chat, though, I need it: download it in Settings (about 400 MB, one time).",
        null,
        true,
      );
    }
    throw e;
  }
  deps.onStatus?.('thinking');

  const raw = await deps.provider.generateJson(messages, schemaFor(offered), { maxTokens: 150, temperature: 0.45 });
  const parsed = parseModelAction(raw);

  if (!parsed) {
    const text = (await deps.provider.generateText(messages, { maxTokens: 120 })) || "Sorry, I didn't understand that.";
    return finish(claimsAction(text) ? NOT_DONE_NOTE : text, null, false);
  }
  if (parsed.kind === 'reply') {
    const text = parsed.reply.trim() || "I'm not sure how to help with that.";
    // A model that says "Done, I set a reminder" without calling a tool did nothing.
    return finish(claimsAction(text) ? NOT_DONE_NOTE : text, null, false);
  }

  deps.onStatus?.('acting');
  const rawArgs = parsed.arguments && typeof parsed.arguments === 'object' ? (parsed.arguments as Record<string, unknown>) : {};
  const args = groundArgs(parsed.tool, rawArgs, heard);
  const action = await executeTool(parsed.tool, args, { ...deps.ctx, now });
  return finish(replyFromAction(action), action, false);
}
