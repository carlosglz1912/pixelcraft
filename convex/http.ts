import { httpRouter } from "convex/server";
import { registerRoutes } from "@gilhrpenner/convex-files-control";
import { components, api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsResponse(body: string, init?: ResponseInit & { status?: number }) {
  const base = (init?.headers && typeof init.headers === "object" && !Array.isArray(init.headers))
    ? init.headers as Record<string, string>
    : {};
  return new Response(body, {
    status: init?.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      ...base,
    },
  });
}

function corsOptionsHandler() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const http = httpRouter();

const r2Config = process.env.R2_ACCOUNT_ID ? {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucketName: process.env.R2_BUCKET_NAME!,
} : undefined;

registerRoutes(http, components.convexFilesControl, {
  pathPrefix: "files",
  enableUploadRoute: true,
  enableDownloadRoute: true,
  defaultUploadProvider: "r2",
  r2: r2Config,
  
  checkUploadRequest: async () => {
    return { accessKeys: ["anonymous"] };
  },
  
  checkDownloadRequest: async () => {
    return;
  },
});

http.route({
  path: "/files/persistFromUrl",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/files/persistFromUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const result = await ctx.runAction(api.files.persistFromUrl, body as any);
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/files/preparePersistUpload",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/files/preparePersistUpload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const result = await ctx.runMutation(api.files.generateUploadUrl, body as any);
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/files/finalizePersistUpload",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/files/finalizePersistUpload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const result = await ctx.runMutation(api.files.finalizeUpload, body as any);
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/api/media/list",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/media/list",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const result = userId
      ? await ctx.runQuery(api.files.listByUser, { userId, limit })
      : await ctx.runQuery(api.files.list, { limit });

    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/api/media/delete",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/media/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { id: string };
    const result = await ctx.runMutation(api.files.remove, { id: body.id as any });
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/api/collections/list",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/collections/list",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      return corsResponse(JSON.stringify({ error: "userId is required" }), { status: 400 });
    }
    const result = await ctx.runQuery(api.collections.listByUser, { userId });
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/api/collections/create",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/collections/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as Record<string, unknown>;
    const result = await ctx.runMutation(api.collections.create, body as any);
    return corsResponse(JSON.stringify({ id: result }));
  }),
});

http.route({
  path: "/api/collections/update",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/collections/update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as Record<string, unknown>;
    const result = await ctx.runMutation(api.collections.update, body as any);
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/api/collections/addItems",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/collections/addItems",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as Record<string, unknown>;
    const result = await ctx.runMutation(api.collections.addItems, body as any);
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/api/collections/removeItems",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/collections/removeItems",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as Record<string, unknown>;
    const result = await ctx.runMutation(api.collections.removeItems, body as any);
    return corsResponse(JSON.stringify(result));
  }),
});

http.route({
  path: "/api/collections/delete",
  method: "OPTIONS",
  handler: httpAction(async () => corsOptionsHandler()),
});
http.route({
  path: "/api/collections/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { id: string };
    const result = await ctx.runMutation(api.collections.remove, { id: body.id as any });
    return corsResponse(JSON.stringify(result));
  }),
});

export default http;
