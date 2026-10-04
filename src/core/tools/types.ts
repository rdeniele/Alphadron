import type { Platform } from '../../platform/types';
import type { ArgsSchema } from './schema';

export interface ToolContext {
  now: Date;
  platform: Platform;
  memoryEnabled: boolean;
  /** Asks the user to approve an action. Resolves false if declined. */
  confirm: (message: string) => Promise<boolean>;
}

export interface ToolResult {
  ok: boolean;
  /** Plain-language outcome, e.g. "I'll remind you tomorrow at 9 AM." */
  summary: string;
  /** Short label for the UI status chip, e.g. "Reminder created". */
  chip: string;
  /** Structured result (for read tools, fed back to the model). */
  data?: unknown;
}

export interface Tool {
  name: string;
  description: string;
  args: ArgsSchema;
  /** Read-only tools get a second model pass to phrase the answer from real data. */
  readOnly: boolean;
  /** Requires explicit user confirmation before running. */
  sensitive?: boolean;
  run: (args: Record<string, string | number | boolean>, ctx: ToolContext) => Promise<ToolResult>;
}
