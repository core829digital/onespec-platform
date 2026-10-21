/**
 * Light front door for Sentry (crash reports) and PostHog (analytics).
 *
 * Both libraries are ~560 KB of JavaScript. Importing them statically put that weight on every page, login included. Everything
 * here is therefore a thin facade: calls made before the real libraries are loaded are queued (in order) and replayed the moment
 * they arrive. Nothing is lost, nothing blocks the first paint.
 *
 * The libraries are loaded (a) once the page has finished loading and the browser is idle, or (b) immediately when something
 * reports an error, so crash reports are never delayed on purpose. The consent rules live in monitoring-init.ts and are unchanged.
 */

type SentryFn = "captureException" | "captureMessage" | "addBreadcrumb";
type PostHogFn = "capture" | "captureException" | "identify" | "reset";
type Call = { lib: "sentry"; fn: SentryFn; args: unknown[] } | { lib: "posthog"; fn: PostHogFn; args: unknown[] };

type Init = typeof import("./monitoring-init");

const MAX_QUEUE = 100;
const queue: Call[] = [];
let loaded: Init | null = null;
let loading: Promise<Init | null> | null = null;
const onLoaded: Array<() => void> = [];

/** Runs `cb` once the real libraries are up (immediately if they already are). */
export function whenMonitoringLoaded(cb: () => void) {
  if (loaded) cb();
  else onLoaded.push(cb);
}

function enqueue(call: Call) {
  queue.push(call);
  if (queue.length > MAX_QUEUE) queue.shift();
}

function run(init: Init, call: Call) {
  try {
    const target = call.lib === "sentry" ? (init.Sentry as unknown as Record<string, unknown>) : (init.posthog as unknown as Record<string, unknown>);
    (target[call.fn] as (...a: unknown[]) => unknown)(...call.args);
  } catch {
    /* monitoring must never break the app */
  }
}

/** Idempotent. Loads the real libraries and replays what was queued. Resolves to null if loading failed (e.g. blocked by an ad-blocker). */
export function startMonitoring(): Promise<Init | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!loading) {
    loading = import("./monitoring-init")
      .then((init) => {
        loaded = init;
        for (const cb of onLoaded.splice(0)) cb();
        for (const call of queue.splice(0)) run(init, call);
        return init;
      })
      .catch(() => null);
  }
  return loading;
}

/** Schedule the load for when the page is done and the browser is idle. */
export function startMonitoringWhenIdle() {
  if (typeof window === "undefined") return;
  const go = () => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(() => void startMonitoring(), { timeout: 4000 });
    else setTimeout(() => void startMonitoring(), 2000);
  };
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

function send(call: Call, urgent = false) {
  if (loaded) return run(loaded, call);
  enqueue(call);
  if (urgent) void startMonitoring();
}

export const sentry = {
  /** Errors load the library at once: a crash report is never held back. */
  captureException: (...args: unknown[]) => {
    if (typeof window === "undefined") {
      // Server side (tests, SSR): the real Sentry is already a server dependency.
      void import("@sentry/nextjs").then((S) => S.captureException(args[0])).catch(() => {});
      return;
    }
    send({ lib: "sentry", fn: "captureException", args }, true);
  },
  captureMessage: (...args: unknown[]) => send({ lib: "sentry", fn: "captureMessage", args }, true),
  addBreadcrumb: (...args: unknown[]) => send({ lib: "sentry", fn: "addBreadcrumb", args }),
};

export const analytics = {
  capture: (...args: unknown[]) => send({ lib: "posthog", fn: "capture", args }),
  captureException: (...args: unknown[]) => send({ lib: "posthog", fn: "captureException", args }),
  identify: (...args: unknown[]) => send({ lib: "posthog", fn: "identify", args }),
  reset: (...args: unknown[]) => send({ lib: "posthog", fn: "reset", args }),
};

/**
 * Cookie-banner switch (PostHog capture + Sentry Replay on/off). Granting loads the libraries now; refusing while they are not
 * loaded needs nothing, because they always start opted-out.
 */
export async function applyConsent(granted: boolean) {
  if (!granted && !loaded) return;
  const init = await startMonitoring();
  init?.applyConsent(granted);
}

/** Tracks the router transition for Sentry once it is loaded (Next calls this on every navigation). */
export function routerTransitionStart(href: string, navigationType: "push" | "replace" | "traverse") {
  loaded?.Sentry.captureRouterTransitionStart(href, navigationType);
}
