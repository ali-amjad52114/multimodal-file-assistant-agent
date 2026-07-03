# FaultPack AI

**3 PDFs to a 3-minute troubleshooting brief.**

FaultPack AI takes the three PDFs industrial electricians normally search manually — the electrical drawing, the OEM manual, and the site safety procedure — and turns them into a **traceable field troubleshooting brief** in minutes. Built on the Claude Agent SDK and deployed on Tencent EdgeOne Makers.

**Framework:** Claude Agent SDK · **Category:** Industrial / Document Intelligence · **Language:** TypeScript

> FaultPack AI does not replace qualified electrical judgment. It summarizes relevant documents, flags missing safety evidence, and prepares a traceable troubleshooting brief for review.

## The Problem

When a machine goes down, an electrician needs three separate documents before touching anything:

| Document | What's buried in it |
|----------|---------------------|
| 📐 Electrical drawing | MCC bucket, breaker, interlocks, permissives, power path |
| 📕 OEM manual | Fault codes, drive/motor troubleshooting steps |
| 📋 Site safety procedure | Lockout/tagout (LOTO), reset authorization, escalation rules |

Searching them manually takes hours during active downtime — and skipping the safety document isn't just slow, it's dangerous.

## What FaultPack AI Does

1. **Upload** the three documents into labeled slots (drawing / manual / procedure).
2. **Describe** the fault once: *"Conveyor CV-104 is down. VFD shows overcurrent. Need to inspect the MCC bucket and reset the breaker."*
3. The agent **searches all three PDFs** in a sandbox (pdfplumber, page-level citations) and emits a **live trace event for every step**.
4. A **safety gate** runs before anything else matters: electrical access requested + no LOTO evidence = **⛔ BLOCKED UNTIL SAFETY CHECK**. No exceptions.
5. Output: likely causes (ranked), what to check, document references with page numbers, missing information.
6. One click generates a downloadable **Field Troubleshooting Brief PDF** — including the full trace log and a supervisor review section.

**The trace is the product.** Every recommendation shows which documents were used, which pages, which rules were triggered, and why the decision was made. That audit trail is what lets safety-critical industries actually adopt AI.

## Why EdgeOne Makers Matters

- **Agent runtime** — runs the industrial troubleshooting agent (session mode keeps documents and sandbox state alive across the whole conversation)
- **Sandboxed tools** — searches PDFs safely with `code_interpreter` (pdfplumber) in an isolated environment
- **Serverless execution** — generates the troubleshooting brief PDF (matplotlib/PdfPages) on demand
- **Session cache / storage** — uploaded documents and analysis state persist across turns
- **Observability & tracing** — every recommendation becomes an auditable trace timeline
- **One-click deployment** — a maintenance department can roll it out across an organization without an infrastructure team

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_API_KEY` | Yes | Model gateway API key. Use your Makers Models API Key, or any OpenAI-compatible provider key. |
| `AI_GATEWAY_BASE_URL` | Yes | Gateway base URL. For Makers Models, use `https://ai-gateway.edgeone.link/v1`. |
| `AI_GATEWAY_MODEL` | No | Model ID. Defaults to `@makers/deepseek-v4-flash`. |

## Local Development

**Prerequisites**
- Node.js 18+
- EdgeOne CLI (`npm i -g edgeone`)

```bash
npm install
cp .env.example .env
# Edit .env with your AI_GATEWAY_API_KEY and AI_GATEWAY_BASE_URL
edgeone makers dev
```

Open the local observability dashboard at http://localhost:8088/agent-metrics.

## Demo Walkthrough (Conveyor CV-104)

1. Click **Load demo documents** — loads 3 sample PDFs + 3 TXT mirrors (extraction fallback layer).
2. The agent acknowledges the documents with trace events.
3. Type: *"Conveyor CV-104 is down. VFD shows overcurrent fault. Need to inspect the MCC bucket and reset the breaker."*
4. Watch the live **Trace timeline**: asset detected → drawing searched → fault code F0C1 matched in manual → LOTO rule found in procedure → decision.
5. See the red **BLOCKED UNTIL SAFETY CHECK** card with required evidence.
6. Click **Generate Troubleshooting PDF** → download the brief (problem summary, safety decision, likely causes, page-cited references, missing info, full trace log, supervisor review section).

Regenerate the demo pack anytime with `node scripts/generate-demo-pdfs.mjs` (self-verifies that key strings are pdfplumber-extractable).

## Reliability Layers

- **TXT mirrors** — each demo PDF ships with an identical `.txt`; if PDF extraction returns empty/garbled text, the agent falls back to the mirror and records an `extraction_fallback` trace step.
- **Honest failure** — for real user PDFs with no mirror, the agent never guesses: it reports the extraction failure, sets the safety decision to *needs more info*, and asks for a text-based (non-scanned) PDF.
- **Sandbox-down fallback** — if the sandbox is unavailable, TXT content is inlined into the prompt and the agent states that page citations are unavailable.

## Project Structure

```
multimodal-file-assistant-agent/
├── agents/
│   ├── chat/
│   │   ├── index.ts       # POST /chat — agent loop, trace/decision persistence, SSE
│   │   ├── _skills.ts     # FaultPack system prompt: PDF search, safety gate, brief structure
│   │   ├── _templates.ts  # Field Troubleshooting Brief PDF template (matplotlib)
│   │   └── _tools.ts      # Shell quoting, text-inline fallback, default actions
│   ├── stop/index.ts      # POST /stop — abort active run
│   ├── _model.ts          # Model name resolution, gateway env mapping
│   └── _shared.ts         # SSE helpers, logger
├── cloud-functions/health/ # GET /health — liveness probe
├── app/                    # Next.js frontend: slots, trace timeline, safety cards
├── lib/i18n.tsx            # English / Chinese translations
├── public/demo/            # CV-104 demo pack (3 PDFs + 3 TXT mirrors)
├── scripts/generate-demo-pdfs.mjs  # Self-verifying demo pack generator
└── edgeone.json            # EdgeOne deployment config
```

## Architecture Notes

- **Session mode**: requests with the same `conversation_id` are sticky-routed to the same agent instance and sandbox, so documents and analysis state survive follow-ups.
- **Dual MCP servers**: the EdgeOne sandbox MCP (`code_interpreter`, `commands`, `files`) plus a custom-tools MCP (`report_trace`, `safety_decision`, `suggest_actions`, `deliver_file`).
- **Trace persistence**: `report_trace` events stream to the UI *and* are stored per conversation; when the user clicks *Generate Troubleshooting PDF* (a new request), the stored trace log and safety decision are injected into the prompt so the PDF's trace matches the UI step-for-step.
- `/stop` cancels an active run — send `conversation_id` in the body only (the `makers-conversation-id` header would sticky-route the stop to the busy instance).

## License

MIT
