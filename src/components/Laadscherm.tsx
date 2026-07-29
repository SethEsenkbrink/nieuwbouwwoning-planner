export function Laadscherm({ tekst = "Even laden…" }: { tekst?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-s2">
        <div
          className="size-8 animate-spin rounded-pill border-2 border-bone border-t-clay"
          aria-hidden="true"
        />
        <p className="text-body text-slate">{tekst}</p>
      </div>
    </div>
  );
}
