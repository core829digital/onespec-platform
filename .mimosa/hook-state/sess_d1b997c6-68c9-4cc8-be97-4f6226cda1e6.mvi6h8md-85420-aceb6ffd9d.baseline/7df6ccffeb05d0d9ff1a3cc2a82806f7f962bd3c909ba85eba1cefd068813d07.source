import { JoinTeam } from "@/components/auth/join-team";

/**
 * Server-rendered shell: the invitation token is read here from the link (`?i=`), so the form is on screen with the first byte of HTML
 * instead of waiting for the browser to run code, load the sign-in client and read the address.
 */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.i) ? sp.i[0] : sp.i;
  const token = typeof raw === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : "";
  return <JoinTeam initialToken={token} />;
}
