export default function App() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-sm font-semibold tracking-tight">foobar</h1>
          <span className="text-xs text-muted-foreground">
            SQLite analytics · AI autocomplete
          </span>
        </div>
      </header>
      <main className="flex-1 p-4">
        <p className="text-sm text-muted-foreground">Setting up…</p>
      </main>
    </div>
  )
}
