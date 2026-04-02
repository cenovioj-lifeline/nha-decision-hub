# Decision Hub — System Architecture

How requests flow from intake to decision to execution.

---

## Pipeline Overview

```
Slack Channel (ia-nhaapp-jck)     Email (decisions@nha-ai.com)     Manual Upload
        │                                   │                           │
        ▼                                   ▼                           ▼
  dhub-slack-poll              dhub-email-receive              Website Upload
  (pg_cron, 15 min)           (Resend webhook)                (direct insert)
        │                                   │                           │
        └───────────────┬───────────────────┘                           │
                        ▼                                               │
              status: "raw"                                    status: "new"
                        │                                               │
                        ▼                                               │
               dhub-consolidate                                         │
              ("Process Now" button)                                    │
                        │                                               │
          ┌─────────────┼──────────────┐                                │
          ▼             ▼              ▼                                 │
     standalone      grouped        noise                               │
     status:"new"    primary:"new"  status:"consolidated"               │
                     others:"consolidated"                              │
                        │                                               │
                        └───────────────┬───────────────────────────────┘
                                        ▼
                                  Inbox (website)
                              status="new", consolidated_into IS NULL
                                        │
                                        ▼
                              Cenovio makes decision
                         None / Approve / Decline / On Hold / Merge
                                        │
                    ┌───────────┬───────┼────────┬──────────┐
                    ▼           ▼       ▼        ▼          ▼
                 Approve     Decline  On Hold   Merge     None/Clear
                 "approved"  "declined" "on_hold" "merged"  "new"
                    │                                        │
                    ▼                                   Back to inbox
              (if ClickUp ON)                      (eligible for re-consolidation)
              dhub-execute-decision
              edge function
                    │
                    ▼
              ClickUp task created
              status → "tracking"
```

---

## Status Values

| Status | Meaning | Where it lives |
|--------|---------|----------------|
| `raw` | Just captured from Slack/email, not yet processed | Waiting for consolidation |
| `new` | In the inbox, awaiting a decision | Visible in Inbox page |
| `consolidated` | Merged into another item or marked as noise | Hidden from inbox |
| `approved` | Decision: approved | Has a `decisions` record |
| `declined` | Decision: declined | Has a `decisions` record |
| `on_hold` | Decision: on hold | Has a `decisions` record |
| `merged` | Decision: merged into another request | Has a `decisions` record |
| `tracking` | Approved + ClickUp task created | Linked to ClickUp via `clickup_task_id` |
| `completed` | ClickUp task marked complete | Final state |

---

## Stage 1: Intake

### Slack Poll (`dhub-slack-poll`)
- **Trigger:** pg_cron job every 15 minutes
- **Source:** `#ia-nhaapp-jck` channel (C0AP6NYD7B5)
- **Dedup:** Checks `source_ref` (message timestamp) + `source_channel`. If already exists, skips.
- **Timestamp tracking:** Uses `dhub.poll_state.last_message_ts` to only fetch new messages
- **Output:** Inserts with `status: "raw"`
- **Does NOT check request status** — purely timestamp/ref based dedup

### Email Receive (`dhub-email-receive`)
- **Trigger:** Resend webhook when email arrives at `decisions@nha-ai.com`
- **Dedup:** Checks `source_ref` (Resend email ID). If already exists, skips.
- **Threading:** If email is a reply (has `In-Reply-To` header matching `dhub-{id}@nha-ai.com`), creates a `communications` entry instead of a new request
- **Output:** Inserts with `status: "raw"`
- **Does NOT check request status**

### Manual Upload (website)
- **Trigger:** Admin uploads via Upload page
- **Output:** Inserts with `status: "new"` (skips consolidation)

---

## Stage 2: Consolidation (`dhub-consolidate`)

- **Trigger:** "Process Now" button on Inbox page (admin only)
- **Gate:** Requires at least one `status: "raw"` item. If no raw items exist, returns immediately — even if there are `new` items to potentially regroup.

### What it does:
1. Fetches all `status: "raw"` items
2. Fetches all `status: "new"` AND `consolidated_into IS NULL` items
3. Sends both sets to Claude for analysis
4. Claude outputs actions for each item:

