// ─── Reusable shimmer skeleton primitives ────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className ?? ""}`} />
  );
}

/** Feed post skeleton */
export function FeedPostSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      {/* Author row */}
      <div className="flex items-center gap-3 mb-4">
        <Shimmer className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Shimmer className="h-3 w-32" />
          <Shimmer className="h-2.5 w-24" />
        </div>
      </div>
      {/* Content */}
      <div className="space-y-2 mb-4">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-5/6" />
        <Shimmer className="h-3 w-3/4" />
      </div>
      {/* Action bar */}
      <div className="flex gap-2 pt-3 border-t border-slate-100">
        <Shimmer className="h-7 w-14 rounded-lg" />
        <Shimmer className="h-7 w-14 rounded-lg" />
        <Shimmer className="h-7 w-14 rounded-lg" />
        <Shimmer className="ml-auto h-7 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/** Publication list-item skeleton */
export function PublicationSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-3">
        <Shimmer className="h-5 w-20 rounded-full" />
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
      <Shimmer className="h-4 w-4/5 mb-1.5" />
      <Shimmer className="h-3 w-1/2 mb-1" />
      <Shimmer className="h-3 w-1/3 mb-4" />
      <div className="space-y-1.5 mb-4">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-5/6" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-5 w-16 rounded-full" />
        <Shimmer className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Experiment card skeleton */
export function ExperimentSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <Shimmer className="h-5 w-20 rounded-full" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
        <Shimmer className="h-3 w-12" />
      </div>
      <Shimmer className="h-4 w-3/4 mb-1.5" />
      <Shimmer className="h-3 w-1/2 mb-3" />
      <div className="space-y-1.5 mb-4">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-4/5" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-5 w-24 rounded-full" />
        <Shimmer className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Generic card skeleton (profile, project, etc.) */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <Shimmer className="w-12 h-12 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Shimmer className="h-3.5 w-36" />
          <Shimmer className="h-2.5 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Shimmer key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
