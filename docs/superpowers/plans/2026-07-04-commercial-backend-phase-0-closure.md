# Commercial Backend Phase 0 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Phase 0 by verifying Epay recurring-payment capability and locking the remaining documentation state before implementation starts.

**Architecture:** Phase 0 remains documentation-only. The requirements document is the customer-facing source of truth, the Phase 0 design spec defines the audit method, and this plan drives the remaining evidence-gathering and checklist closure.

**Tech Stack:** Markdown docs, Claude Code read/search tools, web documentation lookup for Epay capability, existing AIRI docs under `docs/brainstorms` and `docs/superpowers`.

## Global Constraints

- Follow `AGENTS.md` active customer target for all commercial backend/subscription/provider/UI decisions.
- Customer-confirmed data boundary: accounts, Flux, subscriptions, payments, model catalog, pricing, and billing ledger live in the server DB; chats, character cards, and memory stay in the browser.
- Customer-facing provider UI exposes one official provider only, with selectable models behind it.
- Model billing is fixed Flux per call per model/capability; do not add token-, character-, or text-length-based pricing.
- Subscription is periodic, not a one-time top-up package.
- UI directly references `https://airi.moeru.ai/` and uses the simplest workable profile/subscription design; do not block on extra deletion screenshots.
- Do not write real Epay merchant IDs, keys, or secrets into source-controlled docs.
- Do not commit. Project instructions say not to create commits unless explicitly requested.
- Mark completed checklist items immediately in `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md` and in the visible task list.

---

### Task 1: Verify Epay periodic-payment capability

**Files:**
- Read: `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md`
- Modify: `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md`

**Interfaces:**
- Consumes: Existing open question `Q1. 易支付是否支持真正的自动周期扣款？`
- Produces: A documented decision under a new `Epay Periodic Billing Decision` subsection.

- [ ] **Step 1: Read the current open question and Phase 0 checklist**

Run:

```bash
python - <<'PY'
from pathlib import Path
p = Path('docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md')
text = p.read_text(encoding='utf-8')
for needle in ['Q1. 易支付是否支持真正的自动周期扣款？', '### Phase 0']:
    print(needle, 'FOUND' if needle in text else 'MISSING')
PY
```

Expected: both lines print `FOUND`.

- [ ] **Step 2: Search public Epay/YiPay documentation for recurring or subscription capability**

Use web search queries equivalent to:

```txt
易支付 周期扣款 订阅 支付 接口
易支付 API submit.php notify_url out_trade_no
易支付 自动续费 接口
```

Expected: identify whether the common Epay API supports automatic recurring billing, or only one payment order per checkout.

- [ ] **Step 3: Decide the supported product behavior**

Use this rule:

```txt
If official/provider documentation proves automatic recurring charging exists:
  document automatic recurring billing as supported.
Else:
  document periodic subscription as manual renewal per period:
  the user buys a period, payment success extends currentPeriodEnd and grants that period's Flux;
  renewal requires another checkout before/after expiry.
```

Expected: one clear decision, no ambiguous “maybe”.

- [ ] **Step 4: Update the requirements document with the decision**

Insert this subsection after `## Current Implementation Disposition` if Epay recurring support is not proven:

```markdown
## Epay Periodic Billing Decision

Current decision: implement periodic subscriptions as renewable paid periods through Epay checkout. Each successful Epay payment buys or renews one subscription period, extends `currentPeriodEnd`, and grants that period's Flux exactly once.

Rationale: the common Epay checkout/notify flow is order-based. Until the customer's Epay provider confirms an automatic recurring-charge API, the product must not promise unattended recurring billing. The UI should call this a subscription period and provide renewal before expiry.

Security and audit rule: do not store real merchant credentials in source-controlled files. Runtime configuration must come from deployment/local environment variables.
```

If automatic recurring support is proven, insert this alternate subsection:

```markdown
## Epay Periodic Billing Decision

Current decision: implement periodic subscriptions using the Epay provider's confirmed recurring-charge capability. Each successful recurring charge renews the subscription period and grants that period's Flux exactly once.

Rationale: customer has merchant credentials and this delivery requires real payment. The recurring implementation must verify provider signatures, amount, plan, period, and idempotency before extending subscriptions.

Security and audit rule: do not store real merchant credentials in source-controlled files. Runtime configuration must come from deployment/local environment variables.
```

Expected: requirements doc contains exactly one `## Epay Periodic Billing Decision` section.

- [ ] **Step 5: Update Phase 0 checklist**

