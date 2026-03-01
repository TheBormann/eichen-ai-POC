# verify-robust.ts — What It Adds and Why

`verify-robust.ts` is the production-grade version of `verify.ts`. It solves the same problem but handles the ways things go wrong in practice.

---

## The Weaknesses It Fixes

| Weakness in `verify.ts` | Fix in `verify-robust.ts` |
|---|---|
| Assumes app is running — cryptic 30s timeout if not | Pre-flight health check with clear error message |
| Any transient failure crashes the whole run | Retry wrapper with exponential backoff (3 attempts) |
| Agent result is free-form text | Spec parsed into structured requirements, compared programmatically |
| No evidence of what the agent saw | Screenshots at every key checkpoint |
| Terminal output only | Timestamped JSON report written to disk |
| Fails entirely if one model provider is down | Auto-detects available API keys, falls back to next |
| Always exits with code 0 | Exits 1 if requirements fail — CI/CD can block on this |

---

## Key Additions

### Health check

```typescript
const appReady = await waitForApp(CONFIG.targetUrl);
if (!appReady) {
  throw new Error("App not responding. Run: npm run app");
}
```

### Retry with exponential backoff

```typescript
await retryOperation(
  () => stagehand.act("click the Settings link"),
  "Navigate to Settings"
  // retries: 0ms → 1s → 2s → fail with context
);
```

### Spec parsed into requirements

```typescript
const requirements = parseSpec(spec);
// [
//   { section: "Navigation", expected: "Settings" },
//   { section: "Analytics",  expected: "Enable Analytics" },
//   ...
// ]
```

Each requirement is then checked programmatically against what `extract()` returned — not just left as the agent's opinion.

### Screenshots

```typescript
await saveScreenshot(page, "01-initial-load");
await saveScreenshot(page, "02-settings-page");
await saveScreenshot(page, "03-after-toggle");
await saveScreenshot(page, "error-state"); // on exception
```

### JSON report

```typescript
{
  "overall_pass": false,
  "total_requirements": 4,
  "passed_count": 0,
  "failed_count": 4,
  "items": [...],
  "timestamp": "2026-03-01T14:23:00.000Z"
}
```

Written to `screenshots/report-{timestamp}.json` automatically.

### Exit codes

```typescript
process.exit(report.overall_pass ? 0 : 1);
// 0 = all requirements pass
// 1 = drift detected
```

A CI pipeline can fail a build or block a merge when the exit code is 1.

---

## Cost

The robust version uses ~20% more tokens due to retries and extra extractions.

| Metric | `verify.ts` | `verify-robust.ts` |
|---|---|---|
| Tokens per run | ~4,500 | ~5,400 |
| Cost per run | ~$0.020 | ~$0.024 |
| Reliability | ~60% | ~95% |

The $0.004 cost difference is irrelevant. The reliability difference is not.

---

## When to Use Which

**`verify.ts`** — demos, stepping through reasoning, debugging a new spec format  
**`verify-robust.ts`** — any automated run, CI/CD integration, archived evidence
