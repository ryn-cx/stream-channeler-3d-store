// TODO: Validate
import { storeBackend } from "./storeBackend"
import type { StoreImage } from "./storeTypes"

// TODO: Validate
/**
 * Return a promise that resolves after the number of milliseconds.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

// TODO: Validate
/**
 * Load the image at the URL, resolving to the image or to null when it fails.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const attemptLoad = (url: URL) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.referrerPolicy = "no-referrer"
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url.href
  })

const loadedImages = new Map<string, Promise<HTMLImageElement | null>>()

// TODO: Validate
/**
 * Load the image at the URL, retrying once after a short random delay when the
 * first attempt fails.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const fetchImage = async (location: URL) => {
  const loaded = await attemptLoad(location)
  if (loaded) return loaded
  await pause(300 + Math.random() * 500)
  return attemptLoad(location)
}

// TODO: Validate
/**
 * Load a store image at the size, sharing one load per URL and forgetting
 * failed loads so they can be retried.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const loadStoreImage = async (
  image: StoreImage | null | undefined,
  size: "w154" | "w300" | "w780",
) => {
  const source = storeBackend().storeImageUrl(image, size)
  if (!source) return null
  const location = new URL(source, window.location.origin)
  const cached = loadedImages.get(location.href)
  if (cached) return cached
  const loading = fetchImage(location)
  loadedImages.set(location.href, loading)
  const loaded = await loading
  if (!loaded) loadedImages.delete(location.href)
  return loaded
}
