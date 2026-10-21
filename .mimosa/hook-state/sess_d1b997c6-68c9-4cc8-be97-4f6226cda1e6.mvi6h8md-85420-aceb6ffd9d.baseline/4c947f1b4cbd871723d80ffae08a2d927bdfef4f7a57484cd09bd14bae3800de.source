// @vitest-environment node
// Smoke render of every logged-in page in every language with an empty/loading backend:
// no page may crash, and no page may reference a translation key that does not exist.
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, test, vi } from "vitest";
import it from "../messages/it.json";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import nl from "../messages/nl.json";
import ro from "../messages/ro.json";

const scenario = vi.hoisted(() => ({ loaded: false }));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  const TENANT = {
    _id: "t1", name: "Acme Serramenti", slug: "acme", plan: "pro", planStatus: "active", country: "IT", currency: "EUR",
    ownerUserId: "u1", createdAt: 1, role: "owner", myRole: "owner", enabledModules: [], features: {},
  };
  return {
  useQuery: (fn: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (!scenario.loaded || args === "skip") return undefined;
    const name = getFunctionName(fn);
    if (name === "tenants:getMyTenant") return TENANT;
    if (/:(list|listAll|listClients|listCantieri|listSuppliers|search)\w*$/.test(name)) return [];
    return undefined;
  },
  useMutation: () => async () => undefined,
  useAction: () => async () => undefined,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useConvex: () => ({}),
  ConvexReactClient: class {},
  ConvexProvider: ({ children }: { children: unknown }) => children,
  usePaginatedQuery: () => ({ results: [], status: "LoadingFirstPage", loadMore: () => {} }),
  };
});
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: async () => undefined, signOut: async () => undefined }),
  useAuthToken: () => null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, back() {}, prefetch() {}, refresh() {} }),
  usePathname: () => "/app/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "x", token: "x", slug: "privacy", locale: "it" }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (p: { href: string; children?: unknown; className?: string }) => h("a", { href: p.href, className: p.className }, p.children as never),
  useRouter: () => ({ push() {}, replace() {}, back() {}, prefetch() {}, refresh() {} }),
  usePathname: () => "/app/dashboard",
  redirect: () => {},
}));
vi.mock("@/lib/use-friendly-error", () => ({ useFriendlyError: () => () => "error" }));

// `use(params)` needs an already-fulfilled thenable to render synchronously.
function resolved<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: "fulfilled", value }) as Promise<T>;
}

const MESSAGES = { it, en, fr, de, nl, ro } as const;
type Loc = keyof typeof MESSAGES;

const pages = import.meta.glob("../src/app/[[]locale[]]/app/**/page.tsx");

// Pages that need route params resolved on the server (async components) are skipped.
const names = Object.keys(pages).sort();

describe("logged-in pages render in every language", () => {
  test("found the pages", () => {
    expect(names.length).toBeGreaterThan(25);
  });

  for (const path of names) {
    test(path.replace("../src/app/[locale]/app/", ""), async () => {
      const mod = (await pages[path]()) as { default: unknown };
      const Page = mod.default as (p: unknown) => unknown;
      if ((Page as { constructor?: { name?: string } }).constructor?.name === "AsyncFunction") return; // server component
      for (const loaded of [false, true]) for (const locale of Object.keys(MESSAGES) as Loc[]) {
        scenario.loaded = loaded;
        const problems: string[] = [];
        let html = "";
        try {
          html = renderToString(
            h(NextIntlClientProvider, {
              locale,
              timeZone: "UTC",
              messages: MESSAGES[locale] as never,
              onError: (e: Error) => problems.push(e.message),
              children: h(Page as never, { params: resolved({ locale, id: "x" }) } as never),
            }),
          );
        } catch (e) {
          throw new Error(`${path} (${locale}) crashed (${loaded ? "tenant loaded" : "loading"}): ${(e as Error).message}`);
        }
        expect(problems, `${path} (${locale})`).toEqual([]);
        expect(html).not.toMatch(/MISSING_MESSAGE|\bundefined\b|\bNaN\b|\[object /);
      }
    }, 30000);
  }
});
