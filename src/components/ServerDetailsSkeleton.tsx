import { Skeleton } from "@/components/ui/skeleton";

const ServerDetailsSkeleton = () => {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header Card Skeleton */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1">
            {/* Icon Skeleton */}
            <div className="relative shrink-0">
              <Skeleton className="w-14 h-14 rounded-xl" />
              <Skeleton className="absolute -bottom-1 -right-1 w-12 h-4 rounded-md" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {/* Title */}
              <Skeleton className="h-7 w-3/4 max-w-md rounded-md" />
              {/* Project name */}
              <Skeleton className="h-4 w-1/3 max-w-xs rounded-md" />
              {/* IP and connect button */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <Skeleton className="h-5 w-32 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-9 h-9 rounded-md" />
            ))}
          </div>
        </div>

        {/* Server Stats */}
        <div className="glass-card p-6 space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Players Section Skeleton */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-48 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        
        {/* Player cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-3 rounded-lg border border-border/50 bg-secondary/30 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resources Section Skeleton */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 18 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Charts Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default ServerDetailsSkeleton;