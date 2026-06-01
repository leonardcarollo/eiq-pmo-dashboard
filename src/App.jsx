import { useState, useMemo, useEffect, useRef } from 'react'
import * as d3 from 'd3'
import * as topojson from 'topojson-client'
import projects from './projects.json'
import eoMeasures from './eo_measures.json'
import projectOutlook from './project_outlook.json'
import './App.css'

const TECH_CONFIG = [
  { key: 'hasBESS', label: 'BESS', color: '#557F7F' },
  { key: 'hasBackupGen', label: 'Backup Gen', color: '#092B24' },
  { key: 'hasExistingGen', label: 'Existing Gen', color: '#7A9D9D' },
  { key: 'hasFacilitiesDM', label: 'Facilities DM', color: '#3d5e5e' },
  { key: 'hasSolar', label: 'Solar', color: '#D6EF4B' },
]

const PER_PAGE = 15

// PMO status derived from existing fields. Ordered for display.
// Layer a maintained pmo_status.json override on top of this later if richer
// tracking (owner, % complete, target dates) is needed.
const STATUS_CONFIG = [
  { key: 'active', label: 'Active', color: '#557F7F', cls: 'status-active' },
  { key: 'delivery', label: 'In Delivery', color: '#185FA5', cls: 'status-delivery' },
  { key: 'indicative', label: 'Indicative', color: '#C8862B', cls: 'status-indicative' },
  { key: 'closed', label: 'Closed', color: '#092B24', cls: 'status-closed' },
]

function deriveStatus(r) {
  const phase = (r.phase || '').trim()
  if (phase === 'Closed' || r.closedDate) return 'closed'
  if (phase === 'EO v1' || phase === 'EO v2') return 'delivery'
  if (phase === 'Indicative') return 'indicative'
  return 'active'
}

function unique(arr, key) {
  return [...new Set(arr.map(r => r[key]).filter(Boolean))].sort()
}

// Format kW intelligently. Under 1000 shows kW, 1000+ shows MW with one decimal.
function formatPower(kw) {
  if (!kw) return '—'
  if (kw < 1000) return `${Math.round(kw).toLocaleString()} kW`
  return `${(kw / 1000).toFixed(1)} MW`
}

