export default function WidgetNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">Configuratore non disponibile</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
          Questo configuratore non esiste o non è ancora stato pubblicato.
        </p>
      </div>
    </div>
  );
}
