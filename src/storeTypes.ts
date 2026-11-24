// TODO: Validate
export type StoreImageSize = "w154" | "w300" | "w780" | "w1280" | "original"

export type StoreImageUrls = Record<StoreImageSize, string>

export type StoreImage = {
  id: string
  kind: "poster" | "backdrop" | "still" | "logo"
  width: number | null
  height: number | null
  urls: StoreImageUrls
  store_urls: StoreImageUrls | null
}

export type StoreStockTitleInformation = {
  name: string | null
  year: number | null
  media_type: string | null
  languages: string[]
  thumbnail: StoreImage | null
  logo: StoreImage | null
  is_poster: boolean
  genres: string[]
}

export type StoreStockTitle = {
  id: string
  tmdb_score: number | null
  tmdb_popularity: number | null
  imdb_id: string | null
  imdb_score: number | null
  imdb_popularity_rank: number | null
  original_language: string | null
  subtitle_languages: string[]
  season_count: number
  episode_count: number
  release_date: string | null
  tmdb: StoreStockTitleInformation
  source: StoreStockTitleInformation | null
  trailer_url?: string | null
}

export type StoreTitleDetailInformation = {
  name: string | null
  year: number | null
  poster: StoreImage | null
  backdrop: StoreImage | null
  logo: StoreImage | null
  description: string | null
}

export type StoreWatchLink = {
  source_name: string
  favicon_url: string | null
  url: string
}

export type StoreTitleSource = {
  title_id: string
  plugin_key: string
  source_key: string
  name: string | null
  url: string | null
}

export type StoreTrailer = {
  type: string
  name: string | null
  url: string
}

export type StoreTitleDetail = {
  id: string
  original_language: string | null
  tmdb: StoreTitleDetailInformation
  source: StoreTitleDetailInformation
  languages: string[]
  subtitle_languages: string[]
  runtime: number | null
  imdb_id: string | null
  url: string | null
  links: StoreWatchLink[]
  sources: StoreTitleSource[]
  trailers: StoreTrailer[]
}

export type StoreLanguage = {
  code: string
  name: string | null
  title_count: number
}

export type StoreChannel = {
  id: string
  name: string
}
