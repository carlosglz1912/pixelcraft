import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

function SkeletonShimmer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-shimmer"
      className={cn("bg-muted/30 animate-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton, SkeletonShimmer }
