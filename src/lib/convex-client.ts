import { ConvexReactClient } from "convex/react";

let _client: ConvexReactClient | null = null;

/**
 * Lazy singleton for the ConvexReactClient.
 *
 * Returns null when NEXT_PUBLIC_CONVEX_URL is undefined (e.g. during
 * static build or when Convex is not configured). Both React providers
 * and non-React consumers (Zustand stores) share the same instance to
 * avoid duplicate WebSocket connections.
 */
export function getConvexClient(): ConvexReactClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;

  _client = new ConvexReactClient(url);
  return _client;
}
