# RAF National CRM — راف الوطنية

منصة إدارة عملاء التمويل العقاري لشركة راف الوطنية للتطوير والاستثمار العقاري.

## Tech Stack

- **Next.js 15** — App Router, Server Components, Server Actions
- **Supabase** — PostgreSQL, Auth, RLS, Realtime
- **TypeScript** — strict mode
- **Tailwind CSS** — RTL Arabic UI
- **Zod** — API validation

## Features

- CRM leads dashboard with qualification + sales workflow tracking
- Funnel API (`/api/leads/submit`) for ClickFunnels webhook integration
- Excel import script (`scripts/import-leads-xlsx.mjs`)
- Role-based access: Admin (full) / Sales Agent (assigned leads only)
- Reports: sources, cities, salary ranges, conversion funnel

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase keys
npm run dev
```

## Import Leads from Excel

```bash
node --env-file=.env.local scripts/import-leads-xlsx.mjs --file ./import-data/leads.xlsx --phase 1
node --env-file=.env.local scripts/import-leads-xlsx.mjs --file ./import-data/leads.xlsx --phase 2
```
