// ── Production-safe logger ─────────────────────────────────
// Only outputs in development mode (import.meta.env.DEV).
// In production builds, all calls are silent no-ops.

const isDev = import.meta.env.DEV

/* eslint-disable @typescript-eslint/no-explicit-any */
function noop(..._args: any[]) {}

export const logger = {
  warn:  isDev ? console.warn.bind(console)  : noop,
  error: isDev ? console.error.bind(console) : noop,
  info:  isDev ? console.info.bind(console)  : noop,
  log:   isDev ? console.log.bind(console)   : noop,
}
