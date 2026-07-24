# Verity Research System — Improvement Plan (Pre-Implementation Audit)

**Audience:** Founder + implementation agent  
**Mode:** Planning only — no code in this document  
**Date:** July 2026  
**Basis:** Current codebase (`afaqi-chat`, `research-company`, `generate-watchlist-digest`, `watchlist-brief`, enrichment scripts, mobile chat/profile, `company_research_cache`, `watchlist_digest`, chat history)

---

## 1) Executive summary

Verity already has a **strong research spine**: official vs independent source separation, factual gaps, financial highlights, portfolio digest, and a grounded chat assistant (Afaqi) with intent routing and citations. That is more architecturally serious than most solo-built research apps.

The core problem is not “missing AI.” It is **context loss and product fragmentation**:

1. The company profile builds rich structured research (narratives, financials, gaps).
2. Chat mostly receives headline `items` snippets and ignores the richest fields.
3. User flows (analyze / compare / sector / macro / headlines) are freeform + a thin 3-way classifier, not first-class modes.
4. Portfolio and ticker experiences share branding but not a unified research contract.
5. There is no durable research memory (snapshots / “what changed”), so the product cannot compound over time.

**The highest-ROI next version is not a new model or a retail narrative layer.**  
It is: **(A) feed the research you already generate into chat, (B) add 4–5 explicit research modes with structured outputs, (C) add daily headlines + lightweight change memory.**

If you do only one thing: **stop starving Afaqi of context.** Everything else amplifies that fix.

---

## 2) Architecture audit

### 2.1 What is already strong

| Strength | Why it matters |
|----------|----------------|
| **Official vs independent narrative wall** | Rare and correct for trust. Deterministic contamination filters after Perplexity are the right pattern. |
| **Three-pass company research** | Financials / company narrative / media + gaps is a solid research primitive. |
| **Factual gaps with categories** | Decision-useful without becoming advice. Keep and elevate. |
| **Afaqi grounding rules** | No inventing, cite sources, no buy/sell — good foundation. |
| **Intent classifier skeleton** | Cheap routing layer already exists; can evolve into mode routing. |
| **Persistent chat + source chips** | Conversation memory + citation UX already shippable. |
| **Watchlist digest** | Portfolio-level synthesis exists; users already have an entry point. |
| **Document monitoring + enrichment** | Primary-source monitoring is differentiated vs “chat with the internet.” |

### 2.2 What is fragile

| Fragility | Constraint |
|-----------|------------|
| **Prompts live inline in Edge Functions** | Hard to version, A/B, or reuse across CLI/cron/chat. Drift already exists (`research-company` vs `scripts/lib/research-perplexity.ts`). |
| **Perplexity as dual role** | Used both for structured research *and* live chat lookups. Quality and cost vary by call; failures are partially silent. |
| **Optional Perplexity in Afaqi** | If key missing, `research_needed` / stale cross-company degrade silently → shallow answers look like product failure. |
| **JSON-from-LLM contracts** | Repair retry helps, but schema drift and partial failures leave null narratives without user-visible degradation UX. |
| **Single overwrite cache row** | No ability to compare refreshes; “Refresh” destroys history. |
| **Two portfolio summarizers** | Mobile Perplexity digest vs web facts-only brief → inconsistent product language. |
| **Chat token budget** | 1000 completion tokens + truncated portfolio context → depth collapses under compare/sector questions. |
| **Classifier fallback** | On failure, defaults to `context_only` — wrong for tech/macro questions when live research was needed. |

### 2.3 What is missing

- Full research payload in chat context (narratives, financials, gaps).
- Explicit modes: analyze, compare, sector/theme, macro/regime, today’s headlines.
- Multi-pass chat synthesis for hard questions (optional, selective — not always).
- Daily company headlines brief as a product surface.
- Snapshot / change detection (“what changed since last refresh”).
- Controlled retail narrative layer (Reddit/YouTube/X) — intentionally absent.
- Macro data injection into chat (Finnhub is UI-only today).
- Unified research contract shared by ticker profile, portfolio digest, and chat.
- Web chat (acceptable to defer).

