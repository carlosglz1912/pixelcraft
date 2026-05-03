import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  media: defineTable({
    storageId: v.string(),
    provider: v.union(v.literal("convex"), v.literal("r2")),
    type: v.union(v.literal("image"), v.literal("video")),
    originalUrl: v.optional(v.string()),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    
    modelId: v.optional(v.string()),
    prompt: v.optional(v.string()),
    negativePrompt: v.optional(v.string()),
    seed: v.optional(v.number()),
    duration: v.optional(v.number()),
    aspectRatio: v.optional(v.string()),
    resolution: v.optional(v.string()),
    costTier: v.optional(v.string()),
    
    createdAt: v.number(),
    userId: v.optional(v.string()),
  }).index("by_created", ["createdAt"])
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  collections: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    itemIds: v.array(v.string()),
    coverImageId: v.optional(v.string()),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    userId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),
});
