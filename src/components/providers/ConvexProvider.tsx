'use client'

import { ConvexProvider as ConvexReactProvider } from "convex/react";
import { useMemo } from "react";
import { getConvexClient } from "@/lib/convex-client";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(() => getConvexClient(), []);

  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexReactProvider client={convex}>
      {children}
    </ConvexReactProvider>
  );
}
