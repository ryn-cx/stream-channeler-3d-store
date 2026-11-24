// TODO: Validate
import type { StoreBackend } from "../storeBackend"
import type {
  StoreChannel,
  StoreLanguage,
  StoreStockTitle,
} from "../storeTypes"
import { generateTestTitles } from "./fakeTitles"

// TODO: Validate
/**
 * Return a promise that resolves after the number of milliseconds, so the fake
 * backend responds as slowly as a real server would.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const waitMilliseconds = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

// TODO: Validate
/**
 * Return each language code in the stock with its English name and the number
 * of titles that list it.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const countLanguages = (
  stock: StoreStockTitle[],
  languageCodesOfTitle: (stockTitle: StoreStockTitle) => string[],
): StoreLanguage[] => {
  const languageCodeToTitleCount = new Map<string, number>()
  for (const stockTitle of stock) {
    for (const languageCode of new Set(languageCodesOfTitle(stockTitle))) {
      languageCodeToTitleCount.set(
        languageCode,
        (languageCodeToTitleCount.get(languageCode) ?? 0) + 1,
      )
    }
  }
  const englishLanguageNames = new Intl.DisplayNames(["en"], {
    type: "language",
  })
  return [...languageCodeToTitleCount].map(([languageCode, titleCount]) => ({
    code: languageCode,
    name: englishLanguageNames.of(languageCode) ?? null,
    title_count: titleCount,
  }))
}

// TODO: Validate
/**
 * Return a video store backend that serves made up data from memory, and a
 * function that downloads its stock.
 *
 * The same title count and seed always produce the same store. Channels are
 * kept in memory and are lost when the page reloads.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createTestBackend = ({
  titleCount,
  seed,
  responseDelayMilliseconds,
}: {
  titleCount: number
  seed: number
  responseDelayMilliseconds: number
}) => {
  const { stock, titleIdToDetail } = generateTestTitles({ titleCount, seed })
  const ownedChannels: StoreChannel[] = []
  const channelIdToTitleIds = new Map<string, string[]>()

  const backend: StoreBackend = {
    // TODO: Validate
    fetchTitleDetails: async (titleIds) => {
      await waitMilliseconds(responseDelayMilliseconds)
      return titleIds.flatMap((titleId) => {
        const detail = titleIdToDetail.get(titleId)
        return detail ? [detail] : []
      })
    },
    // TODO: Validate
    fetchOriginalLanguages: async () =>
      countLanguages(stock, (stockTitle) =>
        stockTitle.original_language === null
          ? []
          : [stockTitle.original_language],
      ),
    // TODO: Validate
    fetchSpokenLanguages: async () =>
      countLanguages(stock, (stockTitle) => stockTitle.tmdb.languages),
    // TODO: Validate
    fetchSubtitleLanguages: async () =>
      countLanguages(stock, (stockTitle) => stockTitle.subtitle_languages),
    // TODO: Validate
    storeImageUrl: (image, size) => image?.urls[size] ?? null,
    // TODO: Validate
    channelsAvailable: () => true,
    // TODO: Validate
    fetchOwnedChannels: async () => {
      await waitMilliseconds(responseDelayMilliseconds)
      return [...ownedChannels]
    },
    // TODO: Validate
    createPrivateChannel: async (name) => {
      await waitMilliseconds(responseDelayMilliseconds)
      const channel = { id: `fake-channel-${ownedChannels.length + 1}`, name }
      ownedChannels.push(channel)
      channelIdToTitleIds.set(channel.id, [])
      return channel
    },
    // TODO: Validate
    addChannelTitle: async (channelId, titleId) => {
      await waitMilliseconds(responseDelayMilliseconds)
      channelIdToTitleIds.get(channelId)?.push(titleId)
    },
    // TODO: Validate
    onChannelsChanged: () => {},
  }

  // TODO: Validate
  const fetchStock = async () => {
    await waitMilliseconds(responseDelayMilliseconds)
    return stock
  }

  return { backend, fetchStock }
}
