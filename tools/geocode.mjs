// One-off / repeatable geocoder for site addresses.
// Uses the free US Census Bureau batch geocoder (no API key required).
// Adds `lat` / `lng` to site rows in src/projects.json.
//
// Run from the project root:  node tools/geocode.mjs
//
// Census batch API: POST CSV of (id, street, city, state, zip),
// returns CSV with a "lon,lat" coordinate field for matched rows.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, '..', 'src', 'projects.json')

const rows = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

// Parse "STREET, City, State Zip" -> { street, city, zip } using the row's
// 2-letter `state` for reliability and a 5-digit zip match.
function parseAddress(row) {
  const addr = (row.address || '').trim()
  if (!addr) return null
  const parts = addr.split(',').map(s => s.trim())
  const street = parts[0] || ''
  const city = parts.length >= 3 ? parts[1] : (parts[1] || '')
  const zipMatch = addr.match(/\b(\d{5})(?:-\d{4})?\b/)
  const zip = zipMatch ? zipMatch[1] : ''
  if (!street || !city) return null
  return { street, city, state: row.state || '', zip }
}

// Build the batch over site-level rows that have a parseable address.
const targets = []
rows.forEach((row, idx) => {
  if (row.isProjectRollup) return
  const p = parseAddress(row)
  if (p) targets.push({ idx, ...p })
})

console.log(`Geocoding ${targets.length} site addresses via US Census batch geocoder...`)

function csvField(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Census batch caps at 10,000 records per request; chunk to be safe.
const CHUNK = 5000
const coordsByIdx = {}

// Minimal CSV line parser that respects double-quoted fields.
function parseCsvLine(line) {
  const out = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQ = false
      else cur += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
  }
  out.push(cur)
  return out
}

async function geocodeChunk(chunk) {
  const csv = chunk
    .map(t => [t.idx, csvField(t.street), csvField(t.city), csvField(t.state), csvField(t.zip)].join(','))
    .join('\n')

  const form = new FormData()
  form.append('benchmark', 'Public_AR_Current')
  form.append('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv')

  const res = await fetch('https://geocoding.geo.census.gov/geocoder/locations/addressbatch', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(`Census API HTTP ${res.status}`)
  const text = await res.text()

  let matched = 0
  text.split('\n').forEach(line => {
    if (!line.trim()) return
    const f = parseCsvLine(line)
    // f: [id, inputAddr, matchStatus, matchType, matchedAddr, "lon,lat", tigerId, side]
    const id = parseInt(f[0], 10)
    const status = f[2]
    if (status === 'Match' && f[5]) {
      const [lon, lat] = f[5].split(',').map(Number)
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        coordsByIdx[id] = { lat, lng: lon }
        matched++
      }
    }
  })
  return matched
}

let totalMatched = 0
for (let i = 0; i < targets.length; i += CHUNK) {
  const chunk = targets.slice(i, i + CHUNK)
  const m = await geocodeChunk(chunk)
  totalMatched += m
  console.log(`  chunk ${i / CHUNK + 1}: ${m}/${chunk.length} matched`)
}

// Write coordinates back with a line-based insertion that preserves the
// existing file format exactly (each field on its own line, floats like 0.0)
// and only adds lat/lng to matched rows.
const raw = fs.readFileSync(dataPath, 'utf8')
const srcLines = raw.split(/\r?\n/)
const out = []
let objIndex = -1
let written = 0

for (const line of srcLines) {
  const t = line.trim()
  if (t === '{') {
    objIndex++
    out.push(line)
    continue
  }
  if (t === '}' || t === '},') {
    const c = coordsByIdx[objIndex]
    if (c) {
      // append a comma to the previous (last) field line, then add coords
      out[out.length - 1] = out[out.length - 1] + ','
      out.push(`"lat":${c.lat},`)
      out.push(`"lng":${c.lng}`)
      written++
    }
  }
  out.push(line)
}

fs.writeFileSync(dataPath, out.join('\n'))

const unmatched = targets.filter(t => !coordsByIdx[t.idx])
console.log(`\nDone. Matched ${totalMatched}/${targets.length} (${written} rows updated).`)
if (unmatched.length) {
  console.log(`Unmatched (${unmatched.length}) sample:`)
  unmatched.slice(0, 10).forEach(t => console.log(`  [${t.state}] ${t.street}, ${t.city} ${t.zip}`))
}