Change:

```markdown
- [ ] 确认易支付是否支持自动周期扣款。
```

to:

```markdown
- [x] 确认易支付是否支持自动周期扣款。
```

Expected: Phase 0 checklist has three checked items and no unchecked Epay capability item.

- [ ] **Step 6: Verify no secrets were written**

Run:

```bash
python - <<'PY'
from pathlib import Path
p = Path('docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md')
text = p.read_text(encoding='utf-8')
for forbidden in ['EPAY_KEY=', 'EPAY_PID=', 'merchant secret', '商户密钥：', '商户号：']:
    print(forbidden, 'FOUND' if forbidden in text else 'OK')
PY
```

Expected: every line prints `OK`.

### Task 2: Align Phase 0 design spec with the Epay decision

**Files:**
- Modify: `docs/superpowers/specs/2026-07-04-commercial-backend-phase-0-design.md`

**Interfaces:**
- Consumes: `## Epay Periodic Billing Decision` from Task 1.
- Produces: Phase 0 design spec that no longer treats Epay periodic behavior as unresolved after Task 1.

- [ ] **Step 1: Update the risks section**

If Task 1 selected manual renewal, replace the existing subscription ambiguity bullet with:

```markdown
- **Epay periodic behavior:** Automatic recurring charging is not assumed. Phase 0 documents periodic subscription as renewable paid periods through Epay checkout unless the customer's provider confirms a recurring API.
```

If Task 1 selected automatic recurring support, replace it with:

```markdown
- **Epay periodic behavior:** Epay recurring charging is confirmed for this customer/provider. Implementation must still verify signatures, amount, plan, period, and idempotency before extending subscriptions.
```

Expected: no design-spec sentence says the Epay periodic decision is still unknown.

- [ ] **Step 2: Verify the design spec has no placeholders**

Run:

```bash
python - <<'PY'
from pathlib import Path
p = Path('docs/superpowers/specs/2026-07-04-commercial-backend-phase-0-design.md')
text = p.read_text(encoding='utf-8')
for forbidden in ['TBD', 'TODO', '待定', 'placeholder']:
    print(forbidden, 'FOUND' if forbidden in text else 'OK')
PY
```

Expected: every line prints `OK`.

### Task 3: Final Phase 0 documentation self-review

**Files:**
- Read: `docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md`
- Read: `docs/superpowers/specs/2026-07-04-commercial-backend-phase-0-design.md`
- Read: `AGENTS.md`

**Interfaces:**
- Consumes: completed Task 1 and Task 2 documents.
- Produces: final Phase 0 status report for the user.

- [ ] **Step 1: Check active customer target exists in AGENTS**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('AGENTS.md').read_text(encoding='utf-8')
checks = [
    'Active Customer Target: Commercial Backend + Subscription',
    'docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md',
    'one official provider',
    'fixed Flux-per-call',
]
for c in checks:
    print(c, 'FOUND' if c in text else 'MISSING')
PY
```

Expected: every line prints `FOUND`.

- [ ] **Step 2: Check Phase 0 checklist state**

Run:

```bash
python - <<'PY'
from pathlib import Path
text = Path('docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md').read_text(encoding='utf-8')
for line in text.splitlines():
    if line.startswith('- [') and ('Phase 0' not in line):
        if any(key in line for key in ['输出本需求文档', '对当前已实现能力打标', '明确客户要删除', '确认易支付']):
            print(line)
PY
```

Expected:

```markdown
- [x] 输出本需求文档。
- [x] 对当前已实现能力打标：保留、复用、重构、删除。
- [x] 明确客户要删除的 UI 截图清单：当前不按额外截图删除 UI，订阅/个人中心直接参考 `https://airi.moeru.ai/` 做简单方案。
- [x] 确认易支付是否支持自动周期扣款。
```

- [ ] **Step 3: Report changed documentation files**

Run:

```bash
git status --short -- AGENTS.md docs/brainstorms/2026-07-04-commercial-backend-subscription-requirements.md docs/superpowers/specs/2026-07-04-commercial-backend-phase-0-design.md docs/superpowers/plans/2026-07-04-commercial-backend-phase-0-closure.md
```

Expected: all changed files are documentation or agent guidance files. Do not commit.

- [ ] **Step 4: Mark visible tasks complete**

In the Claude task list, mark the Phase 0 closure/plan tasks complete only after Steps 1-3 pass.

Expected: no visible task remains `in_progress` before reporting completion.
