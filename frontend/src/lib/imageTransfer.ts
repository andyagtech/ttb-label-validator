/**
 * In-memory image transfer between pages (generator → editor, landing → editor).
 *
 * SessionStorage has a ~5-10 MB limit which is easily exceeded by two
 * AI-generated base64 images. Module-level variables have no size limit
 * and persist across Next.js client-side navigations (no full page reload).
 */

let frontImage: string | null = null;
let backImage: string | null = null;

/** Store one or two images for the editor to pick up. */
export function setTransferImages(front: string | null, back?: string | null) {
  frontImage = front;
  backImage = back ?? null;
}

/** Retrieve and clear stored images (one-shot). */
export function consumeTransferImages(): { front: string | null; back: string | null } {
  const result = { front: frontImage, back: backImage };
  frontImage = null;
  backImage = null;
  return result;
}
