import { httpRouter } from "convex/server";
import { registerRoutes } from "@gilhrpenner/convex-files-control";
import { components, api } from "./_generated/api";
import { httpAction } from "./_generated/server";

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
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const result = await ctx.runAction(api.files.persistFromUrl, body as any);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/files/preparePersistUpload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const result = await ctx.runMutation(api.files.generateUploadUrl, body as any);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/files/finalizePersistUpload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const result = await ctx.runMutation(api.files.finalizeUpload, body as any);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
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

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/api/media/delete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json() as { id: string };
    const result = await ctx.runMutation(api.files.remove, { id: body.id as any });
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