### 2.4 What is duplicated

- Company research prompts duplicated between Edge Function and CLI script.
- Portfolio summarization duplicated (digest vs brief) with different philosophies.
- Source ranking / sanitization logic concentrated in research-company; chat live search has almost none.
- “Synthesis” concept exists as DB column but is unused (`synthesis: null` always).

### 2.5 What is underused

| Asset | Status | Opportunity |
|-------|--------|-------------|
| `company_narrative` / `media_narrative` | Profile-only | Primary chat context |
| `financial_highlights` | Profile-only | Chat + compare + digests |
| `factual_gaps` | Profile hero | Chat should lead with these |
| `tracked_documents` + enrichment lenses | Monitor/web brief | Inject top lenses into company chat |
| `saved_headlines` | User saves | Optional “pinned sources” for chat |
| `synthesis` column | Dead | Repurpose as structured memo / change summary |
| Finnhub market strip | Display only | Optional regime/price context block (facts only) |

### 2.6 Context loss → poor answer quality (root cause)

Current company chat context builder effectively does:

```
PRIMARY CONTEXT = company_name + fetched_at + items[] (title/snippet/url)
```

But the profile already stores:

```
company_narrative + media_narrative + financial_highlights + factual_gaps + items[]
```

So when a user asks:

- “Summarize the official story”
- “What are the factual gaps?”
- “How do the numbers look vs the media narrative?”

…Afaqi is forced to reconstruct from snippets or fall back to live search — **re-researching what you already paid to compute**.

Portfolio mode is worse: digest + 3 items/company. Cross-company compare injects at most 2 companies and often a shallow Perplexity overview if cache is stale.

**This is the #1 architectural defect.** Fixing it is mostly context assembly + prompt work, not new research generation.

---

## 3) Priority improvements

Ranked by ROI for serious users (quality × usefulness × solo-founder feasibility).

| Rank | Improvement | Impact | Complexity | Verdict |
|------|-------------|--------|------------|---------|
| **1** | Inject full research context into Afaqi (narratives, financials, gaps, top sources) | Critical | Low | **Do first** |
| **2** | Explicit research modes + structured response templates (analyze / compare / sector / portfolio / technical) | Critical | Medium | **Do next** |
| **3** | Daily company headlines brief (bucketed sources) | High | Medium | **Phase 1–2** |
| **4** | “What changed” via lightweight snapshot + change summary | High | Medium | **Phase 2** |
| **5** | Unify portfolio + ticker research contract (same blocks, different aggregation) | High | Medium | **Phase 2** |
| **6** | Stronger technical Q&A source policy (papers, standards, filings first) | Medium-High | Low-Med | **Phase 1 with modes** |
| **7** | Dedicated macro/regime mode (facts + portfolio mapping) | Medium | Medium | **Phase 2, thin first** |
| **8** | Better portfolio synthesis across holdings (risks/themes/gaps matrix) | Medium-High | Medium | **Phase 2** |
| **9** | Prompt registry / shared prompt modules (kill duplication) | Medium (maintainability) | Low | **Phase 1 scaffolding** |
| **10** | Retail narrative (Reddit/YouTube/X) | Mixed / risky | High | **Defer** |
| **11** | Full quarterly time-series warehouse | Medium long-term | High | **Defer** |
| **12** | Web Afaqi parity | Medium | Medium | **Defer until mobile research loop is excellent** |

### Explicit evaluation of requested feature ideas

| Idea | Include in next phase? | Notes |
|------|------------------------|-------|
| Full narrative context in chat | **Yes — Phase 1 must** | Highest ROI; unlocks everything else |
| Dedicated compare mode | **Yes** | Intent alone is too weak |
| Dedicated macro/regime mode | **Yes, thin** | Start with web+portfolio mapping; no heavy macro DB yet |
| Daily headlines per company | **Yes** | Natural product cadence; reuse research sources |
| Retail narrative bucket | **No (not yet)** | Contamination + noise + trust risk; revisit after core loop |
| Time-series snapshots | **Yes, lightweight** | Append-only research versions, not a full warehouse |
| “What changed since last refresh” | **Yes** | Depends on lightweight snapshots |
| Better portfolio synthesis | **Yes** | After full company context exists |
| Stronger technical Q&A source policy | **Yes** | Prompt + preferred domains, not new infra |
| Structured user-facing templates | **Yes** | Mode chips / starter prompts in UI |
| Unified research architecture | **Yes** | Same research blocks for ticker and portfolio |