export default function App() {
  const [search, setSearch] = useState('')
  const [iso, setIso] = useState('')
  const [phase, setPhase] = useState('')
  const [type, setType] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [activeTechs, setActiveTechs] = useState(new Set())
  const [tab, setTab] = useState('overview')
  const [page, setPage] = useState(0)

  const isoOptions = useMemo(() => unique(projects, 'iso'), [])
  const phaseOptions = useMemo(() => unique(projects, 'phase'), [])
  const typeOptions = useMemo(() => unique(projects, 'clientType'), [])
  const stateOptions = useMemo(() => unique(projects, 'state'), [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projects.filter(r => {
      if (q && !`${r.client} ${r.site} ${r.state} ${r.iso} ${r.utility} ${r.project}`.toLowerCase().includes(q)) return false
      if (iso && r.iso !== iso) return false
      if (phase && r.phase !== phase) return false
      if (type && r.clientType !== type) return false
      if (stateFilter && r.state !== stateFilter) return false
      for (const t of activeTechs) if (!r[t]) return false
      return true
    })
  }, [search, iso, phase, type, stateFilter, activeTechs])

  useEffect(() => { setPage(0) }, [filtered])

  const totalDemand = filtered.filter(r => r.site !== 'Enterprise').reduce((s, r) => s + r.peakDemand, 0)
  const totalBESS = filtered.reduce((s, r) => s + r.bessNameplate, 0)
  const totalSolar = filtered.reduce((s, r) => s + r.solarNameplate, 0)
  const clientCount = new Set(filtered.map(r => r.client)).size

  const toggleTech = (key) => {
    const next = new Set(activeTechs)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setActiveTechs(next)
  }

  const jumpToTable = (state) => {
    setStateFilter(state)
    setTab('table')
  }

  // Show filters bar only on tabs that use it
  const filtersApply = ['map', 'table', 'clients', 'charts'].includes(tab)

  return (
    <div className="app">
      <header>
        <div className="brand-bar">
          <div className="brand-mark" />
          <div>
            <h1>EIQ — ENFRA PMO Dashboard</h1>
            <p className="subtitle">Q1 update · 490 sites across 51 clients</p>
          </div>
        </div>
      </header>

      {filtersApply && (
        <>
          <div className="top-bar">
            <input
              type="text"
              placeholder="Search client, site, state, ISO..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select value={iso} onChange={e => setIso(e.target.value)}>
              <option value="">All ISOs</option>
              {isoOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={phase} onChange={e => setPhase(e.target.value)}>
              <option value="">All phases</option>
              {phaseOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="">All types</option>
              {typeOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
              <option value="">All states</option>
              {stateOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="tech-pills">
            {TECH_CONFIG.map(t => {
              const count = projects.filter(r => r[t.key]).length
              const active = activeTechs.has(t.key)
              return (
                <button
                  key={t.key}
                  className={`pill ${active ? 'active' : ''}`}
                  onClick={() => toggleTech(t.key)}
                >
                  <span className="dot" style={{ background: t.color }} />
                  {t.label}
                  <span className="count-badge">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="metrics">
            <Metric label="Sites shown" value={filtered.length} sub={`of ${projects.length} total`} />
            <Metric label="Clients" value={clientCount} sub="unique" />
            <Metric label="Peak demand" value={formatPower(totalDemand)} sub="aggregate nameplate" />
            <Metric label="BESS + Solar" value={formatPower(totalBESS + totalSolar)} sub="combined" />
          </div>
        </>
      )}

      <div className="tabs">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'projects', label: 'Projects' },
          { id: 'map', label: 'Map' },
          { id: 'table', label: 'Sites' },
          { id: 'clients', label: 'Clients' },
          { id: 'charts', label: 'Analytics' },
          { id: 'eo', label: 'EO Measures' },
          { id: 'outlook', label: 'Project Outlook' },
        ].map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setPage(0) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'overview' && <OverviewView setTab={setTab} />}
        {tab === 'projects' && <ProjectsView />}
        {tab === 'table' && <SitesTable rows={filtered} page={page} setPage={setPage} />}
        {tab === 'clients' && <ClientsTable rows={filtered} page={page} setPage={setPage} />}
        {tab === 'charts' && <ChartsView rows={filtered} />}
        {tab === 'map' && <MapView rows={filtered} jumpToTable={jumpToTable} />}
        {tab === 'eo' && <EOMeasuresView />}
        {tab === 'outlook' && <ProjectOutlookView />}
      </div>

      <footer>
        <p>Data source: CPower Project List Q1 · Built for ENFRA Solutions</p>
      </footer>
    </div>
  )
}

// PMO Projects — status board over the 58 project rollups
function ProjectsView() {
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState('')
  const [page, setPage] = useState(0)

  const allProjects = useMemo(
    () => projects.filter(r => r.isProjectRollup).map(r => ({ ...r, _status: deriveStatus(r) })),
    []
  )

  const statusCounts = useMemo(() => {
    const c = {}
    allProjects.forEach(r => { c[r._status] = (c[r._status] || 0) + 1 })
    return c
  }, [allProjects])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allProjects.filter(r => {
      if (activeStatus && r._status !== activeStatus) return false
      if (q && !`${r.project} ${r.clientType} ${r.iso}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allProjects, search, activeStatus])

  useEffect(() => { setPage(0) }, [search, activeStatus])

  const start = page * PER_PAGE
  const slice = filtered.slice(start, start + PER_PAGE)

  return (
    <>
      <div className="sub-toolbar">
        <input
          type="text"
          className="sub-search"
          placeholder="Search project, client type, ISO..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="tech-pills" style={{ marginTop: 8 }}>
        {STATUS_CONFIG.map(s => (
          <button
            key={s.key}
            className={`pill ${activeStatus === s.key ? 'active' : ''}`}
            onClick={() => setActiveStatus(activeStatus === s.key ? '' : s.key)}
          >
            <span className="dot" style={{ background: s.color }} />
            {s.label}
            <span className="count-badge">{statusCounts[s.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Project</th><th>Type</th><th>ISO</th>
              <th>Peak Demand</th><th>Closed Date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => {
              const cfg = STATUS_CONFIG.find(s => s.key === r._status)
              return (
                <tr key={i}>
                  <td title={r.project}><strong>{r.project}</strong></td>
                  <td>{r.clientType || '—'}</td>
                  <td>{r.iso || '—'}</td>
                  <td>{formatPower(r.peakDemand)}</td>
                  <td>{r.closedDate || '—'}</td>
                  <td><span className={`phase-badge ${cfg.cls}`}>{cfg.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} setPage={setPage} total={filtered.length} />
    </>
  )
}

// PMO Overview — portfolio-level landing summary across the whole dataset
function OverviewView({ setTab }) {
  const stats = useMemo(() => {
    const sites = projects.filter(r => !r.isProjectRollup)
    const projectCount = projects.filter(r => r.isProjectRollup).length || new Set(projects.map(r => r.project).filter(Boolean)).size
    const clientCount = new Set(projects.map(r => r.client)).size
    const peakDemand = sites.filter(r => r.site !== 'Enterprise').reduce((s, r) => s + (r.peakDemand || 0), 0)
    const bessSolar = projects.reduce((s, r) => s + (r.bessNameplate || 0) + (r.solarNameplate || 0), 0)

    const phaseCount = {}
    projects.forEach(r => { const k = r.phase || 'Unphased'; phaseCount[k] = (phaseCount[k] || 0) + 1 })
    const phaseArr = Object.entries(phaseCount).sort((a, b) => b[1] - a[1])

    const typeCount = {}
    sites.forEach(r => { const k = r.clientType || 'Other'; typeCount[k] = (typeCount[k] || 0) + 1 })
    const typeArr = Object.entries(typeCount).sort((a, b) => b[1] - a[1])

    // Upcoming projected closings, sorted by date (skip N/A / blanks)
    const upcoming = projectOutlook
      .filter(p => p.projectedClosingDate && p.projectedClosingDate !== 'N/A')
      .sort((a, b) => String(a.projectedClosingDate).localeCompare(String(b.projectedClosingDate)))

    return { sites: sites.length, projectCount, clientCount, peakDemand, bessSolar, phaseArr, typeArr, upcoming }
  }, [])

  return (
    <div className="overview">
      <div className="metrics">
        <Metric label="Projects" value={stats.projectCount} sub="project rollups" />
        <Metric label="Clients" value={stats.clientCount} sub="unique" />
        <Metric label="Sites" value={stats.sites} sub="across portfolio" />
        <Metric label="Peak demand" value={formatPower(stats.peakDemand)} sub="aggregate nameplate" />
        <Metric label="BESS + Solar" value={formatPower(stats.bessSolar)} sub="combined nameplate" />
      </div>

      <div className="charts-grid" style={{ marginTop: 16 }}>
        <BarChart title="Pipeline by phase" data={stats.phaseArr} color="#557F7F" />
        <BarChart title="Portfolio by client type" data={stats.typeArr} color="#3d5e5e" />
      </div>

      <div className="outlook-header" style={{ marginTop: 8 }}>
        <h3>Upcoming projected closings</h3>
        <p>{stats.upcoming.length} project{stats.upcoming.length !== 1 ? 's' : ''} with a projected closing date</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Project</th><th>Utility</th><th>ISO</th><th>Projected Closing</th></tr>
          </thead>
          <tbody>
            {stats.upcoming.map((p, i) => (
              <tr key={i}>
                <td title={p.project}>{p.project || '—'}</td>
                <td>{p.utility || '—'}</td>
                <td>{p.iso || '—'}</td>
                <td>{p.projectedClosingDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="state-panel-footer" style={{ marginTop: 8 }}>
        <button className="primary-btn" onClick={() => setTab('outlook')}>View full project outlook →</button>
      </div>
    </div>
  )
}

function Metric({ label, value, sub }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  )
}

function phaseClass(p) {
  if (!p) return ''
  return 'phase-' + p.replace(/\s+/g, '')
}

function TechDots({ row }) {
  return (
    <span>
      {TECH_CONFIG.filter(t => row[t.key]).map(t => (
        <span
          key={t.key}
          className="tech-dot"
          style={{ background: t.color }}
          title={t.label}
        />
      ))}
    </span>
  )
}

function Pagination({ page, setPage, total }) {
  const totalPages = Math.ceil(total / PER_PAGE)
  return (
    <div className="pagination">
      <button onClick={() => setPage(page - 1)} disabled={page === 0}>← Prev</button>
      <span>Page {page + 1} of {totalPages || 1} · {total} rows</span>
      <button onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>Next →</button>
    </div>
  )
}

function SitesTable({ rows, page, setPage }) {
  const start = page * PER_PAGE
  const slice = rows.slice(start, start + PER_PAGE)
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th><th>Site</th><th>State</th><th>ISO</th>
              <th>Peak Demand</th><th>Phase</th><th>Tech</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i}>
                <td title={r.client}>{r.client}</td>
                <td title={r.site}>{r.site}</td>
                <td>{r.state || '—'}</td>
                <td>{r.iso || '—'}</td>
                <td>{formatPower(r.peakDemand)}</td>
                <td>{r.phase ? <span className={`phase-badge ${phaseClass(r.phase)}`}>{r.phase}</span> : '—'}</td>
                <td><TechDots row={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} setPage={setPage} total={rows.length} />
    </>
  )
}

function ClientsTable({ rows, page, setPage }) {
  const clients = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      if (!map[r.client]) {
        map[r.client] = { client: r.client, type: r.clientType, sites: 0, totalDemand: 0, states: new Set(), isos: new Set(), techs: new Set() }
      }
      const c = map[r.client]
      c.sites++
      c.totalDemand += r.peakDemand
      if (r.state) c.states.add(r.state)
      if (r.iso) c.isos.add(r.iso.split('/')[0])
      TECH_CONFIG.forEach(t => { if (r[t.key]) c.techs.add(t.label) })
    })
    return Object.values(map).sort((a, b) => b.totalDemand - a.totalDemand)
  }, [rows])

  const start = page * PER_PAGE
  const slice = clients.slice(start, start + PER_PAGE)

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Client</th><th>Type</th><th>Sites</th><th>States</th><th>ISO</th><th>Peak Demand</th><th>Tech</th></tr>
          </thead>
          <tbody>
            {slice.map((c, i) => (
              <tr key={i}>
                <td><strong>{c.client}</strong></td>
                <td>{c.type}</td>
                <td>{c.sites}</td>
                <td>{[...c.states].join(', ') || '—'}</td>
                <td>{[...c.isos].join(', ') || '—'}</td>
                <td>{formatPower(c.totalDemand)}</td>
                <td className="small">{[...c.techs].join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} setPage={setPage} total={clients.length} />
    </>
  )
}

function ChartsView({ rows }) {
  const isoCount = {}
  rows.forEach(r => { if (r.iso) { const k = r.iso.split('/')[0]; isoCount[k] = (isoCount[k] || 0) + 1 } })
  const isoArr = Object.entries(isoCount).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const stateCount = {}
  rows.forEach(r => { if (r.state) stateCount[r.state] = (stateCount[r.state] || 0) + 1 })
  const stateArr = Object.entries(stateCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const techCounts = TECH_CONFIG.map(t => ({ ...t, count: rows.filter(r => r[t.key]).length }))

  const phaseCount = {}
  rows.forEach(r => { const k = r.phase || 'Unknown'; phaseCount[k] = (phaseCount[k] || 0) + 1 })
  const phaseArr = Object.entries(phaseCount).sort((a, b) => b[1] - a[1])

  return (
    <div className="charts-grid">
      <BarChart title="Sites by ISO" data={isoArr} color="#557F7F" />
      <BarChart title="Sites by state (top 10)" data={stateArr} color="#3d5e5e" />
      <BarChart title="Technology deployment" data={techCounts.map(t => [t.label, t.count])} colors={techCounts.map(t => t.color)} />
      <BarChart title="Pipeline phases" data={phaseArr} color="#092B24" />
    </div>
  )
}

function BarChart({ title, data, color, colors }) {
  const max = Math.max(...data.map(d => d[1]), 1)
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      {data.map(([k, v], i) => (
        <div className="bar-row" key={k}>
          <div className="bar-label">{k}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(v / max * 100).toFixed(1)}%`, background: colors ? colors[i] : color }}
            />
          </div>
          <div className="bar-val">{v}</div>
        </div>
      ))}
    </div>
  )
}

// EO Measures view — operational dates, kW values per measure type, market participation
function EOMeasuresView() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [techFilter, setTechFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return eoMeasures.filter(r => {
      if (q && !`${r.project} ${r.site} ${r.iso} ${r.utility}`.toLowerCase().includes(q)) return false
      if (techFilter === 'newBackup' && !r.newBackupGenDR) return false
      if (techFilter === 'bess' && !r.bessDR) return false
      if (techFilter === 'existingBackup' && !r.existingBackupGenDR) return false
      if (techFilter === 'hvac' && !r.hvacDR) return false
      if (techFilter === 'fuelSwitch' && !r.fuelSwitchingDR) return false
      if (techFilter === 'solar' && !r.solarIncluded) return false
      return true
    })
  }, [search, techFilter])

  useEffect(() => { setPage(0) }, [search, techFilter])

  const start = page * PER_PAGE
  const slice = filtered.slice(start, start + PER_PAGE)

  // Aggregate kW totals (nameplate; _NP fields)
  const totals = filtered.reduce((acc, r) => {
    acc.newBackup += r.newBackupGenKW_NP || 0
    acc.bess += r.bessKW_NP || 0
    acc.existingBackup += r.existingBackupGenKW_NP || 0
    acc.hvac += r.hvacKW_NP || 0
    acc.fuelSwitch += r.fuelSwitchingKW_NP || 0
    acc.solar += r.solarKW_NP || 0
    return acc
  }, { newBackup: 0, bess: 0, existingBackup: 0, hvac: 0, fuelSwitch: 0, solar: 0 })

  return (
    <>
      <div className="sub-toolbar">
        <input
          type="text"
          className="sub-search"
          placeholder="Search project, site, utility..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={techFilter} onChange={e => setTechFilter(e.target.value)}>
          <option value="all">All measures</option>
          <option value="newBackup">New Backup Gen</option>
          <option value="bess">BESS</option>
          <option value="existingBackup">Existing Backup Gen</option>
          <option value="hvac">HVAC</option>
          <option value="fuelSwitch">Fuel Switching</option>
          <option value="solar">Solar</option>
        </select>
      </div>

      <div className="metrics" style={{ marginTop: 8, gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <Metric label="New Backup" value={formatPower(totals.newBackup)} sub="kW total" />
        <Metric label="BESS" value={formatPower(totals.bess)} sub="kW total" />
        <Metric label="Existing Backup" value={formatPower(totals.existingBackup)} sub="kW total" />
        <Metric label="HVAC" value={formatPower(totals.hvac)} sub="kW total" />
        <Metric label="Fuel Switching" value={formatPower(totals.fuelSwitch)} sub="kW total" />
        <Metric label="Solar" value={formatPower(totals.solar)} sub="kW total" />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th><th>Site</th><th>ISO</th><th>Utility</th>
              <th>BESS Op Date</th><th>BESS kW</th>
              <th>Backup Op Date</th><th>Backup kW</th>
              <th>Solar Op Date</th><th>Solar kW</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i}>
                <td title={r.project}>{r.project || '—'}</td>
                <td title={r.site}>{r.site || '—'}</td>
                <td>{r.iso || '—'}</td>
                <td>{r.utility || '—'}</td>
                <td>{r.bessOpDate || '—'}</td>
                <td>{r.bessKW_NP ? formatPower(r.bessKW_NP) : '—'}</td>
                <td>{r.newBackupGenOpDate || r.existingBackupGenOpDate || '—'}</td>
                <td>{(r.newBackupGenKW_NP || r.existingBackupGenKW_NP) ? formatPower(r.newBackupGenKW_NP || r.existingBackupGenKW_NP) : '—'}</td>
                <td>{r.solarOpDate || '—'}</td>
                <td>{r.solarKW_NP ? formatPower(r.solarKW_NP) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} setPage={setPage} total={filtered.length} />
    </>
  )
}

// Project Outlook view — projected closings, future technologies
function ProjectOutlookView() {
  return (
    <>
      <div className="outlook-header">
        <h3>Projected Pipeline</h3>
        <p>Future projects with expected closing dates and technology mix</p>
      </div>
      <div className="outlook-grid">
        {projectOutlook.map((p, i) => (
          <div className="outlook-card" key={i}>
            <div className="outlook-card-header">
              <div>
                <div className="outlook-project">{p.project}</div>
                <div className="outlook-utility">{p.utility} · {p.iso || 'No ISO'}</div>
              </div>
              {p.projectedClosingDate && p.projectedClosingDate !== 'N/A' && (
                <div className="outlook-closing">{p.projectedClosingDate}</div>
              )}
            </div>
            <div className="outlook-techs">
              {parseYesNo(p.projectedBessDR) === 'yes' && <OutlookBadge label="BESS" date={p.projectedBessOpDate} included />}
              {parseYesNo(p.projectedBessDR) === 'no' && <OutlookBadge label="BESS" included={false} />}
              {parseYesNo(p.projectedBackupGenDR) === 'yes' && <OutlookBadge label="New Backup" date={p.projectedBackupGenOpDate} included />}
              {parseYesNo(p.projectedBackupGenDR) === 'no' && <OutlookBadge label="New Backup" included={false} />}
              {parseYesNo(p.projectedExistingGenDR) === 'yes' && <OutlookBadge label="Existing Backup" date={p.projectedExistingGenOpDate} included />}
              {parseYesNo(p.projectedExistingGenDR) === 'no' && <OutlookBadge label="Existing Backup" included={false} />}
              {parseYesNo(p.projectedFacilityDM) === 'yes' && <OutlookBadge label="Facility DM" date={p.projectedFacilityDMOpDate} included />}
              {parseYesNo(p.projectedFacilityDM) === 'no' && <OutlookBadge label="Facility DM" included={false} />}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function parseYesNo(v) {
  if (!v) return 'unknown'
  const s = String(v).toLowerCase().trim()
  if (s === 'yes' || s === '1') return 'yes'
  if (s === 'no' || s === '0') return 'no'
  return 'unknown'
}

function OutlookBadge({ label, date, included }) {
  return (
    <div className={`outlook-badge ${included ? 'included' : 'excluded'}`}>
      <span className="outlook-badge-label">{label}</span>
      {included && date && date !== 'N/A' && <span className="outlook-badge-date">{date}</span>}
      {!included && <span className="outlook-badge-date">Not included</span>}
    </div>
  )
}

const STATE_FIPS = { AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56' }
const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' }

function MapView({ rows, jumpToTable }) {
  const ref = useRef(null)
  const [selectedState, setSelectedState] = useState(null)
  const [showDots, setShowDots] = useState(true)

  const stateCount = useMemo(() => {
    const c = {}
    rows.forEach(r => { if (r.state) c[r.state] = (c[r.state] || 0) + 1 })
    return c
  }, [rows])

  const sitesInState = useMemo(() => {
    if (!selectedState) return []
    return rows.filter(r => r.state === selectedState && r.site !== 'Enterprise')
  }, [rows, selectedState])

  useEffect(() => {
    const isDark = matchMedia('(prefers-color-scheme: dark)').matches
    const maxV = Math.max(...Object.values(stateCount), 1)

    const color = d3.scaleLinear()
      .domain([0, maxV / 2, maxV])
      .range(isDark
        ? ['#1a322e', '#557F7F', '#D3E7E0']
        : ['#D3E7E0', '#557F7F', '#092B24'])

    const stateByFips = {}
    Object.entries(STATE_FIPS).forEach(([s, f]) => { stateByFips[f] = s })

    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(us => {
      if (!ref.current) return
      const div = ref.current
      const w = div.offsetWidth || 700
      const h = 460
      d3.select(div).select('svg').remove()
      const svg = d3.select(div).append('svg')
        .attr('viewBox', `0 0 ${w} ${h}`)
        .style('width', '100%')
        .style('height', '100%')

      const proj = d3.geoAlbersUsa().scale(w * 1.25).translate([w / 2, h / 2])
      const path = d3.geoPath(proj)
      const features = topojson.feature(us, us.objects.states).features

      svg.append('g').selectAll('path').data(features).join('path')
        .attr('d', path)
        .attr('class', 'state-path')
        .attr('stroke', isDark ? 'rgba(255,255,255,.25)' : 'rgba(9,43,36,.2)')
        .attr('stroke-width', 0.6)
        .attr('fill', d => {
          const fips = String(d.id).padStart(2, '0')
          const s = stateByFips[fips]
          const v = stateCount[s] || 0
          return v > 0 ? color(v) : (isDark ? '#142624' : '#f0f0ec')
        })
        .style('cursor', d => {
          const fips = String(d.id).padStart(2, '0')
          const s = stateByFips[fips]
          return (stateCount[s] || 0) > 0 ? 'pointer' : 'default'
        })
        .on('mouseenter', function () {
          d3.select(this).attr('stroke-width', 2).attr('stroke', '#D6EF4B')
        })
        .on('mouseleave', function () {
          d3.select(this).attr('stroke-width', 0.6).attr('stroke', isDark ? 'rgba(255,255,255,.25)' : 'rgba(9,43,36,.2)')
        })
        .on('click', (event, d) => {
          const fips = String(d.id).padStart(2, '0')
          const s = stateByFips[fips]
          if (stateCount[s] > 0) setSelectedState(s)
        })
        .append('title').text(d => {
          const fips = String(d.id).padStart(2, '0')
          const s = stateByFips[fips]
          const v = stateCount[s] || 0
          return `${STATE_NAMES[s] || s}: ${v} site${v !== 1 ? 's' : ''}${v > 0 ? ' (click for details)' : ''}`
        })

      if (showDots) {
        const dotsG = svg.append('g')
        rows.forEach(r => {
          if (r.lat && r.lng) {
            const coords = proj([r.lng, r.lat])
            if (coords) {
              dotsG.append('circle')
                .attr('cx', coords[0])
                .attr('cy', coords[1])
                .attr('r', 3)
                .attr('fill', '#D6EF4B')
                .attr('stroke', '#092B24')
                .attr('stroke-width', 0.8)
                .attr('opacity', 0.85)
                .style('pointer-events', 'none')
            }
          }
        })
      }

      const legW = 140
      const legH = 8
      const legG = svg.append('g').attr('transform', `translate(${w - legW - 16}, ${h - 36})`)
      const gradId = 'mapGrad'
      const defs = svg.append('defs')
      const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0%').attr('x2', '100%')
      grad.append('stop').attr('offset', '0%').attr('stop-color', isDark ? '#1a322e' : '#D3E7E0')
      grad.append('stop').attr('offset', '50%').attr('stop-color', '#557F7F')
      grad.append('stop').attr('offset', '100%').attr('stop-color', isDark ? '#D3E7E0' : '#092B24')
      legG.append('rect').attr('width', legW).attr('height', legH).attr('rx', 2).attr('fill', `url(#${gradId})`)
      legG.append('text').attr('y', 22).attr('font-size', 10).attr('fill', isDark ? '#a8b5b0' : '#5f5e5a').text('1 site')
      legG.append('text').attr('y', 22).attr('x', legW).attr('text-anchor', 'end').attr('font-size', 10).attr('fill', isDark ? '#a8b5b0' : '#5f5e5a').text(`${maxV} sites`)
    })
  }, [rows, stateCount, showDots])

  return (
    <div className="map-layout">
      <div className="map-controls">
        <label className="toggle">
          <input type="checkbox" checked={showDots} onChange={e => setShowDots(e.target.checked)} />
          <span>Show site markers</span>
        </label>
        <span className="map-hint">Click any state to see its sites</span>
      </div>
      <div className={`map-with-panel ${selectedState ? 'has-panel' : ''}`}>
        <div className="map-container" ref={ref} />
        {selectedState && (
          <div className="state-panel">
            <div className="state-panel-header">
              <div>
                <div className="state-panel-state">{STATE_NAMES[selectedState] || selectedState}</div>
                <div className="state-panel-count">{sitesInState.length} site{sitesInState.length !== 1 ? 's' : ''}</div>
              </div>
              <button className="close-btn" onClick={() => setSelectedState(null)} aria-label="Close">×</button>
            </div>
            <div className="state-panel-body">
              {sitesInState.length === 0 && <div className="empty">No matching sites</div>}
              {sitesInState.map((s, i) => (
                <div className="site-card" key={i}>
                  <div className="site-card-client">{s.client}</div>
                  <div className="site-card-site">{s.site}</div>
                  <div className="site-card-meta">
                    {formatPower(s.peakDemand)}
                    {s.iso && ` · ${s.iso}`}
                    {s.utility && ` · ${s.utility}`}
                  </div>
                  <div className="site-card-tech"><TechDots row={s} /></div>
                </div>
              ))}
            </div>
            <div className="state-panel-footer">
              <button className="primary-btn" onClick={() => jumpToTable(selectedState)}>
                View {STATE_NAMES[selectedState]} in table →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