| Action | What happens |
|--------|-------------|
| `standalone` | Promoted to `status: "new"` with AI-generated title/category/description |
| `keep` | Raw items promoted to `status: "new"` as-is; already-new items left alone |
| `group` (primary) | Becomes `status: "new"`, absorbs content from grouped items |
| `group` (non-primary) | Set to `status: "consolidated"` with `consolidated_into` pointing to primary |
| `noise` | Set to `status: "consolidated"` (hidden) |

### Reset-to-new behavior:
A previously-decided item reset to `status: "new"` WILL be included in the next consolidation run (because it matches the `status: "new"` query). Claude may rename it, merge it with new incoming items, or leave it alone. **This is intentional** — a reset item should be treated as if no decision was ever made.

However: consolidation only runs when raw items exist. A reset item sitting alone with no new intake will not be re-consolidated until new Slack/email messages arrive.

---

## Stage 3: AI Analysis (`dhub_analyze.py`)

- **Trigger:** `python scripts/dhub_analyze.py` (manual or via routine)
- **Filter:** `ai_analyzed_at IS NULL AND description IS NOT NULL`
- **Does NOT filter by status** — any unanalyzed request gets processed
- **Output:** Populates `ai_analysis` JSON (summary, related ClickUp items, category suggestion, priority suggestion) and sets `ai_analyzed_at`

### Reset-to-new behavior:
When a decision is cleared, `ai_analyzed_at` is also nulled out. This means the item will be re-analyzed on the next analysis run, getting fresh ClickUp matches and suggestions.

---

## Stage 4: Decision (Website)

The DecisionForm always shows these buttons: **None | Approve | Decline | On Hold | Merge**

| User action | What happens in DB |
|-------------|-------------------|
| Select None (on decided item) → Clear Decision | Deletes `decisions` record, sets request `status: "new"`, clears `consolidated_into`, clears `ai_analyzed_at` |
| Select Approve → Submit | Creates `decisions` record, sets request `status: "approved"`. If ClickUp ON, fires edge function. |
| Select Decline → Submit | Creates `decisions` record (auto-executed), sets request `status: "declined"` |
| Select On Hold → Submit | Creates `decisions` record (auto-executed), sets request `status: "on_hold"` |
| Select Merge → Submit | Creates `decisions` record, sets request `status: "merged"`, sets `consolidated_into`, absorbs content into target |
| Change decision (e.g. Approve → Decline) → Update | Deletes old `decisions` record, creates new one, updates status |

### ClickUp integration toggle
- **Setting:** `dhub.app_settings` key `clickup_integration` → `{enabled: true/false}`
- **When OFF:** Approve saves to DB only, `executed: false`, no ClickUp task created
- **When ON:** Approve fires `dhub-execute-decision` edge function, which creates ClickUp task via REST API
- **Sync pending:** Admin page has "Sync to ClickUp" button to batch-execute all unexecuted approvals
- **Toggle location:** Admin page (admin-only nav item)

---

## Stage 5: ClickUp Execution (`dhub-execute-decision`)

- **Trigger:** Fire-and-forget from DecisionForm after approve (if ClickUp enabled)
- **Also callable from:** Admin page "Sync to ClickUp" button
- **Filter:** `decisions WHERE executed = FALSE AND action = 'approve'`
- **Category → List routing:**

| Category | ClickUp List |
|----------|-------------|
| bug, ux, data, question | Technical (901308350898) |
| feature | Keyword-matched (Posts, Calendar, etc.) or Task List fallback |

- **On success:** Sets `executed: true`, `clickup_task_id`, `clickup_task_url`, request `status: "tracking"`

### Reset-to-new after ClickUp execution:
If an item was approved, a ClickUp task was created, and you later clear the decision:
- The `decisions` record is deleted (including `clickup_task_id`)
- The request goes back to `status: "new"`
- The orphaned ClickUp task remains in ClickUp (no automatic cleanup)
- Status sync (`dhub_status_sync.py`) won't find a matching decision, so it won't overwrite the `new` status

---

## Stage 6: Status Sync (`dhub_status_sync.py`)

