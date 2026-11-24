// TODO: Validate
import type {
  StoreStockTitle,
  StoreStockTitleInformation,
  StoreTitleDetail,
  StoreTrailer,
} from "../storeTypes"
import {
  createFakeBackdrop,
  createFakeLogo,
  createFakePoster,
} from "./fakeImages"
import { createSeededRandom, type SeededRandom } from "./seededRandom"

const NAME_OPENERS = [
  "The",
  "A",
  "Last",
  "Midnight",
  "Return of the",
  "Beyond the",
  "Tales of the",
  "Summer of the",
  "Children of the",
  "Dr.",
  "Captain",
  "Night of the",
]

const NAME_ADJECTIVES = [
  "Crimson",
  "Silent",
  "Electric",
  "Forgotten",
  "Golden",
  "Hollow",
  "Invisible",
  "Lonely",
  "Neon",
  "Burning",
  "Frozen",
  "Wandering",
  "Secret",
  "Broken",
  "Savage",
  "Gentle",
]

const NAME_NOUNS = [
  "Harbor",
  "Detective",
  "Orchard",
  "Empire",
  "Lighthouse",
  "Carnival",
  "Frontier",
  "Kitchen",
  "Galaxy",
  "Motel",
  "Rebellion",
  "Garden",
  "Highway",
  "Kingdom",
  "Voyage",
  "Neighbors",
  "Tape",
  "Arcade",
  "Monsoon",
  "Typewriter",
]

const NAME_SUFFIXES = [
  "II",
  "Returns",
  "Forever",
  "in Space",
  "After Dark",
  "Reloaded",
  "The Animated Series",
  "of Tomorrow",
]

const NON_LATIN_NAMES = [
  "深夜の灯台",
  "Город без сна",
  "하늘의 정원",
  "El último verano",
  "Les Enfants du Néon",
  "مدينة الأحلام",
  "Der stille Bahnhof",
  "ราตรีสีทอง",
]

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
]

const LANGUAGE_CODES = [
  "en",
  "es",
  "fr",
  "de",
  "ja",
  "ko",
  "it",
  "pt",
  "hi",
  "zh",
  "ru",
  "sv",
]

const FAKE_SOURCES = [
  { source_key: "example-plus", source_name: "Example+" },
  { source_key: "streamly", source_name: "Streamly" },
  { source_key: "reelbox", source_name: "ReelBox" },
]

const DESCRIPTION_SENTENCES = [
  "A stranger arrives in town and nothing is the same afterwards.",
  "Two rivals have one weekend to save the family business.",
  "An old recording holds the answer to a decades old disappearance.",
  "The crew takes one last job before leaving for good.",
  "A reluctant hero learns that the map was wrong all along.",
  "Every neighbor has a secret, and the new mail carrier knows them all.",
  "What starts as a road trip turns into a race against the weather.",
  "The night shift at the video store has never been this strange.",
]

const FAKE_TRAILERS: StoreTrailer[] = [
  {
    type: "Trailer",
    name: "Fake Trailer",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw&vl=en",
  },
  {
    type: "Teaser",
    name: "Fake Teaser",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw&vl=en",
  },
  {
    type: "Clip",
    name: "Fake Clip",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw&vl=en",
  },
]

export type FakeStock = {
  stock: StoreStockTitle[]
  titleIdToDetail: Map<string, StoreTitleDetail>
}

