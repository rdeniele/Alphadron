/** Minimal argument schema + validator. Pure (no React Native imports) so it is unit-testable. */

export type ArgType = 'string' | 'number' | 'boolean';

export interface ArgSpec {
  type: ArgType;
  description: string;
  required?: boolean;
  enum?: readonly string[];
  maxLength?: number;
}

export type ArgsSchema = Record<string, ArgSpec>;

export type ValidationResult =
  | { ok: true; args: Record<string, string | number | boolean> }
  | { ok: false; error: string };

const MAX_STRING = 2000;

export function validateArgs(schema: ArgsSchema, raw: unknown): ValidationResult {
  if (raw === undefined || raw === null) {
    raw = {};
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'arguments must be an object' };
  }
  const input = raw as Record<string, unknown>;
  const out: Record<string, string | number | boolean> = {};

  for (const key of Object.keys(input)) {
    if (!(key in schema)) {
      return { ok: false, error: `unknown argument "${key}"` };
    }
  }
  for (const [key, spec] of Object.entries(schema)) {
    let v = input[key];
    if (v === undefined || v === null || v === '') {
      if (spec.required) {
        return { ok: false, error: `missing required argument "${key}"` };
      }
      continue;
    }
    // Small models often emit numbers as strings and vice versa; coerce safely.
    if (spec.type === 'number' && typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      v = Number(v);
    }
    if (spec.type === 'string' && typeof v === 'number') {
      v = String(v);
    }
    if (typeof v !== spec.type) {
      return { ok: false, error: `argument "${key}" must be a ${spec.type}` };
    }
    if (spec.type === 'string') {
      const s = (v as string).trim();
      if (s.length > (spec.maxLength ?? MAX_STRING)) {
        return { ok: false, error: `argument "${key}" is too long` };
      }
      if (spec.enum && !spec.enum.includes(s.toLowerCase())) {
        return { ok: false, error: `argument "${key}" must be one of: ${spec.enum.join(', ')}` };
      }
      out[key] = spec.enum ? s.toLowerCase() : s;
    } else if (spec.type === 'number') {
      if (!Number.isFinite(v as number)) {
        return { ok: false, error: `argument "${key}" must be a finite number` };
      }
      out[key] = v as number;
    } else {
      out[key] = v as boolean;
    }
  }
  return { ok: true, args: out };
}

/** JSON Schema for one tool's arguments, used for grammar-constrained decoding. */
export function argsToJsonSchema(schema: ArgsSchema): object {
  const properties: Record<string, object> = {};
  const required: string[] = [];
  for (const [key, spec] of Object.entries(schema)) {
    properties[key] = spec.enum ? { type: 'string', enum: [...spec.enum] } : { type: spec.type };
    if (spec.required) {
      required.push(key);
    }
  }
  return { type: 'object', properties, required, additionalProperties: false };
}
