import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Queries ────────────────────────────────────────────────────────

export const listByUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_user_updated", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return collections;
  },
});

export const getById = query({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) return null;
    return collection;
  },
});

// ── Mutations ──────────────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    itemIds: v.optional(v.array(v.string())),
    coverImageId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("collections", {
      name: args.name,
      description: args.description,
      color: args.color,
      itemIds: args.itemIds ?? [],
      coverImageId: args.coverImageId,
      createdAt: now,
      updatedAt: now,
      userId: args.userId,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("collections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    coverImageId: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const collection = await ctx.db.get(id);
    if (!collection) throw new ConvexError("Collection not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.description !== undefined) updates.description = fields.description;
    if (fields.coverImageId !== undefined) updates.coverImageId = fields.coverImageId;
    if (fields.color !== undefined) updates.color = fields.color;

    await ctx.db.patch(id, updates);
    return { success: true };
  },
});

export const addItems = mutation({
  args: {
    id: v.id("collections"),
    itemIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) throw new ConvexError("Collection not found");

    const existing = new Set(collection.itemIds);
    const toAdd = args.itemIds.filter((id) => !existing.has(id));

    if (toAdd.length > 0) {
      await ctx.db.patch(args.id, {
        itemIds: [...collection.itemIds, ...toAdd],
        updatedAt: Date.now(),
      });
    }

    return { added: toAdd.length };
  },
});

export const removeItems = mutation({
  args: {
    id: v.id("collections"),
    itemIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) throw new ConvexError("Collection not found");

    const toRemove = new Set(args.itemIds);
    const remaining = collection.itemIds.filter((id) => !toRemove.has(id));

    await ctx.db.patch(args.id, {
      itemIds: remaining,
      updatedAt: Date.now(),
    });

    return { removed: collection.itemIds.length - remaining.length };
  },
});

export const remove = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) throw new ConvexError("Collection not found");

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
