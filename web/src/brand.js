/**
 * The product's name, in one place.
 *
 * Renaming the product should be a two-line edit, not a find-and-replace across
 * thirty files that quietly misses the PWA manifest and the receipt prefix.
 * Everything user-facing reads from here.
 *
 * `RECEIPT_PREFIX` also lives here because it is stamped into every signed
 * receipt. Changing it invalidates receipts issued under the old prefix, which
 * is correct - a receipt should name the system that issued it - but it means
 * the backend constant in `backend/app/brand.py` must be changed to match.
 */

export const BRAND = {
  /** Change this line to rename the product. */
  name: 'FarmFlow',

  /** Shown under the name on the splash and in the deck. */
  tagline: 'No farmer is too small to store',

  /** One sentence, used by the manifest and the README header. */
  description: 'Micro cold storage and market access for small Indian farmers',

  /** The name as a farmer sees it in each supported language. */
  nameByLang: {
    en: 'FarmFlow',
    hi: 'फ़ार्मफ़्लो',
    pa: 'ਫਾਰਮਫਲੋ',
  },

  /**
   * Stamped into signed receipts and shown on the verification screen.
   * Must match `RECEIPT_PREFIX` in backend/app/brand.py.
   */
  receiptPrefix: 'FFWR2',

  /** Used for booking ids, lot ids and anything else that wants initials. */
  shortCode: 'FF',
}

export const brandName = (lang = 'en') => BRAND.nameByLang[lang] ?? BRAND.name

export default BRAND
