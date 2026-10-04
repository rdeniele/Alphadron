/** Heuristic detection of content that must not become permanent memory without consent. */

const PATTERNS: RegExp[] = [
  /\bpass(word|code|phrase)\b/i,
  /\bpin( code| number)?\b/i,
  /\b(cvv|cvc|security code)\b/i,
  /\b(ssn|social security|passport (number|no)|national id|tax id)\b/i,
  /\b(api[ _-]?key|secret key|private key|access token|auth token|seed phrase|recovery phrase)\b/i,
  /\b(credit|debit) card\b/i,
  /\b(?:\d[ -]?){13,19}\b/, // card-like number
  /\b(bank account|routing number|iban)\b/i,
  /\b(diagnos|prescription|medical condition|medication)\w*/i,
];

export function looksSensitive(text: string): boolean {
  return PATTERNS.some(p => p.test(text));
}
