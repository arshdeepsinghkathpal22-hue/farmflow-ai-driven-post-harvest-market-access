/**
 * The three languages the app speaks.
 *
 * `speech` is the BCP-47 tag handed to the browser's speech recogniser. Hindi
 * and Punjabi are the languages a Rampur farmer actually books in; English is
 * here for judges and for the storage owner's side.
 */
export const LANGUAGES = [
  { id: 'en', label: 'English', native: 'English', speech: 'en-IN', script: 'latin' },
  { id: 'hi', label: 'Hindi', native: 'हिंदी', speech: 'hi-IN', script: 'devanagari' },
  { id: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', speech: 'pa-IN', script: 'gurmukhi' },
]

export const DEFAULT_LANGUAGE = 'hi'

export const getLanguage = (id) =>
  LANGUAGES.find((l) => l.id === id) ?? LANGUAGES.find((l) => l.id === DEFAULT_LANGUAGE)
