// ── Friendly / funny error messages for users ─────────────

const ERROR_MAP: [RegExp, string][] = [
  [/invalid.*login|invalid.*credentials|invalid.*password|email.*not.*confirmed/i,
    "Wrong email or password. Did you misplace it like Amul misplaces its products? 🐄"],
  [/email.*already.*registered|user.*already.*registered|already.*been.*registered/i,
    "That email already has an account! Did you forget you signed up? Classic. Try logging in."],
  [/username.*taken|duplicate.*username|23505/i,
    "That username's taken. Be more creative — 'AmulPaglu420' is still available, probably."],
  [/password.*at least|password.*too.*short|weak.*password/i,
    "Your password is weaker than Amul Lite butter. Make it at least 8 characters strong."],
  [/network|fetch.*failed|failed to fetch|connection|offline|err_network/i,
    "Can't reach the server. Check your internet — or blame Amul's butter for clogging the cables. 🧈"],
  [/rate.*limit|too many.*request/i,
    "Whoa, slow down! You're clicking faster than Amul can churn butter. Take a breath. 🐄"],
  [/row.level.security|rls|permission denied|not authorized|policy/i,
    "Permission hiccup! We're sorting it out — please try again in a second."],
  [/timeout|timed.?out/i,
    "The server went to take a chai break ☕ — please try again."],
  [/jwt.*expired|token.*expired|session.*expired/i,
    "Your session expired. Even Amul butter has a shelf life — please sign in again."],
  [/invalid.*email|email.*invalid/i,
    "That doesn't look like a real email. Unless you're emailing a cow? 🐄"],
  [/signup.*disabled|registrations.*disabled/i,
    "Sign-ups are paused right now. The milk is still being processed."],
  [/email.*not.*confirmed/i,
    "Please confirm your email first — check your inbox (and spam, just in case)."],
]

const FALLBACKS = [
  "Something udderly went wrong 🐄 — please try again.",
  "The butter hit the fan. Refresh and try again.",
  "Oops! Even Amul makes mistakes sometimes. Retry?",
  "Houston, we have a dairy problem. Please try again.",
  "Yikes! That didn't churn out well. Try again?",
]

export function friendlyError(raw: string | null | undefined): string {
  if (!raw) return FALLBACKS[0]
  for (const [pattern, friendly] of ERROR_MAP) {
    if (pattern.test(raw)) return friendly
  }
  return FALLBACKS[Math.floor(Math.abs(raw.charCodeAt(0)) % FALLBACKS.length)]
}
