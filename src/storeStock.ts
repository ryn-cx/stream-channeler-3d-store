// TODO: Validate
import type { StoreTitle } from "./caseTexture"
import type { StoreStockTitle } from "./storeTypes"

export type StoreStock = StoreStockTitle[]

export type StoreMetadata = "tmdb" | "source"

// TODO: Validate
/**
 * Return the stock as store titles, taking names, years, media types,
 * languages, images, and genres from the source or TMDB as chosen, falling back
 * to TMDB.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const pickStock = (
  stock: StoreStock,
  metadata: StoreMetadata,
): StoreTitle[] =>
  stock.map((title) => {
    const information = title[metadata] ?? title.tmdb
    return {
      id: title.id,
      name: information.name || "Untitled",
      year: information.year,
      tmdbScore: title.tmdb_score,
      tmdbPopularity: title.tmdb_popularity,
      imdbId: title.imdb_id,
      imdbScore: title.imdb_score,
      imdbPopularityRank: title.imdb_popularity_rank,
      mediaType: information.media_type,
      originalLanguage: title.original_language,
      languages: information.languages,
      subtitleLanguages: title.subtitle_languages,
      image: information.thumbnail ?? null,
      logo: information.logo ?? null,
      isPoster: information.is_poster,
      genres: information.genres,
      episodeCount: title.episode_count,
      seasonCount: title.season_count,
      releaseDate: title.release_date,
      trailerUrl: title.trailer_url,
    }
  })
