import { ConvexError, v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { components } from "./_generated/api";
import { api } from "./_generated/api";

export const generateUploadUrl = mutation({
  args: {
    provider: v.union(v.literal("convex"), v.literal("r2")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    const r2Config = process.env.R2_ACCOUNT_ID ? {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      bucketName: process.env.R2_BUCKET_NAME!,
    } : undefined;

    return await ctx.runMutation(
      components.convexFilesControl.upload.generateUploadUrl,
      {
        provider: args.provider,
        r2Config,
      },
    );
  },
});

export const finalizeUpload = mutation({
  args: {
    uploadToken: v.string(),
    storageId: v.string(),
    fileName: v.string(),
    provider: v.union(v.literal("convex"), v.literal("r2")),
    type: v.union(v.literal("image"), v.literal("video")),
    originalUrl: v.optional(v.string()),
    contentType: v.optional(v.union(v.string(), v.null())),
    size: v.optional(v.number()),
    fileMetadata: v.optional(
      v.object({
        size: v.number(),
        sha256: v.string(),
        contentType: v.union(v.string(), v.null()),
      }),
    ),
    metadata: v.optional(
      v.object({
        modelId: v.optional(v.string()),
        prompt: v.optional(v.string()),
        negativePrompt: v.optional(v.string()),
        seed: v.optional(v.number()),
        duration: v.optional(v.number()),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        costTier: v.optional(v.string()),
        estimatedCost: v.optional(v.number()),
      }),
    ),
    expiresAt: v.optional(v.union(v.null(), v.number())),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const authUserId = identity?.subject;
    const userId = args.userId || authUserId;

    const {
      fileName,
      provider,
      type,
      originalUrl,
      metadata,
      fileMetadata,
      contentType: _contentType,
      size: _size,
      userId: _userId,
      ...componentArgs
    } = args;
    
    const result = await ctx.runMutation(
      components.convexFilesControl.upload.finalizeUpload,
      {
        ...componentArgs,
        accessKeys: userId ? [userId] : ["anonymous"],
        metadata: fileMetadata,
      },
    );

    const mediaId = await ctx.db.insert("media", {
      storageId: args.storageId,
      provider,
      type,
      originalUrl,
      fileName,
      contentType: args.contentType ?? undefined,
      size: args.size,
      ...metadata,
      createdAt: Date.now(),
      userId,
    });

    return { ...result, mediaId };
  },
});

export const createDownloadGrant = mutation({
  args: {
    storageId: v.string(),
    maxUses: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    password: v.optional(v.string()),
    shareableLink: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(
      components.convexFilesControl.download.createDownloadGrant,
      {
        storageId: args.storageId,
        maxUses: args.maxUses ?? 1,
        expiresAt: args.expiresAt,
        password: args.password,
        shareableLink: args.shareableLink ?? true,
      },
    );
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const identity = await ctx.auth.getUserIdentity();
    
    let query = ctx.db.query("media").order("desc");
    
    const items = await query.take(limit);
    
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        let url: string;
        
        if (item.provider === "r2" && process.env.R2_PUBLIC_URL) {
          url = `${process.env.R2_PUBLIC_URL}/${item.storageId}`;
        } else {
          try {
            const storageUrl = await ctx.storage.getUrl(item.storageId as any);
            url = storageUrl ?? item.originalUrl ?? "";
          } catch {
            url = item.originalUrl ?? "";
          }
        }
        
        return { ...item, url };
      })
    );
    
    return itemsWithUrls;
  },
});

export const listByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    
    const items = await ctx.db
      .query("media")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        let url: string;
        
        if (item.provider === "r2" && process.env.R2_PUBLIC_URL) {
          url = `${process.env.R2_PUBLIC_URL}/${item.storageId}`;
        } else {
          try {
            const storageUrl = await ctx.storage.getUrl(item.storageId as any);
            url = storageUrl ?? item.originalUrl ?? "";
          } catch {
            url = item.originalUrl ?? "";
          }
        }
        
        return { ...item, url };
      })
    );
    
    return itemsWithUrls;
  },
});

export const findDuplicates = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("media")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    
    const groups: Map<string, typeof items> = new Map();
    
    for (const item of items) {
      if (item.originalUrl) {
        const existing = groups.get(item.originalUrl) || [];
        existing.push(item);
        groups.set(item.originalUrl, existing);
      }
    }
    
    const duplicates = Array.from(groups.values())
      .filter((group) => group.length > 1)
      .map((group) => ({
        originalUrl: group[0].originalUrl,
        count: group.length,
        items: group.map((item) => ({
          _id: item._id,
          storageId: item.storageId,
          fileName: item.fileName,
          createdAt: item.createdAt,
          size: item.size,
        })),
      }));
    
    return duplicates;
  },
});

