// Middleware disabled to fix Next.js 16 headers() async issue
// Auth handling moved to layout/page level
export const config = { matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"] };

export default function middleware() {
  // No-op middleware to avoid async headers() issues
}