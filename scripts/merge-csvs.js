#!/usr/bin/env node
// Usage: node scripts/merge-csvs.js file1.csv file2.csv ... > amul-merged.csv
// Deduplicates by product name (first occurrence wins).

const fs   = require('fs')
const path = require('path')

const rawArgs = process.argv.slice(2)
if (rawArgs.length === 0) {
  console.error('Usage: node scripts/merge-csvs.js file1.csv file2.csv ...')
  console.error('       node scripts/merge-csvs.js scripts\\amul-products-*.csv')
  process.exit(1)
}

// Expand any glob patterns (CMD doesn't expand them like bash/PowerShell)
const files = rawArgs.flatMap(arg => {
  if (!arg.includes('*') && !arg.includes('?')) return [arg]
  const dir     = path.dirname(arg)
  const pattern = path.basename(arg)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex special chars except * ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  const re = new RegExp('^' + pattern + '$', 'i')
  const absDir = path.resolve(dir)
  if (!fs.existsSync(absDir)) return []
  return fs.readdirSync(absDir)
    .filter(f => re.test(f))
    .map(f => path.join(absDir, f))
})

function parseCSV(text) {
  const lines  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const header = lines[0]
  const cols   = splitRow(header)
  const rows   = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = splitRow(line)
    const obj  = {}
    cols.forEach((c, idx) => { obj[c] = vals[idx] ?? '' })
    rows.push(obj)
  }
  return { cols, rows }
}

// Handles quoted fields with embedded commas/newlines
function splitRow(line) {
  const result = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"')                   { inQuote = false }
      else                                   { cur += ch }
    } else {
      if (ch === '"')  { inQuote = true }
      else if (ch === ',') { result.push(cur); cur = '' }
      else             { cur += ch }
    }
  }
  result.push(cur)
  return result
}

function escapeField(v) {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

const RARITY_TO_POINTS = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
}

const VALID_STATUS = new Set(['approved', 'pending', 'rejected'])

function normalizeRarity(value) {
  const v = String(value ?? '').trim().toLowerCase()
  if (v === 'legendary') return 'Legendary'
  if (v === 'epic') return 'Epic'
  if (v === 'rare') return 'Rare'
  if (v === 'uncommon') return 'Uncommon'
  return 'Common'
}

function normalizeStatus(value) {
  const v = String(value ?? '').trim().toLowerCase()
  return VALID_STATUS.has(v) ? v : 'pending'
}

function normalizePoints(row) {
  row.rarity_label = normalizeRarity(row.rarity_label)
  row.status = normalizeStatus(row.status)

  const byRarity = RARITY_TO_POINTS[String(row.rarity_label).toLowerCase()] ?? 1
  const raw = Number(row.points)
  const candidate = Number.isFinite(raw) ? Math.round(raw) : byRarity

  // Enforce strict game scale used by this app: 1..5 only.
  const clamped = Math.max(1, Math.min(5, candidate))
  row.points = String(clamped)
}

let cols    = null
const seen  = new Set()    // deduplicate by name
const merged = []

for (const file of files) {
  const absPath = path.resolve(file)
  if (!fs.existsSync(absPath)) {
    process.stderr.write(`[merge] Skipping missing file: ${absPath}\n`)
    continue
  }
  const text          = fs.readFileSync(absPath, 'utf8')
  const { cols: c, rows } = parseCSV(text)
  if (!cols) cols = c   // use first file's header order

  let added = 0
  for (const row of rows) {
    const key = (row.name ?? '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    normalizePoints(row)
    seen.add(key)
    merged.push(row)
    added++
  }
  process.stderr.write(`[merge] ${file}: ${rows.length} rows, ${added} new\n`)
}

if (!cols || merged.length === 0) {
  process.stderr.write('[merge] No products found.\n')
  process.exit(1)
}

// Output merged CSV to stdout
const out = [
  cols.join(','),
  ...merged.map(row => cols.map(c => escapeField(row[c])).join(','))
].join('\n')

process.stdout.write(out + '\n')
process.stderr.write(`[merge] Total unique products: ${merged.length}\n`)
