# Supabase: new project, migrations, and auth URLs

Follow this after you create a blank Supabase project and have the dashboard open.

## 1. Apply database migrations

Migrations live in `supabase/migrations/`. Apply them **in ascending filename order** (e.g. `0001_*` … `0014_*`).

**Option A — Supabase CLI (recommended)**

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option B — SQL editor**

Paste and run each file’s contents sequentially in **SQL Editor** (same order).

The CRM tables and enums for Raf leads are introduced in **`0014_leads_crm_schema.sql`**. Earlier files set up permits, profiles, auth hooks, storage, etc.

## 2. Environment variables (`/.env.local`)

Copy from **`/.env.example`** and fill:

| Variable | Where to get it |
|---------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → **Project Settings → API → Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same screen → **anon public** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same screen → **service_role** key (never ship to browsers) |

Optional app URL:

- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3030` locally; your production HTTPS URL later.

Funnel ingestion (CRM):

| Variable | Purpose |
|---------|---------|
| `FUNNEL_SUBMIT_SECRET` | Shared secret — `Authorization: Bearer …` or `X-Funnel-Secret` |
| `FUNNEL_ALLOWED_ORIGINS` | Comma-separated allowed `Origin` values for browser `fetch` from your funnel domain |
| `FUNNEL_RATE_LIMIT_PER_MINUTE` | Max accepted POSTs per client IP per minute (default **40**) |
| `FUNNEL_HONEYPOT_FIELD_NAMES` | Extra hidden field keys (comma-separated) that must stay empty |

## 3. Auth URL configuration

In Supabase Dashboard → **Authentication → URL Configuration**:

### Local development (`localhost:3030`)

- **Site URL**: `http://localhost:3030`
- **Redirect URLs** — add:
  - `http://localhost:3030/**`
  - `http://127.0.0.1:3030/**` (optional, if you use that host)

Your app listens on port **3030** (`npm run dev`).

### Production (when ready)

Replace with your HTTPS domain:

- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: `https://your-domain.com/**`

Also add any OAuth callback URLs your IdP requires (Supabase shows the exact paths in docs).

### Email confirmations

If magic links / signup emails are enabled, templates must link to URLs that appear in **Redirect URLs** allowlist above.

## 4. Staff roles (`admin` vs `sales_agent`)

Assign roles in **`public.profiles.role`** (`user_role` enum). Migration `0014` adds `sales_agent`; full admin tooling expects `admin`.

## 5. Funnel API smoke test

With `.env.local` loaded:

```http
POST /api/leads/submit
Authorization: Bearer YOUR_FUNNEL_SUBMIT_SECRET
Content-Type: application/json

{"first_name":"Test","phone_number":"501234567","email":"t@example.com"}
```

Expect `201` and `{ "ok": true, "id": "…" }`, or `{ "ok": true, "duplicate": true, "id": "…" }` when phone/email matches an existing row.

Payload shapes and aliases: see **`types/funnel-payload.ts`** and **`lib/leads/map-funnel-payload.ts`**.

---

### Custom funnel (JavaScript `fetch` or server webhook — not tied to ClickFunnels)

Incoming JSON keys can differ from the canonical names; **`lib/leads/map-funnel-payload.ts`** maps aliases (e.g. `full_name`, `phone`, Arabic labels, `utm_*`, page URL).

Security on `POST /api/leads/submit`: **Bearer** or **`X-Funnel-Secret`** (required); **Zod** validation; **honeypots** (`FUNNEL_HONEYPOT_FIELD_NAMES` + defaults); **per-IP rate limit** (`FUNNEL_RATE_LIMIT_PER_MINUTE`); **duplicate** detection by normalized phone or email (`200` with `duplicate: true`).

Browser example (your funnel origin must be listed in `FUNNEL_ALLOWED_ORIGINS`):

```js
await fetch('https://YOUR_DOMAIN/api/leads/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer YOUR_FUNNEL_SUBMIT_SECRET',
  },
  body: JSON.stringify({
    first_name: 'محمد',
    family_name: 'الفلاني',
    phone_number: '9665xxxxxxxx',
    email: 't@example.com',
    city: 'الرياض',
    visit_source_raw: document.referrer,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    _trap: '', // hidden honeypots must stay empty
  }),
})
```

Server-side webhooks use the same JSON and headers; **CORS does not apply** between servers.
