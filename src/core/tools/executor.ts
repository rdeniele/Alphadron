import { validateArgs } from './schema';
import { TOOL_MAP } from './tools';
import type { ToolContext, ToolResult } from './types';
import { logActivity } from '../../database/repositories/conversationsRepo';

export interface ExecutedTool {
  tool: string;
  args: Record<string, unknown>;
  result: ToolResult;
  readOnly: boolean;
}

/**
 * The single gate every model-requested action passes through:
 * allow-list lookup -> argument validation -> confirmation (if sensitive) -> run.
 * Nothing the model emits is ever evaluated as code or a shell command.
 */
export async function executeTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ExecutedTool> {
  const tool = TOOL_MAP.get(name);
  if (!tool) {
    return {
      tool: name,
      args: {},
      readOnly: true,
      result: { ok: false, summary: `I can't do that yet.`, chip: 'Unknown tool' },
    };
  }
  const v = validateArgs(tool.args, rawArgs);
  if (!v.ok) {
    return {
      tool: name,
      args: {},
      readOnly: true,
      result: { ok: false, summary: `I couldn't do that. Some details were missing or unclear.`, chip: 'Invalid request' },
    };
  }
  if (tool.sensitive) {
    const detail = Object.entries(v.args).map(([k, val]) => `${k}: ${val}`).join('\n');
    const approved = await ctx.confirm(`Alphadron wants to run "${tool.name}"\n\n${detail}`);
    if (!approved) {
      return {
        tool: name,
        args: v.args,
        readOnly: true,
        result: { ok: false, summary: 'Okay, canceled.', chip: 'Canceled' },
      };
    }
  }
  try {
    const result = await tool.run(v.args, ctx);
    if (result.ok && !tool.readOnly) {
      await logActivity(result.chip, result.summary);
    }
    return { tool: name, args: v.args, result, readOnly: tool.readOnly };
  } catch (e) {
    return {
      tool: name,
      args: v.args,
      readOnly: true,
      result: { ok: false, summary: `Something went wrong: ${(e as Error).message}`, chip: 'Error' },
    };
  }
}
