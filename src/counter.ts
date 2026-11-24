// TODO: Validate
import type { StoreTitle } from "./caseTexture"

// TODO: Validate
/**
 * Return the titles the user left at the video store counter, loaded from local
 * storage.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const readCounter = (): StoreTitle[] => {
  const stored = localStorage.getItem("video-store-counter")
  return stored ? JSON.parse(stored) : []
}

// TODO: Validate
/**
 * Save the titles at the video store counter to local storage.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const writeCounter = (titles: StoreTitle[]) => {
  localStorage.setItem("video-store-counter", JSON.stringify(titles))
}
