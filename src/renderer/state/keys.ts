// Shared keyboard helpers for the single global keydown router (M9 W1).
// One window-level capture-phase listener lives in App; xterm.js greedily eats keys
// from its focused helper-textarea, and capture fires before it, so app shortcuts win.

/** True when the event targets a real editable field we should NOT hijack.
 *  xterm's hidden helper-textarea is explicitly excluded — app shortcuts (Cmd+K,
 *  Cmd+1..9, Cmd+[/]) must still work while a terminal is focused, which is exactly
 *  when the user needs them. */
export function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el || !el.tagName) return false
  if (el.classList?.contains('xterm-helper-textarea')) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true
}

/** Case-insensitive subsequence match — every char of `q` appears in `text` in order.
 *  Empty query matches everything. Powers the command palette filter. */
export function fuzzyMatch(text: string, q: string): boolean {
  if (!q) return true
  const t = text.toLowerCase()
  const query = q.toLowerCase()
  let i = 0
  for (let j = 0; j < t.length && i < query.length; j++) {
    if (t[j] === query[i]) i++
  }
  return i === query.length
}
