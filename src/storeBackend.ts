// TODO: Validate
import type { ReactNode } from "react"
import type {
  StoreChannel,
  StoreImage,
  StoreImageSize,
  StoreLanguage,
  StoreTitleDetail,
  StoreTitleSource,
} from "./storeTypes"

export type StoreBackend = {
  fetchTitleDetails: (titleIds: string[]) => Promise<StoreTitleDetail[]>
  fetchOriginalLanguages: () => Promise<StoreLanguage[]>
  fetchSpokenLanguages: () => Promise<StoreLanguage[]>
  fetchSubtitleLanguages: () => Promise<StoreLanguage[]>
  storeImageUrl: (
    image: StoreImage | null | undefined,
    size: StoreImageSize,
  ) => string | null
  channelsAvailable: () => boolean
  fetchOwnedChannels: () => Promise<StoreChannel[]>
  createPrivateChannel: (name: string) => Promise<StoreChannel>
  addChannelTitle: (channelId: string, titleId: string) => Promise<void>
  onChannelsChanged: () => void
  renderTitleInformation?: (dialog: {
    open: boolean
    onOpenChange: (open: boolean) => void
    sources: StoreTitleSource[]
  }) => ReactNode
}

let configuredStoreBackend: StoreBackend | null = null

// TODO: Validate
/**
 * Set the backend that the video store downloads its data from and saves
 * channels to.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const configureStoreBackend = (backend: StoreBackend) => {
  configuredStoreBackend = backend
}

// TODO: Validate
/**
 * Return the configured backend. Throw when no backend was configured yet.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const storeBackend = () => {
  if (!configuredStoreBackend) {
    throw new Error("The video store backend was not configured")
  }
  return configuredStoreBackend
}
