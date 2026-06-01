# EIQ — ENFRA PMO Dashboard

Interactive PMO (Project Management Office) dashboard for ENFRA Solutions.

Spun off from the CPower project dashboard, EIQ reuses much of the underlying project data while taking a new product direction focused on portfolio and program management.

## What this is

A live, filterable web dashboard showing project sites, technology deployments, peak demand totals, and geographic distribution across ISO regions. Currently uses a static export of the project list as its data foundation, with the product direction evolving toward broader PMO needs.

## Live site

Once deployed, the dashboard will be available at:
`https://leonardcarollo.github.io/eiq-pmo-dashboard/`

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Updating the data

The dashboard reads from `src/projects.json`. To update:
1. Run the export script against the latest source file
2. Replace `src/projects.json`
3. Commit and push — GitHub Actions will auto-deploy within a minute

## Lineage

This project was forked from [cpower-dashboard](https://github.com/leonardcarollo/cpower-dashboard), which remains the original CPower-specific dashboard. EIQ is developed independently from this point forward.