// TODO: Validate
/**
 * Return a made up title name. Most names are built from English word lists.
 * A few are very long and a few use other alphabets, so the store's text
 * layout is tested with them.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const createFakeName = (random: SeededRandom) => {
  if (random.chance(0.04)) return random.pick(NON_LATIN_NAMES)
  const nameParts = [
    ...(random.chance(0.6) ? [random.pick(NAME_OPENERS)] : []),
    ...(random.chance(0.7) ? [random.pick(NAME_ADJECTIVES)] : []),
    random.pick(NAME_NOUNS),
    ...(random.chance(0.15) ? [random.pick(NAME_SUFFIXES)] : []),
  ]
  if (random.chance(0.03)) {
    nameParts.push(
      "and the",
      random.pick(NAME_ADJECTIVES),
      random.pick(NAME_NOUNS),
      "of the",
      random.pick(NAME_ADJECTIVES),
      random.pick(NAME_NOUNS),
    )
  }
  return nameParts.join(" ")
}

// TODO: Validate
/**
 * Return a made up title for the store's stock together with its detail.
 *
 * Fields vary on purpose so the store's edge cases appear in the fake data:
 * some titles have no year, no scores, no IMDb id, no image, a backdrop instead
 * of a poster, no genres, no source information, or source information that
 * differs from the TMDB information.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const createFakeTitle = (
  random: SeededRandom,
  titleNumber: number,
  imdbPopularityRank: number | null,
) => {
  const titleId = `fake-title-${titleNumber}`
  const name = createFakeName(random)
  const hue = random.integerBetween(0, 359)
  const isMovie = random.chance(0.55)
  const year = random.chance(0.03) ? null : random.integerBetween(1950, 2026)
  const originalLanguage = random.chance(0.02)
    ? null
    : random.chance(0.6)
      ? "en"
      : random.pick(LANGUAGE_CODES)
  const spokenLanguages = [
    ...new Set([
      ...(originalLanguage === null ? [] : [originalLanguage]),
      ...random.pickSeveral(LANGUAGE_CODES, random.integerBetween(0, 2)),
    ]),
  ]
  const subtitleLanguages = random.pickSeveral(
    LANGUAGE_CODES,
    random.integerBetween(0, 5),
  )
  const genres = random.chance(0.03)
    ? []
    : random.pickSeveral(GENRES, random.integerBetween(1, 3))
  const seasonCount = isMovie ? 0 : random.integerBetween(1, 12)
  const episodeCount = isMovie ? 1 : seasonCount * random.integerBetween(4, 24)

  const poster = createFakePoster(titleId, name, year, hue)
  const backdrop = createFakeBackdrop(titleId, name, hue)
  const logo = random.chance(0.5) ? createFakeLogo(titleId, name) : null
  const imageRoll = random.fraction()
  const hasPoster = imageRoll < 0.8
  const hasBackdrop = imageRoll < 0.92

  const tmdbInformation: StoreStockTitleInformation = {
    name,
    year,
    media_type: isMovie ? "Movie" : "Series",
    languages: spokenLanguages,
    thumbnail: hasPoster ? poster : hasBackdrop ? backdrop : null,
    logo,
    is_poster: hasPoster,
    genres,
  }
  const sourceRoll = random.fraction()
  let sourceInformation: StoreStockTitleInformation | null
  if (sourceRoll < 0.15) {
    sourceInformation = null
  } else if (sourceRoll < 0.75) {
    sourceInformation = tmdbInformation
  } else {
    sourceInformation = {
      ...tmdbInformation,
      name: `${name} (Source Edition)`,
      thumbnail: hasBackdrop ? backdrop : null,
      logo: null,
      is_poster: false,
      genres: random.pickSeveral(GENRES, random.integerBetween(1, 2)),
    }
  }

  const imdbId =
    imdbPopularityRank === null
      ? null
      : `tt${String(9000000 + titleNumber).padStart(7, "0")}`
  const trailers = random.chance(0.35)
    ? random.pickSeveral(FAKE_TRAILERS, random.integerBetween(1, 3))
    : []
  const releaseMonth = String(random.integerBetween(1, 12)).padStart(2, "0")
  const releaseDay = String(random.integerBetween(1, 28)).padStart(2, "0")

  const stockTitle: StoreStockTitle = {
    id: titleId,
    tmdb_score: random.chance(0.08) ? null : random.integerBetween(20, 95) / 10,
    tmdb_popularity: random.chance(0.05)
      ? null
      : Math.round(random.fraction() ** 4 * 500000) / 1000,
    imdb_id: imdbId,
    imdb_score:
      imdbId === null || random.chance(0.05)
        ? null
        : random.integerBetween(15, 96) / 10,
    imdb_popularity_rank: imdbPopularityRank,
    original_language: originalLanguage,
    subtitle_languages: subtitleLanguages,
    season_count: seasonCount,
    episode_count: episodeCount,
    release_date:
      year === null ? null : `${year}-${releaseMonth}-${releaseDay}`,
    tmdb: tmdbInformation,
    source: sourceInformation,
    trailer_url: trailers.length > 0 ? trailers[0].url : null,
  }

  const description = random.chance(0.05)
    ? null
    : random
        .pickSeveral(DESCRIPTION_SENTENCES, random.integerBetween(1, 4))
        .join(" ")
  const watchSources = random.pickSeveral(
    FAKE_SOURCES,
    random.integerBetween(1, FAKE_SOURCES.length),
  )
  const detail: StoreTitleDetail = {
    id: titleId,
    original_language: originalLanguage,
    tmdb: {
      name,
      year,
      poster: hasPoster ? poster : null,
      backdrop: hasBackdrop ? backdrop : null,
      logo,
      description,
    },
    source: {
      name: sourceInformation?.name ?? name,
      year,
      poster: sourceInformation?.is_poster ? poster : null,
      backdrop: hasBackdrop ? backdrop : null,
      logo: sourceInformation?.logo ?? null,
      description,
    },
    languages: spokenLanguages,
    subtitle_languages: subtitleLanguages,
    runtime: random.chance(0.05)
      ? null
      : isMovie
        ? random.integerBetween(70, 190)
        : random.integerBetween(11, 62),
    imdb_id: imdbId,
    url: `https://example.com/${watchSources[0].source_key}/${titleId}`,
    links: watchSources.map((watchSource) => ({
      source_name: watchSource.source_name,
      favicon_url: null,
      url: `https://example.com/${watchSource.source_key}/${titleId}`,
    })),
    sources: watchSources.map((watchSource) => ({
      title_id: `${titleId}-${watchSource.source_key}`,
      plugin_key: watchSource.source_key,
      source_key: watchSource.source_key,
      name: sourceInformation?.name ?? null,
      url: `https://example.com/${watchSource.source_key}/${titleId}`,
    })),
    trailers,
  }

  return { stockTitle, detail }
}

// TODO: Validate
/**
 * Return made up stock for a video store, with the detail of every title. The
 * same title count and seed always produce the same stock.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const generateTestTitles = ({
  titleCount,
  seed,
}: {
  titleCount: number
  seed: number
}): FakeStock => {
  const random = createSeededRandom(seed)
  const titleNumbers = Array.from(
    { length: titleCount },
    (_unusedValue, titleIndex) => titleIndex + 1,
  )
  const titleNumbersByImdbPopularity = random.pickSeveral(
    titleNumbers,
    Math.round(titleCount * 0.9),
  )
  const titleNumberToImdbPopularityRank = new Map(
    titleNumbersByImdbPopularity.map((titleNumber, rankIndex) => [
      titleNumber,
      rankIndex + 1,
    ]),
  )

  const stock: StoreStockTitle[] = []
  const titleIdToDetail = new Map<string, StoreTitleDetail>()
  for (const titleNumber of titleNumbers) {
    const { stockTitle, detail } = createFakeTitle(
      random,
      titleNumber,
      titleNumberToImdbPopularityRank.get(titleNumber) ?? null,
    )
    stock.push(stockTitle)
    titleIdToDetail.set(stockTitle.id, detail)
  }
  return { stock, titleIdToDetail }
}