---

## 4) Target user experience

Design within current stack (mobile-first, Edge Functions, Perplexity + OpenAI, existing cache tables). Do not redesign the whole app.

### 4.1 Single ticker research

**Profile (refresh):**
1. User opens company → taps Refresh (or scheduled refresh lands).
2. Screen shows, in order:
   - **What changed** (if prior snapshot exists) — 3–5 bullets
   - **Factual gaps** (hero)
   - **Financial highlights**
   - **Official narrative** + sources
   - **Independent narrative** + sources
   - **Today’s headlines** (bucketed: Official / Independent / optional Other)
3. CTA: **Discuss with Afaqi**

**Chat:**
- Context pill: `NVDA research · refreshed 2h ago`
- Starter chips: Analyze · Gaps · Compare · Technical · Headlines · What changed
- Default “Analyze” produces a structured memo (see prompts), not freeform essay:
  1. Direct takeaway
  2. Official vs independent split
  3. Numbers that matter
  4. Open questions / gaps
  5. Sources
- Follow-ups stay grounded in the same payload unless user asks for live research.

### 4.2 Portfolio-level discussion

**Home:**
- Portfolio Brief card remains the entry point.
- Brief becomes a **structured digest**, not only prose:
  - Cross-holding themes
  - Shared risks / policy / supply-chain notes
  - Companies with material gaps or narrative divergence
  - 5–8 sources with relevance

**Chat (`__portfolio__`):**
- Injects: digest + per-company compact research cards (narrative summary, top gaps, period metrics — not just 3 headlines).
- Starter chips: Themes · Risks · Compare holdings · Macro map · Dig deeper on {ticker}
- Answers name companies explicitly and point to which narrative layer supports each claim.

### 4.3 Compare mode

User picks Compare (or asks “compare NVDA and AVGO”):

1. Load full research cards for both (cache-first; live fill only if missing/stale).
2. Structured compare output:
   - Business / strategy differences (official)
   - Market narrative differences (independent)
   - Financial snapshot side-by-side (facts only)
   - Shared / divergent risks & gaps
   - What is unresolved
   - Sources by company
3. No winner language, no “better buy.”

UI: context pill becomes `NVDA + AVGO`. Cap at 2–3 tickers initially.

### 4.4 Sector / theme deep dive

User asks “How does optical networking affect my watchlist?” or taps Theme:

1. Intent → `theme_research` (not generic `research_needed`).
2. Live research with preferred source classes (papers, standards, filings, reputable trade/press).
3. Map findings back onto watchlist companies with cache evidence.
4. Output: theme brief → portfolio mapping → open questions → sources.

### 4.5 Technical / market Q&A

For “How does NVLink work?” / market structure questions:

1. Prefer live research with **technical source policy**.
2. If a company is in context, connect explanation to that company’s disclosures where possible.
3. Output: plain explanation → why it matters for this company/theme → caveats → sources.
4. Stay non-advisory.

### 4.6 Daily company headlines brief

New surface (profile section and/or notification-ready later):

- **Today’s Brief for {Company}**
- Buckets:
  - Official / IR / Filings
  - Independent news & analysis
  - (Later) Retail chatter — off by default
- Each item: title, source, 1-line why it matters, link
- 4–8 items total; freshness labeled
- “Ask Afaqi about today’s brief” opens chat with that brief preloaded as context

This should feel like a **morning research briefing**, not a social feed.

---

## 5) Recommended architecture changes

### 5.1 Research object contract (unify ticker + portfolio)

Define one canonical **CompanyResearchCard** used everywhere:

```text
CompanyResearchCard {
  slug, name, ticker
  fetched_at, model
  financial_highlights
  company_narrative
  media_narrative
  factual_gaps[]
  sources: {
    official: SourceItem[]
    independent: SourceItem[]
  }
  change_summary?          // vs previous snapshot
  headlines_today?         // optional daily brief slice
  monitored_lenses?        // top enrichment questions
}
```

- **Ticker profile** renders the card.
- **Chat** injects a compact serialization of the card.
- **Portfolio digest** aggregates N cards + macro/theme overlay.
- **Compare** joins 2–3 cards into a compare prompt.

Stop inventing separate ad-hoc context strings per surface.

### 5.2 Intent routing → Mode routing

Evolve classifier from 3 intents to explicit modes:

| Mode | Trigger examples | Extra fetches |
|------|------------------|---------------|
| `analyze_ticker` | “analyze”, “deep dive”, open from profile | none if cache fresh |
| `compare` | “compare X and Y”, Compare chip | up to 2 extra cards |
| `portfolio_synthesis` | portfolio chat default / “themes” | digest regen if stale |
| `theme_sector` | sector/theme questions | live research + map to holdings |
| `macro_regime` | rates, liquidity, risk-on/off, policy | live macro research + holdings map |
| `technical_explain` | tech/process/market-structure how-it-works | live research w/ technical policy |
| `headlines` | “today’s headlines”, daily brief | headlines pack |
| `what_changed` | “what changed”, after refresh | snapshot diff / stored change_summary |
| `context_qa` | follow-ups answerable from card | none |

Keep a fallback `general_research` for odd cases.

**Classifier upgrade:** return `{ mode, tickers[], theme_query, needs_live_research }`.

### 5.3 Should chat become multi-pass?

**Yes, but selectively — not for every message.**

| Message type | Pipeline |
|--------------|----------|
| Simple follow-up / `context_qa` | Single-pass synthesis (current) |
| Analyze / compare / portfolio / theme / macro | **Structured single synthesis** with richer context first |
| Only when context insufficient | Live research pass → then synthesis |
| Optional later | Parallel “lenses” then merge (costly; Phase 3) |

**Recommendation:** Phase 1–2 = **better context + mode prompts**, not a heavy agent loop. Multi-pass research generation already exists at refresh time; chat should consume it, not re-run it.

Avoid turning Afaqi into a 5-call agent on every message — cost and latency will hurt mobile UX.

### 5.4 What context to inject

**Company mode (always when available):**
1. Compact financial highlights
2. Company narrative (full or truncated intelligently, e.g. ≤1.5–2k chars)
3. Media narrative (same)
4. Factual gaps (all)
5. Top official sources (5) + top independent sources (5) with snippets
6. Change summary if present
7. Optional: today’s headlines pack
8. Optional: 3 monitored document lenses

**Portfolio mode:**
1. Latest digest (structured if upgraded)
2. Per holding: mini-card (1-para official, 1-para independent or condensed, top 2 gaps, period + 3 metrics)
3. Cap holdings in prompt (e.g. 8–12) with “more on watchlist but omitted” note

**Hard rule:** Prefer truncating *sources* over dropping *narratives/gaps*.

### 5.5 Comparison in chat

- Mode `compare` requires ≥2 tickers.
- Load cards for each; if missing, offer “Refresh research for {ticker}” rather than silently hallucinating from live blurbs when possible.
- Live Perplexity allowed only as **fill-in**, clearly labeled “live search — not in Verity cache.”

### 5.6 Macro / regime

- Do **not** build a Bloomberg macro warehouse.
- Mode prompt + Perplexity with preferred domains (Fed, BLS, IMF, major econ desks, policy primary sources).
- Always map back to watchlist/ticker cards: “why this may matter for {companies}” using cached narratives — framed as context, not prediction.
- Optional later: inject Finnhub facts (price/mcap/PE) as **market snapshot facts**, not forecasts.

### 5.7 Retail narrative layer

**Defer.** Reasons:
- Conflicts with Verity’s trust positioning (official vs independent).
- High contamination / manipulation risk.
- Hard to cite cleanly; noisy for solo maintenance.

