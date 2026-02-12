/**
 * Shared types for the label editor — re-exported from @/lib/editor-types.
 *
 * The canonical definitions live in `@/lib/editor-types.ts` so both the
 * legacy editor (`/legacy`) and the TTB-styled editor (`/editor`) share
 * the same source of truth. This file re-exports everything so existing
 * imports from `./types` continue to work without changes.
 */
export {
  type ViewMode,
  type WarpMode,
  type ImageType,
  type MultiLabelChoice,
  type AiFlattenResult,
  type LabelSlot,
  createSlot,
} from "@/lib/editor-types";
