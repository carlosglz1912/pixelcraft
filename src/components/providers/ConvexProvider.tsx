'use client'

import { ConvexProvider as ConvexReactProvider } from "convex/react";
import { useMemo } from "react";

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  
  const convex = useMemo(() => {
    if (!convexUrl) return null;
    const { ConvexReactClient } = require("convex/react");
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexReactProvider client={convex}>
      {children}
    </ConvexReactProvider>
  );
}