If revisited (Phase 3+): separate bucket labeled **Retail chatter**, never mixed into independent narrative, capped, optional toggle, and excluded from default analyze/compare unless user asks “what is retail saying?”

### 5.8 Daily headlines

New function or extension of research refresh:
- `generate-company-headlines` (or section inside research-company with `recencyFilter: day`)
- Output bucketed list stored on cache or separate table
- UI section on profile + starter chip in chat
- Portfolio “morning brief” can roll up top headline deltas across holdings (Phase 2)

### 5.9 Change detection / snapshots

Minimal viable memory (do this before fancy time-series):

1. On each successful refresh, **append** a snapshot row (or versioned JSON) with narratives, financials, gaps, source URL sets, `fetched_at`.
2. Generate `change_summary` by comparing previous → current (LLM or deterministic URL/metric diffs + short LLM summary).
3. Store `change_summary` on current cache for fast chat injection.
4. Keep last N snapshots (e.g. 8–12) or 90 days — not infinite.

Full quarterly warehouse can wait.

### 5.10 Prompt packaging

Move prompts into a shared module pattern (even if still TS strings in repo):
- `prompts/afaqiSystem.ts`
- `prompts/modes/*.ts`
- `prompts/researchCompany.ts`

Goal: one source of truth for Edge + scripts.

---

## 6) Data and storage plan

### 6.1 Keep / evolve `company_research_cache` (current live row)

**Keep as the live/current row** (fast reads for profile + chat).

**Add / repurpose fields:**

| Field | Action | Purpose |
|-------|--------|---------|
| `company_narrative` | keep | chat + profile |
| `media_narrative` | keep | chat + profile |
| `financial_highlights` | keep | chat + compare |
| `factual_gaps` | keep | chat + profile |
| `items` | keep | source list; ensure `narrative_scope` always set |
| `synthesis` | **repurpose** | store structured analyze memo OR change summary pointer — do not leave dead |
| `change_summary` (new jsonb/text) | add | “what changed” bullets + metric/source deltas |
| `headlines` (new jsonb) | add | daily brief buckets |
| `research_version` (new int) | add | increments each refresh |
| `previous_fetched_at` (new) | add | convenience for UI |

### 6.2 New: `company_research_snapshots`

Append-only history:

```text
company_research_snapshots (
  id uuid pk,
  slug text,
  research_version int,
  fetched_at timestamptz,
  model text,
  payload jsonb,           -- full card or trimmed card
  change_summary text/jsonb,
  created_at timestamptz
)
index (slug, fetched_at desc)
```

Written on each successful research refresh. Prune old rows later via cron.

### 6.3 Evolve `watchlist_digest`

Keep one row per user for fast home card, but upgrade payload:

```text
digest_text          -- keep for compatibility
digest_structured    -- new jsonb: themes[], risks[], standouts[], gaps_to_watch[]
sources              -- keep
slugs_snapshot       -- keep
generated_at, model, is_generating
```

Long-term: optional `watchlist_digest_history` if users want prior briefs — not required for Phase 1.

### 6.4 New: headlines storage options

**Option A (simpler):** `company_research_cache.headlines` jsonb  
**Option B (cleaner):** `company_daily_briefs (slug, brief_date, buckets jsonb, sources, model, generated_at)` unique(slug, brief_date)

**Recommend Option B** if you want true daily cadence and history; Option A if you want fastest ship.

Buckets schema:

```json
{
  "as_of": "2026-07-24",
  "official": [{"title","url","source","snippet","why_it_matters"}],
  "independent": [...],
  "retail": []
}
```

### 6.5 Sources / buckets

Do not invent a heavy normalized sources warehouse yet. Use jsonb arrays with:

- `narrative_scope`: `company | media | retail | macro`
- `bucket`: `official | independent | retail | macro | technical`
- existing title/url/source/snippet/published_at

Deterministic filters remain code-side.

### 6.6 Chat tables

Keep `conversations` / `chat_messages`.

Optional adds:
- `mode` on assistant messages (analytics + debugging)
- `context_version` / `research_version` used for that answer (reproducibility)

### 6.7 What not to replace yet

