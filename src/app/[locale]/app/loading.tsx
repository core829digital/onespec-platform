export default function AppLoading() {
  return (
    <div className="space-y-4 max-w-5xl animate-pulse">
      <div className="h-8 w-48 rounded bg-[var(--color-bg-alt)]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[var(--color-bg-alt)]" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-[var(--color-bg-alt)]" />
    </div>
  );
}
