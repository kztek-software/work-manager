export default function ProjectLoading() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-5 animate-pulse overflow-hidden bg-background">
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="h-6 w-32 bg-surface-2 rounded-lg" />
          <div className="h-5 w-20 bg-surface-2/60 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-surface-2 rounded-xl" />
          <div className="h-8 w-8 bg-surface-2 rounded-xl" />
        </div>
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between">
            <div className="h-3 w-16 bg-surface-2 rounded" />
            <div className="h-7 w-12 bg-surface-2 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 rounded-2xl border border-line bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-40 bg-surface-2 rounded" />
          <div className="h-4 w-20 bg-surface-2 rounded" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-2/50 border border-line/40 flex items-center px-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-lg bg-surface-2" />
                <div className="h-3.5 w-48 bg-surface-2 rounded" />
              </div>
              <div className="h-3.5 w-20 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