- Do not merge `tracked_documents` into research cache.
- Do not delete `watchlist-brief` immediately — either deprecate web path or point it at the same structured digest later.
- Do not build a separate vector DB for Phase 1–2.

---

## 7) Prompt system redesign

Design principles for all prompts:
- Source-grounded; say when evidence is thin
- Separate narrative layers; never blend official and independent as one “truth”
- Decision-oriented = clarifying what matters and what is unknown — **not** buy/sell/price targets
- Concise sections with consistent headings
- End with sources
- Explicit uncertainty language

Below are **implementation-ready prompt specs** (to be coded later).

### 7.1 Shared Afaqi system (evolved)

Keep current non-negotiables; add:

- Prefer PRIMARY RESEARCH CARD fields over live search when present.
- When using live research, label it as live and secondary to cache.
- Never issue recommendations, ratings, price targets, or “you should.”
- For compares: no winner declaration.
- Default structure: Direct answer → Evidence by layer → Open questions → Sources.
- If asked for advice: reframe into research questions / risk factors / what to verify.

### 7.2 Company deep dive (`analyze_ticker`)

**User/system mode instructions:**

```text
MODE: Analyze ticker
Using only the Company Research Card (and labeled live blocks if present), produce:

1. Takeaway (3–5 sentences)
2. Official narrative (what the company says)
3. Independent narrative (what third parties emphasize)
4. Financial snapshot (period + key metrics; say if missing)
5. Factual gaps / unresolved points (use stored gaps; add only if clearly supported)
6. What to watch next (research watchpoints — not trade ideas)
7. Sources (official first, then independent)

Rules: no advice; attribute by layer; if card is stale (>X days), say so.
```

### 7.3 Compare X vs Y (`compare`)

```text
MODE: Compare
Inputs: Research Cards for each ticker (max 3).

Produce:
1. Scope note (what is comparable / not)
2. Strategy & business model (official-layer contrast)
3. Market narrative contrast (independent-layer)
4. Financial snapshot table-like bullets
5. Shared risks / divergent risks (from gaps + narratives)
6. Unresolved questions for further research
7. Sources by company

Forbidden: picking a winner, allocation advice, price targets, “undervalued/overvalued.”
```

### 7.4 Sector / theme (`theme_sector`)

```text
MODE: Theme / sector research
1) Summarize the theme from live research (mechanics, current status, key actors).
2) Map relevance to provided holdings/cards — only where evidence supports a link.
3) Separate confirmed links vs speculative/uncertain links.
4) Open research questions.
5) Sources — prefer papers, standards bodies, filings, primary policy, reputable technical/trade press.
```

### 7.5 Macro / regime (`macro_regime`)

```text
MODE: Macro / regime context
1) State the macro facts/context from sources (rates, policy, liquidity, growth/inflation debate as reported — not predicted).
2) Map plausible transmission channels to the user’s tickers/themes using their research cards.
3) Label uncertainty explicitly.
4) What would falsify or change this framing (observable research watchpoints).
5) Sources (primary policy/data first).

Forbidden: market-timing advice, portfolio allocation instructions.
```

### 7.6 Portfolio synthesis (`portfolio_synthesis`)

```text
MODE: Portfolio synthesis
Inputs: digest + mini research cards for holdings.

Produce:
1. Cross-portfolio themes (name companies)
2. Narrative divergences worth attention (official vs independent)
3. Shared gap patterns
4. Concentration / theme overlap observations (descriptive, not advisory)
5. Best next research questions (3–5)
6. Sources
```

### 7.7 Today’s headlines (`headlines`)

```text
MODE: Today’s headlines
Using the headlines pack (and card if needed):
- Group by Official vs Independent
- 1 line “why it matters” per item, grounded in snippet
- Flag low-confidence / thin coverage
- Offer 2 follow-up research questions
No sentiment investing language.
```

### 7.8 Technical explanations (`technical_explain`)

```text
MODE: Technical / market-structure explanation
1) Explain the concept clearly for a serious investor.
2) If a company card is present, connect to disclosed uses/risks only when supported.
3) Prefer technical primary sources: papers, standards, documentation, filings, lab/university, reputable engineering analysis.
4) Call out contested claims.
5) Sources.
```