- **Trigger:** `python scripts/dhub_status_sync.py` (manual or via routine)
- **Filter:** `decisions WHERE action = 'approve' AND executed = TRUE AND clickup_task_id IS NOT NULL`
- **Maps ClickUp status → request status:**
  - backlog, ready for dev, in progress, po review → `tracking`
  - complete → `completed`
- **Safe with reset:** If the decision was deleted during clear, no matching row exists, so status sync skips the item.

---

## Stage 7: Notifications (`dhub_execute.py --notify`)

- **Trigger:** `python scripts/dhub_execute.py --notify` (manual or via routine)
- **Filter:** `decisions WHERE executed = TRUE` and no matching `communications` entry
- **Slack-sourced:** Replies on original Slack thread
- **Email-sourced:** Sends email from `decisions@nha-ai.com` via Resend API
- **Safe with reset:** If the decision was deleted, no notification triggers.

---

## Routine (`dhub_routine.py`)

Orchestrates all background processing in order:
1. ClickUp sync (`dhub_clickup_sync.py`)
2. Embeddings (`dhub_embeddings.py`)
3. AI analysis (`dhub_analyze.py`)
4. Execution (`dhub_execute.py --execute`)
5. Notifications (`dhub_execute.py --notify`)
6. Status sync (`dhub_status_sync.py`)

**Not currently scheduled.** Tier 2 scheduling mechanism not yet built. Scripts exist but must be run manually.

---

## Key Database Tables (`dhub` schema)

| Table | Purpose |
|-------|---------|
| `requests` | All incoming requests. Status tracks lifecycle. |
| `decisions` | One per request (deleted on clear). Links request to action, priority, sprint, ClickUp task. |
| `sprints` | Sprint definitions with date ranges and active flag. |
| `communications` | Notification log (Slack thread replies, emails sent). |
| `clickup_snapshot` | Mirror of ClickUp tasks for comparison. |
| `embeddings` | pgvector embeddings for similarity search. |
| `poll_state` | Slack poll watermark (`last_message_ts`, `last_poll_at`). |
| `app_settings` | Key-value settings (ClickUp toggle, etc.). |

---

## Infrastructure

| Component | Location |
|-----------|----------|
| **Website** | dh.nha-ai.com (Vercel, auto-deploys from GitHub main) |
| **Repo** | `~/Claude-Projects/WebApps/NHA-Decision-Hub/` → `cenovioj-lifeline/nha-decision-hub` |
| **Database** | Supabase project `nhwdgstjhugezhqlktie`, schema `dhub` |
| **Edge functions** | `~/Claude-Projects/NHAWork/supabase/functions/dhub-*` |
| **Python scripts** | `~/Claude-Projects/NHAWork/scripts/dhub_*.py` |
| **Credentials** | `~/Claude-Projects/LifelinePublic/.credentials/nha-supabase.json` (DB), `.credentials/clickup-credentials.json` (ClickUp API) |
| **ClickUp token** | Also stored as Supabase secret `CLICKUP_API_TOKEN` |
| **Slack bot token** | `xoxb-2152209533-...` (in scripts + edge function secrets) |
| **Resend API** | Stored as Supabase secret `RESEND_API_KEY` |

---

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `dhub-slack-poll` | pg_cron (15 min) | Captures new Slack messages → `raw` |
| `dhub-email-receive` | Resend webhook | Captures emails → `raw` |
| `dhub-consolidate` | "Process Now" button | Groups/renames raw items → `new` |
| `dhub-execute-decision` | Website approve action | Creates ClickUp task → `tracking` |
| `dhub-email-notify` | (exists, not actively used) | Sends email notifications |

---

## ClickUp Integration

| Detail | Value |
|--------|-------|
| **Workspace** | 9013684742 |
| **Space** | NHA App (90132755413) |
| **Features folder** | 90134411882 (23 lists) |
| **API** | Personal token (`pk_132001057_...`), REST API v2 |
| **MCP** | Also available in Claude Code sessions (OAuth) |
| **Tags** | Not yet created (`cenovio`, sprint date tags) |
| **Custom fields** | Not yet created ("Cenovio's Estimate") |
