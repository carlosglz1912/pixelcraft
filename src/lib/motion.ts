/**
 * @fileoverview Shared motion primitives for PixelCraft.
 *
 * Centralises every framer-motion config and re-export so the rest of the
 * codebase imports from a single file. This keeps animation tuning in one
 * place and avoids scattered magic numbers across components.
 *
 * Usage:
 *   import { motion, SIDEBAR_SPRING, galleryItemVariants } from "@/lib/motion";
 */

export { motion, AnimatePresence, LayoutGroup } from "framer-motion";

// ---------------------------------------------------------------------------
// Spring configs
// ---------------------------------------------------------------------------

/**
 * Snappy-but-smooth spring used for the sidebar collapse/expand animation.
 * High stiffness (~300) gives a responsive feel; moderate damping (~30)
 * prevents overshoot without making it feel sluggish.
 *
 * Use with: `transition={{ ...SIDEBAR_SPRING }}`
 */
export const SIDEBAR_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

/**
 * Lighter spring for subtle transitions (footer cross-fades, badge swaps,
 * button press feedback). Lower stiffness keeps the motion gentle.
 *
 * Use with: `transition={{ ...GENTLE_SPRING }}`
 */
export const GENTLE_SPRING = {
  type: "spring" as const,
  stiffness: 200,
  damping: 25,
};

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

/**
 * Gallery card enter/exit variants.
 *
 * - **initial**: slightly scaled-down and invisible — used as the starting
 *   state when a card mounts.
 * - **exit**: fades out with a slight scale-down for a clean removal
 *   transition. Must be used inside `<AnimatePresence>` to take effect.
 *
 * Usage:
 * ```tsx
 * <motion.div variants={galleryItemVariants} initial="initial" exit="exit" />
 * ```
 */
export const galleryItemVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
} as const;

/**
 * Sidebar content exit variant — a quick cross-fade when the sidebar
 * toggles between collapsed and expanded states.
 *
 * Usage:
 * ```tsx
 * <motion.div variants={SIDEBAR_EXIT_VARIANTS} />
 * ```
 */
export const SIDEBAR_EXIT_VARIANTS = {
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
} as const;

// ---------------------------------------------------------------------------
// LayoutGroup id
// ---------------------------------------------------------------------------

/**
 * Shared LayoutGroup id for the sidebar so that collapse/expand layout
 * changes animate smoothly without conflicts.
 *
 * Use with: `<LayoutGroup id={layoutGroupId}>`
 */
export const layoutGroupId = "sidebar-layout" as const;