### 7.9 Retail narrative (deferred template)

If ever enabled:

```text
MODE: Retail narrative (optional layer)
Treat as unstructured public chatter, not evidence.
Separate from independent editorial sources.
Summarize claims + frequency caveats.
Never let retail override filings.
Label clearly: RETAIL CHATTER.
```

### 7.10 Synthesis / decision memo (shared ending format)

For analyze/compare/portfolio, standardize a closing block:

```text
Research memo footer:
- Confidence: high | medium | low (based on source coverage, not price outlook)
- Layers used: official / independent / live / macro
- Unresolved: ...
- Suggested verification: primary docs to open next
```

This is “decision-oriented” without advice: it organizes attention.

### 7.11 Research generation prompts (refresh-time)

Keep the 3-pass design. Add:

- **Headlines pass** (day recency, bucketed) OR fold into media/company with a headlines schema.
- **Change summary pass** after snapshot compare (short, factual, no advice).
- Optionally regenerate a stored `analyze_memo` into `synthesis` for offline profile reading (nice-to-have).

---

## 8) Implementation roadmap

### Phase 1 — Highest impact / lowest complexity  
**Goal:** Make chat obviously smarter using research you already have. Ship mode-shaped answers.

**Build:**
1. Expand `buildResearchContext` / `buildPortfolioContext` to include narratives, financials, gaps, top sources (token-aware truncation).
2. Upgrade intent classifier → mode router (at least: analyze, compare, theme, technical, context_qa, portfolio_synthesis).
3. Add mode-specific instruction blocks into Afaqi messages (prompt modules).
4. UI starter chips on company + portfolio chat.
5. Extract shared prompt strings to a single module used by Edge Functions (stop drift later).
6. Surface confidence/staleness (“research refreshed X ago”) in answers when stale.
7. Fail loudly in UI when live research was needed but Perplexity unavailable.

**Defer:**
- Retail narrative
- Full snapshot warehouse UI
- Web chat
- Heavy multi-pass agents
- New macro data vendors

**User value:** Immediate jump in answer quality, consistency, compare usefulness, trust.

**Risks:** Larger prompts → cost/latency; truncation bugs; classifier misroutes.

**Dependencies:** None beyond existing cache fields.

**Order:**
1. Context injection  
2. Mode prompts + classifier  
3. Chips UI  
4. Prompt module cleanup  
5. Stale/error UX

---

### Phase 2 — Medium complexity  
**Goal:** Cadence + memory + unified portfolio brain.

**Build:**
1. `company_research_snapshots` + `change_summary` on refresh.
2. “What changed” profile section + chat mode.
3. Daily headlines brief (table or jsonb) + profile section + chat mode.
4. Upgrade `watchlist_digest` to structured themes/risks/gaps; align web brief later or deprecate.
5. Portfolio mini-cards in chat (not just 3 headlines).
6. Thin macro/regime mode with holdings mapping.
7. Stronger live-research domain preferences for technical/theme modes.
8. Rate limits (from existing ROADMAP) once chat usage rises.

**Defer:**
- Retail layer
- Push notifications for headlines (design only)
- Full history browser UX beyond last few snapshots

**User value:** Product feels alive day-to-day; research compounds; portfolio chat becomes serious.

**Risks:** Storage growth; change-summary hallucination; headlines contamination; digest cost.

**Dependencies:** Phase 1 context/modes; refresh pipeline hooks.

**Order:**
1. Snapshots + change_summary  
2. Headlines brief  
3. Structured portfolio digest  
4. Macro mode thin slice  
5. Rate limits

---

### Phase 3 — Ambitious / optional  
**Goal:** Differentiation and depth for power users.

**Build (pick carefully):**
1. Retail narrative bucket (optional, labeled, off by default).
2. Snapshot history browser / quarterly views.
3. Selective multi-pass chat for complex compares (parallel lens calls → merge).
4. Web Afaqi parity.
5. Notification-ready morning portfolio brief.
6. Deeper monitored-document injection (full lenses/RAG-lite over tracked docs).
7. Eval harness for prompts (golden questions per mode).

