/** Re-mounts on every navigation inside /app, which replays the short page-in animation (opacity + 6 px, see .os-page in globals.css). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="os-page">{children}</div>;
}
