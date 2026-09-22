# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured with Session Replay, Error Tracking, and Support enabled; health, error, and support responders are active; and Replay Vision monitors are armed. The scout fleet now has six enabled scouts, including two custom monitors for operational workflows.

New findings should begin appearing in the [Self-driving inbox](https://us.posthog.com/project/622953/inbox) within about 30 minutes as fresh events and recordings arrive.

## AI data processing

Approved. Organization-level AI data processing approval was available before this setup ran.

## GitHub

The PostHog GitHub App was already connected before this run. No GitHub Issues warehouse source or responder was requested in this run.

## Products enabled

| Product | Status | Notes |
|---|---|---|
| Session Replay | enabled | Web client initialization does not disable recording. No recordings were found yet, so Replay Vision monitors are armed for first traffic. |
| Error Tracking | enabled | Web client initialization explicitly enables exception capture. |
| Support / Conversations | enabled | Tickets will arrive only after an inbound Support channel (email, inbox, or Slack) is connected. |

## Signal sources

| Source product | Source type | Action | Notes |
|---|---|---|---|
| `health_checks` | `health_issue` | enabled | Captures instrumentation and configuration health issues. |
| `error_tracking` | `issue_created` | enabled | Captures newly created error issues. |
| `error_tracking` | `issue_reopened` | enabled | Captures recurring error issues. |
| `error_tracking` | `issue_spiking` | enabled | Captures rapidly increasing error issues. |
| `conversations` | `ticket` | enabled | Ready for tickets once a Support inbound channel exists. |
| `signals_scout` | `cross_source_issue` | skipped — on by default | No opt-out row existed, so scout findings can reach the inbox by default. |
| `session_replay` | `session_analysis_cluster` | skipped — retired | Replay coverage is provided by the Replay Vision scanners below. |
| `replay_vision` | scanner-owned | enabled through scanners | Both monitors have `emits_signals: true`; no separate source row is needed. |
| `sentry` | `issue` | enabled, dormant | Selected during setup; it remains silent until a Sentry warehouse source is connected. |
| `llm_analytics` | `evaluation_report` | already enabled / not modified | Present in the final project configuration. |
| `analytics` | `anomaly_investigation` | already enabled / not modified | Present in the final project configuration. |

## Connected tools

| Tool | Result | Notes |
|---|---|---|
| Sentry | responder enabled but warehouse source not detected (dormant) | The secure connection page was completed, but no stored credential or warehouse source was detectable afterwards. The responder will activate automatically when a Sentry source begins syncing. |
| GitHub Issues, Linear, Jira, Zendesk | not used | Not selected in the connected-tools choice. |

## Scout troop

**Enabled (6):**

| Scout | Why it is enabled |
|---|---|
| General | Cross-product correlations and surfaces without a specialist. |
| Product analytics | Core product journeys and usage patterns are instrumented. |
| Revenue analytics | Stripe billing and checkout code are present. |
| Web analytics | This is a browser-based application with web journeys. |
| Quote-to-worksite handoff | Custom operational workflow monitor. |
| Configurator launch readiness | Custom activation workflow monitor. |

**Disabled (23):**

| Scout | Why it is disabled |
|---|---|
| AI observability | No AI/LLM telemetry evidence. |
| Anomaly detection | No saved-insight or dashboard evidence to prioritize. |
| APM | No tracing/APM evidence. |
| Conversations | Ticket intake is covered by the native Support responder. |
| CSP violations | CSP reporting events are not configured. |
| Customer analytics | No account/group analytics evidence. |
| Data pipelines | No CDP, export, or pipeline evidence. |
| Data warehouse | No warehouse source is connected. |
| Error tracking | Covered by the native Error Tracking responders. |
| Experiments | No active experiment evidence. |
| Feature flags | No active feature-flag evidence. |
| Inbox validation | Fresh setup has no resolved Self-driving reports to validate. |
| Insight alerts | No configured insight-alert surface to prioritize. |
| Logs | PostHog Logs is not in use. |
| MCP tool calls | No MCP-tool telemetry product evidence. |
| Observability gaps | Kept selective; the General scout provides broad coverage. |
| PR follow-up | Not prioritized for this product surface. |
| Replay Vision | New scanners have no historical observations yet. |
| Session replay | Covered by Replay Vision scanners. |
| Skills store | No production skills-store monitoring need identified. |
| Surveys | No PostHog survey activity found. |
| Tasks | No PostHog Tasks product evidence. |
| Web vitals | No Core Web Vitals evidence to prioritize. |

**Run budget:** 100 runs/day enforced; 0 used at setup time and 100 remaining. Announcement: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

## Custom scouts

| Scout | What it watches | Discriminator | Why it is distinct |
|---|---|---|---|
| `signals-scout-quote-worksite-handoff` | Progress from quote creation to worksite creation and status advancement | Aged handoff completion rate and handoff delay, conditioned on healthy quote volume | The generic product-analytics scout can identify broad conversion shifts but does not own this operational handoff and delivery sequence. |
| `signals-scout-configurator-launch-readiness` | Progress from creating a configurator to publishing it | Publish-within-expected-lag rate, conditioned on healthy creation volume | The generic product-analytics scout partly covers activation, but not this product-specific launch-readiness condition. |

Both custom scouts were approved and created. They avoid reporting incomplete cohorts, low-volume changes, single-user behavior, and changes explained by falling entry volume. If either becomes noisy, set its scout configuration’s `emit` value to `false` in PostHog to run it in dry-run mode.

Considered but not added as custom scouts: native error tracking and session replay (each already has its own inbox route), generic billing health (covered by Revenue analytics), and generic web funnel changes (covered by Product analytics and Web analytics).

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes unambiguous visible defects to the inbox. These are the only items in this setup that consume Replay Vision quota. Findings arrive at half weight and need independent corroboration before promotion into a Self-driving report.

| Brief | Scanner | Status | Query scope | Sampling | Estimate |
|---|---|---|---|---:|---|
| Breakage monitor | [Onboarding completion breakage](https://us.posthog.com/project/622953/replay-vision/01a0ca87-6b5e-7457-80b5-a3a99fc5cd7a) | created | Recordings whose current URL contains `/onboarding`; this is the completion flow containing billing, setup completion, and first configurator creation. | 50% | 0 observations / 0 credits per month until recordings begin. |
| Frustration monitor | [Workspace frustration](https://us.posthog.com/project/622953/replay-vision/01a0ca87-6cf5-79a4-931c-bb530a6fbb63) | created | Recordings containing a rage-click event only; it has no URL filter, preserving independence from the breakage monitor. | 100% | 0 observations / 0 credits per month until recordings begin. |

Replay Vision budget at setup: 2,500 credits remaining this period, with 0 credits used. No recordings were available during setup; both scanners are enabled and will begin working when recordings arrive. Rate scanner observations thumbs up or down in their Replay Vision pages after the first sweeps to receive a configuration recommendation.

## Files created or modified

| Path | Change |
|---|---|
| `posthog-self-driving-report.md` | Created this setup report. |
| `.claude/skills/replay-vision-scanners-core/` | Installed shared Replay Vision scanner workflow. |
| `.claude/skills/replay-vision-scanner-broken-experiences/` | Installed breakage-monitor brief. |
| `.claude/skills/replay-vision-scanner-user-frustration/` | Installed frustration-monitor brief. |

No application source files were changed.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) so the enabled Support responder can receive tickets.
- [ ] Finish or repeat the secure [Sentry warehouse connection](https://us.posthog.com/project/622953/data-warehouse/connect?kind=Sentry), then confirm that a warehouse source appears and begins syncing. The enabled Sentry responder is currently dormant.
- [ ] Generate real browser traffic and recordings so the new Replay Vision scanners and custom scouts can establish a baseline.
- [ ] Review the first Replay Vision observations and rate useful or unhelpful observations from each scanner page.

## What happens next

The scout coordinator picks up fresh configurations within roughly 30 minutes. Scout runs draw from the daily run budget, findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/622953/inbox), and immediately actionable reports can begin coding tasks.