**Defer indefinitely unless demanded:**
- Price targets / ratings
- Brokerage sync as “advice engine”
- Social feed productization
- Vector DB before proving snapshot+modes value

**User value:** Power-user depth; defensibility.

**Risks:** Scope creep; trust damage from retail; cost explosion; solo maintenance burden.

---

## 9) Risks and tradeoffs

### Token / cost pressure
- Full narratives in every chat turn will increase input tokens materially.
- Mitigations: compact cards, mode-based injection (don’t inject headlines+macro every time), cache-first, lower max tokens for simple `context_qa`, consider `gpt-4o-mini` for routing and a slightly stronger model only for analyze/compare later if needed.

### Source contamination
- Live Perplexity for chat is the weak boundary today.
- Keep hard walls for stored research; label live blocks; extend contamination filters to chat-injected live sources where possible.
- Headlines must reuse the same official/independent rules.

### Hallucination risk
- Biggest current cause: **asking the model to answer without the card fields**.
- Second: change summaries and macro mapping over-claiming.
- Mitigations: “only from card,” explicit missing-data language, confidence footer, no advice.

### Context window limits
- Portfolios with 12 rich cards won’t all fit.
- Strategy: mini-cards + “ask to focus on ticker X,” hard cap, summarize older holdings.

### Complexity / maintenance
- You built this in ~20 hours; the danger is turning it into an agent platform.
- Prefer **data contract + modes + memory** over autonomous multi-tool loops.
- Kill duplication (prompts/scripts) early or velocity dies.

### Is the app trying to do too much?
**Right now: almost.** The research generation is already ambitious; chat underuses it.  
**Correct strategy:** deepen the existing spine before adding retail/macro warehouses/web chat.

### What should *not* be added yet
- Retail Reddit/YouTube/X as a default narrative layer
- Price targets, ratings, portfolio allocation advice
- Full agentic multi-pass on every message
- Vector search as a prerequisite
- Rebuilding web and mobile research separately again
- A fourth portfolio summarizer

---

## 10) Final recommendation

### Single most important next step
**Inject the full Company Research Card into Afaqi (narratives + financials + factual gaps + top sources) and answer through explicit modes (analyze / compare / theme / technical / portfolio).**

This is the shortest path to “noticeably better for serious users,” because it fixes the product’s core lie: *the research exists, but chat can’t see it.*

### What not to do yet
- Do **not** start with retail narrative.
- Do **not** build a large macro data platform.
- Do **not** invent a complex multi-agent chat loop.
- Do **not** prioritize web Afaqi before mobile research quality feels unfairly good.
- Do **not** add more Perplexity passes until chat consumes the three you already run.

### What makes Verity better fastest
1. **Context completeness** (Phase 1)  
2. **Mode-shaped, source-layered answers** (Phase 1)  
3. **Daily headlines + what-changed memory** (Phase 2)

Do those well and Verity stops feeling like “chat wrapped around news” and starts feeling like a **research workspace with memory** — still not investment advice, but actually useful for decisions.

---

## Appendix A — Suggested Phase 1 acceptance criteria

- Asking “What are the factual gaps?” returns the stored gaps without live search.
- Asking “Summarize the official vs media narrative” cites both layers distinctly.
- Compare of two cached tickers produces side-by-side structure with no winner language.
- Portfolio chat references specific holdings’ gaps/themes, not only digest prose.
- Source chips still appear; answers remain non-advisory.
- If research cache empty, chat tells user to Refresh — does not invent a company story.

## Appendix B — Feature include/exclude cheat sheet

| Include soon | Exclude for now |
|--------------|-----------------|
| Full card → chat | Retail narrative default |
| Modes + chips | Price targets / ratings |
| Headlines buckets | Autonomous multi-agent chat |
| Snapshots + what changed | Vector DB prerequisite |
| Structured portfolio digest | Web/mobile dual research stacks |
| Thin macro map-to-holdings | Social feed product |

---

*End of planning document. Ready for founder review → then implementation tickets against Phase 1.*
