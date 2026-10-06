/**
 * Final clean-up for anything the assistant says: no em or en dashes in replies,
 * even if the language model writes them. Pure.
 */
export function polishReply(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2') // number ranges: 9–5 -> 9-5
    .replace(/\s*[–—]\s*/g, ', ') // clause breaks: "yes — sure" -> "yes, sure"
    .replace(/,\s*,/g, ',')
    .replace(/\s+([,.!?])/g, '$1');
}
