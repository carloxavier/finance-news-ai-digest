# Finance AI Digest — Supabase Integration Reference
*For use by the Figma Make agent*

---

## Connection Credentials

| | |
|---|---|
| **Project URL** | `https://kamfamwjswkncftsdgxi.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthbWZhbXdqc3drbmNmdHNkZ3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMDQ3NDgsImV4cCI6MjA4ODY4MDc0OH0.O8NasVjjajK-T18GppCjfljS_h30fNrPo3TgPJGmcEs` |

All API requests require the following headers:

```
apikey: <anon key above>
Content-Type: application/json
```

---

## Anonymous User Identity

There is no auth in the prototype. On first load, generate a UUID and persist it:

```js
let userId = localStorage.getItem('fad_user_id');
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem('fad_user_id', userId);
}
```

Use this `userId` in all feed and interest calls.

---

## API Calls

### 1. Get topics (interest picker)

Fetches all available topic options, used on the onboarding / interest selection screen.

```
GET https://kamfamwjswkncftsdgxi.supabase.co/rest/v1/topics
  ?select=id,slug,display_name,dimension
  &order=dimension,display_name
```

**Response shape:**
```json
[
  { "id": "uuid", "slug": "semiconductors", "display_name": "Semiconductors", "dimension": "industry" },
  { "id": "uuid", "slug": "macro", "display_name": "Macro & Fed", "dimension": "theme" }
]
```

`dimension` is either `"industry"`, `"theme"`, or `"geography"` — use it to group topics visually if needed.

---

### 2. Save user interests (after onboarding)

Call once per selected topic. Insert one row per interest.

```
POST https://kamfamwjswkncftsdgxi.supabase.co/rest/v1/user_interests
Body: { "user_id": "<userId>", "topic_id": "<topic_uuid>" }
```

To clear and reset interests, first delete existing rows:

```
DELETE https://kamfamwjswkncftsdgxi.supabase.co/rest/v1/user_interests
  ?user_id=eq.<userId>
```

---

### 3. Get personalised feed (main feed screen)

Calls the `get_user_feed` RPC function. Returns articles ranked by relevance and recency, filtered to the user's interests.

```
POST https://kamfamwjswkncftsdgxi.supabase.co/rest/v1/rpc/get_user_feed
Body: { "p_user_id": "<userId>", "p_limit": 20 }
```

**Response — array of article objects:**

| Field | Type | Use |
|---|---|---|
| `id` | uuid | Link to article detail |
| `headline` | text | Card title |
| `publication` | text | Source name badge (e.g. "CNBC") |
| `published_at` | timestamptz | Relative timestamp ("2h ago") |
| `ai_preview` | text | One-line AI summary shown under headline |
| `consensus_signal` | text | Feed badge — one of: `BUY` `SELL` `MIXED` `NO_RATING` |
| `extracted_tickers` | text[] | Ticker chips (e.g. `["NVDA", "MU"]`) |
| `source_url` | text | "Read original" link |

---

### 4. Get single article (detail view)

```
GET https://kamfamwjswkncftsdgxi.supabase.co/rest/v1/ai_articles
  ?id=eq.<article_id>
  &select=*
```

**Additional fields available in detail view:**

| Field | Type | Use |
|---|---|---|
| `brief` | text | Full AI brief with inline `[1]` citation markers |
| `citations` | jsonb array | Rendered as footnotes — see structure below |
| `analyst_data` | jsonb | Per-ticker Finnhub consensus data — Layer 1 (blue) |
| `inference_watch` | text[] | "What to watch" bullets — Layer 2 (amber, labelled AI INFERENCE) |
| `inference_risks` | text[] | "Key risks" bullets — Layer 2 (amber) |
| `inference_questions` | text[] | "Open questions" bullets — Layer 2 (amber) |

**`citations` array structure:**
```json
[
  { "n": 1, "source": "CNBC", "label": "Iran war semiconductor impact", "url": "https://..." },
  { "n": 2, "source": "SIA", "label": "Helium supply warning", "url": "https://..." }
]
```

Each `[N]` marker in `brief` corresponds to `citations[N-1]`. Render them as superscript links that expand or scroll to the footnote.

**`analyst_data` structure (per ticker):**
```json
{
  "NVDA": {
    "recommendation": { "strongBuy": 12, "buy": 28, "hold": 8, "sell": 1, "strongSell": 0 },
    "priceTarget": { "mean": 185.50, "high": 230.00, "low": 140.00 },
    "currentPrice": 142.30,
    "targetGap": 30.4,
    "metric": { "peRatio": 38.2, "revenueGrowthTTM": 78.4 }
  }
}
```

---

## Design System Reminder

| Token | Value |
|---|---|
| Background | `#0D1B2A` (navy) |
| Citation markers `[N]` | `#2563EB` (citation blue) |
| Layer 1 (analyst data) | Blue — sourced, trust-positive |
| Layer 2 (AI inference) | Amber — always labelled **"AI INFERENCE — not sourced"** |
| Headlines | Instrument Serif |
| Data / tickers / citations | IBM Plex Mono |
| Body | Plus Jakarta Sans |

The amber AI Inference label on `inference_watch`, `inference_risks`, and `inference_questions` is **hardcoded and non-negotiable** — it must always appear regardless of the data.

---

## Connection Test

Before building, verify the connection returns data:

```
GET https://kamfamwjswkncftsdgxi.supabase.co/rest/v1/ai_articles
  ?select=id,headline,consensus_signal
  &limit=5
```

Should return 5 of the 20 seeded articles.