export const getById = query({
  args: { id: v.id("media") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) return null;
    
    let url: string;
    if (item.provider === "r2" && process.env.R2_PUBLIC_URL) {
      url = `${process.env.R2_PUBLIC_URL}/${item.storageId}`;
    } else {
      try {
        const storageUrl = await ctx.storage.getUrl(item.storageId as any);
        url = storageUrl ?? item.originalUrl ?? "";
      } catch {
        url = item.originalUrl ?? "";
      }
    }
    
    return { ...item, url };
  },
});

export const remove = mutation({
  args: { id: v.id("media") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new ConvexError("Media not found");

    await ctx.storage.delete(item.storageId as any);
    await ctx.db.delete(args.id);
    
    return { success: true };
  },
});

export const removeMultiple = mutation({
  args: { ids: v.array(v.id("media")) },
  handler: async (ctx, args) => {
    const results = await Promise.allSettled(
      args.ids.map(async (id) => {
        const item = await ctx.db.get(id);
        if (!item) throw new ConvexError("Media not found");

        await ctx.storage.delete(item.storageId as any);
        await ctx.db.delete(id);
        return id;
      })
    );
    
    const deleted = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    
    return { deleted, failed };
  },
});

export const cleanupExpired = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.runMutation(components.convexFilesControl.cleanUp.cleanupExpired, {});
  },
});

export const persistFromUrl = action({
  args: {
    url: v.string(),
    fileName: v.string(),
    provider: v.union(v.literal("convex"), v.literal("r2")),
    type: v.union(v.literal("image"), v.literal("video")),
    contentType: v.optional(v.string()),
    userId: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        modelId: v.optional(v.string()),
        prompt: v.optional(v.string()),
        negativePrompt: v.optional(v.string()),
        seed: v.optional(v.number()),
        duration: v.optional(v.number()),
        aspectRatio: v.optional(v.string()),
        resolution: v.optional(v.string()),
        costTier: v.optional(v.string()),
        estimatedCost: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ storageId: string; mediaId: string; url: string }> => {
    const response = await fetch(args.url);
    if (!response.ok) {
      throw new ConvexError(`Failed to fetch media from URL: ${response.status}`);
    }

    if (!response.body) {
      throw new ConvexError("Failed to fetch media from URL: missing response body");
    }

    const contentType = args.contentType ?? response.headers.get("content-type") ?? null;
    const contentLengthHeader = response.headers.get("content-length");
    const hasContentEncoding = response.headers.has("content-encoding");
    const size = !hasContentEncoding && contentLengthHeader
      ? Number.parseInt(contentLengthHeader, 10)
      : undefined;

    const { uploadUrl, uploadToken, storageId: presetStorageId } = await ctx.runMutation(api.files.generateUploadUrl, {
      provider: args.provider,
    });

    const headers = new Headers({
      "Content-Type": contentType ?? "application/octet-stream",
    });

    if (typeof size === "number" && Number.isFinite(size) && size >= 0) {
      headers.set("Content-Length", String(size));
    }

    const uploadRequest: RequestInit & { duplex: "half" } = {
      method: args.provider === "r2" ? "PUT" : "POST",
      body: response.body,
      headers,
      duplex: "half",
    };

    const uploadResponse = await fetch(uploadUrl, uploadRequest);

    if (!uploadResponse.ok) {
      throw new ConvexError(`Upload failed: ${uploadResponse.status}`);
    }

    let storageId: string | null = presetStorageId ?? null;
    if (args.provider === "convex") {
      const payload = await uploadResponse.json() as { storageId?: string };
      storageId = payload.storageId ?? null;
    }

    if (!storageId) {
      throw new ConvexError("Upload did not return storageId");
    }
    
    const result = await ctx.runMutation(api.files.finalizeUpload, {
      uploadToken,
      storageId,
      fileName: args.fileName,
      provider: args.provider,
      type: args.type,
      originalUrl: args.url,
      contentType,
      size,
      metadata: args.metadata,
      userId: args.userId,
    });
    
    const url = args.provider === "r2" && process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${storageId}`
      : await ctx.runQuery(api.files.getById, { id: result.mediaId }).then((m: any) => m?.url ?? "");
    
    return { storageId, mediaId: result.mediaId, url };
  },
});
