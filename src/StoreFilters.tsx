// TODO: Validate
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, SlidersHorizontal, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { compareGenres, type StoreTitle } from "./caseTexture"
import {
  defaultDesign,
  FORMATS,
  PALETTE,
  type StoreDesign,
  WOOD_PALETTE,
} from "./StoreDesign"
import {
  fetchOriginalLanguages,
  fetchSpokenLanguages,
  fetchSubtitleLanguages,
} from "./storeLanguages"
import type { StoreMetadata } from "./storeStock"

export type StoreFilters = {
  yearFrom: number
  yearTo: number
  unknownYear: boolean
  tmdbScoreFrom: number
  tmdbScoreTo: number
  unknownTmdbScore: boolean
  tmdbPopularityFrom: number
  tmdbPopularityTo: number
  unknownTmdbPopularity: boolean
  imdbScoreFrom: number
  imdbScoreTo: number
  unknownImdbScore: boolean
  imdbPopularityFrom: number
  imdbPopularityTo: number
  unknownImdbPopularity: boolean
  mediaTypes: string[]
  unknownMediaType: boolean
  originalLanguages: string[] | null
  unknownOriginalLanguage: boolean
  languages: string[] | null
  unknownLanguage: boolean
  subtitleLanguages: string[] | null
  unknownSubtitleLanguage: boolean
  genres: string[] | null
  unknownGenre: boolean
}

export const UNKNOWN_MEDIA_TYPE = "Unknown"

type StoreBounds = {
  yearFrom: number
  yearTo: number
  tmdbScore: { from: number; to: number }
  tmdbPopularity: { from: number; to: number }
  imdbScore: { from: number; to: number }
  imdbPopularity: { from: number; to: number }
  mediaTypes: string[]
  genres: string[]
  originalLanguages: string[]
  languages: string[]
  subtitleLanguages: string[]
  counts: Record<
    | "mediaTypes"
    | "genres"
    | "originalLanguages"
    | "languages"
    | "subtitleLanguages",
    Map<string, number>
  >
}

const boundsCache = new WeakMap<StoreTitle[], StoreBounds>()

const imdbRankCache = new WeakMap<StoreTitle[], Map<string, number>>()

// TODO: Validate
/**
 * Return each title's rank among the store's titles by IMDb popularity rank,
 * cached per title list.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const imdbPopularityRanks = (titles: StoreTitle[]) => {
  const cached = imdbRankCache.get(titles)
  if (cached) return cached
  const ranked = titles
    .filter((title) => title.imdbPopularityRank !== null)
    .sort(
      (left, right) =>
        (left.imdbPopularityRank ?? 0) - (right.imdbPopularityRank ?? 0),
    )
  const ranks = new Map(ranked.map((title, index) => [title.id, index + 1]))
  imdbRankCache.set(titles, ranks)
  return ranks
}

// TODO: Validate
/**
 * Return the whole-number range covering the values read from the titles,
 * ignoring missing ones, or zero to zero when none have a value.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const valueRange = (
  titles: StoreTitle[],
  read: (title: StoreTitle) => number | null,
) => {
  let from = Number.POSITIVE_INFINITY
  let to = Number.NEGATIVE_INFINITY
  for (const title of titles) {
    const value = read(title)
    if (value === null) continue
    if (value < from) from = value
    if (value > to) to = value
  }
  return {
    from: Number.isFinite(from) ? Math.floor(from) : 0,
    to: Number.isFinite(to) ? Math.ceil(to) : 0,
  }
}

// TODO: Validate
/**
 * Return the year, score, and popularity ranges and the media types, genres,
 * and languages with their title counts across the store's titles, cached per
 * title list.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const storeBounds = (titles: StoreTitle[]): StoreBounds => {
  const cached = boundsCache.get(titles)
  if (cached) return cached

  let yearFrom = Number.POSITIVE_INFINITY
  let yearTo = Number.NEGATIVE_INFINITY
  const counts: StoreBounds["counts"] = {
    mediaTypes: new Map(),
    genres: new Map(),
    originalLanguages: new Map(),
    languages: new Map(),
    subtitleLanguages: new Map(),
  }
  // TODO: Validate
  /**
   * Add one to the count of each distinct value.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const tally = (counted: Map<string, number>, values: Iterable<string>) => {
    for (const value of new Set(values)) {
      counted.set(value, (counted.get(value) ?? 0) + 1)
    }
  }
  // TODO: Validate
  /**
   * Return the counted values ordered from most to fewest titles.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const byCount = (counted: Map<string, number>) =>
    [...counted.keys()].sort(
      (left, right) => (counted.get(right) ?? 0) - (counted.get(left) ?? 0),
    )

  for (const title of titles) {
    if (title.year !== null) {
      if (title.year < yearFrom) yearFrom = title.year
      if (title.year > yearTo) yearTo = title.year
    }
    if (title.mediaType !== null) tally(counts.mediaTypes, [title.mediaType])
    tally(counts.genres, title.genres)
    if (title.originalLanguage !== null) {
      tally(counts.originalLanguages, [title.originalLanguage])
    }
    tally(counts.languages, title.languages)
    tally(counts.subtitleLanguages, title.subtitleLanguages)
  }

  const bounds: StoreBounds = {
    yearFrom: Number.isFinite(yearFrom) ? yearFrom : 0,
    yearTo: Number.isFinite(yearTo) ? yearTo : 0,
    tmdbScore: valueRange(titles, (title) => title.tmdbScore),
    tmdbPopularity: valueRange(titles, (title) => title.tmdbPopularity),
    imdbScore: valueRange(titles, (title) => title.imdbScore),
    imdbPopularity: {
      from: 1,
      to: Math.max(imdbPopularityRanks(titles).size, 1),
    },
    mediaTypes: [...counts.mediaTypes.keys()].sort((left, right) =>
      left.localeCompare(right),
    ),
    genres: [...counts.genres.keys()].sort(compareGenres),
    originalLanguages: byCount(counts.originalLanguages),
    languages: byCount(counts.languages),
    subtitleLanguages: byCount(counts.subtitleLanguages),
    counts,
  }
  boundsCache.set(titles, bounds)
  return bounds
}

// TODO: Validate
/**
 * Return filters that cover the full range of every field across the titles and
 * allow unknown values, so every title is shelved.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const defaultFilters = (titles: StoreTitle[]): StoreFilters => {
  const bounds = storeBounds(titles)
  return {
    yearFrom: bounds.yearFrom,
    yearTo: bounds.yearTo,
    unknownYear: true,
    tmdbScoreFrom: bounds.tmdbScore.from,
    tmdbScoreTo: bounds.tmdbScore.to,
    unknownTmdbScore: true,
    tmdbPopularityFrom: bounds.tmdbPopularity.from,
    tmdbPopularityTo: bounds.tmdbPopularity.to,
    unknownTmdbPopularity: true,
    imdbScoreFrom: bounds.imdbScore.from,
    imdbScoreTo: bounds.imdbScore.to,
    unknownImdbScore: true,
    imdbPopularityFrom: bounds.imdbPopularity.from,
    imdbPopularityTo: bounds.imdbPopularity.to,
    unknownImdbPopularity: true,
    mediaTypes: bounds.mediaTypes,
    unknownMediaType: true,
    originalLanguages: null,
    unknownOriginalLanguage: true,
    languages: null,
    unknownLanguage: true,
    subtitleLanguages: null,
    unknownSubtitleLanguage: true,
    genres: null,
    unknownGenre: true,
  }
}

// TODO: Validate
/**
 * Return whether the value falls outside the range, or for a missing value
 * whether unknown values are excluded.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const outsideRange = (
  value: number | null | undefined,
  from: number,
  to: number,
  unknown: boolean,
) =>
  value === null || value === undefined ? !unknown : value < from || value > to

// TODO: Validate
/**
 * Return the titles that pass every year, score, popularity, media type,
 * language, and genre filter.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const applyFilters = (titles: StoreTitle[], filters: StoreFilters) => {
  const imdbRanks = imdbPopularityRanks(titles)
  const mediaTypes = new Set(filters.mediaTypes)
  const originalLanguages =
    filters.originalLanguages === null
      ? null
      : new Set(filters.originalLanguages)
  const languages =
    filters.languages === null ? null : new Set(filters.languages)
  const subtitleLanguages =
    filters.subtitleLanguages === null
      ? null
      : new Set(filters.subtitleLanguages)
  const genres = filters.genres === null ? null : new Set(filters.genres)

  const shelved: StoreTitle[] = []
  for (const title of titles) {
    if (title.year === null) {
      if (!filters.unknownYear) continue
    } else if (title.year < filters.yearFrom || title.year > filters.yearTo) {
      continue
    }

    if (
      outsideRange(
        title.tmdbScore,
        filters.tmdbScoreFrom,
        filters.tmdbScoreTo,
        filters.unknownTmdbScore,
      ) ||
      outsideRange(
        title.tmdbPopularity,
        filters.tmdbPopularityFrom,
        filters.tmdbPopularityTo,
        filters.unknownTmdbPopularity,
      ) ||
      outsideRange(
        title.imdbScore,
        filters.imdbScoreFrom,
        filters.imdbScoreTo,
        filters.unknownImdbScore,
      ) ||
      outsideRange(
        imdbRanks.get(title.id),
        filters.imdbPopularityFrom,
        filters.imdbPopularityTo,
        filters.unknownImdbPopularity,
      )
    ) {
      continue
    }

    if (title.mediaType === null) {
      if (!filters.unknownMediaType) continue
    } else if (!mediaTypes.has(title.mediaType)) {
      continue
    }

    if (title.originalLanguage === null) {
      if (!filters.unknownOriginalLanguage) continue
    } else if (
      originalLanguages !== null &&
      !originalLanguages.has(title.originalLanguage)
    ) {
      continue
    }

    if (title.languages.length === 0) {
      if (!filters.unknownLanguage) continue
    } else if (
      languages !== null &&
      !title.languages.some((code) => languages.has(code))
    ) {
      continue
    }

    if (title.subtitleLanguages.length === 0) {
      if (!filters.unknownSubtitleLanguage) continue
    } else if (
      subtitleLanguages !== null &&
      !title.subtitleLanguages.some((code) => subtitleLanguages.has(code))
    ) {
      continue
    }

    if (title.genres.length === 0) {
      if (!filters.unknownGenre) continue
    } else if (
      genres !== null &&
      !title.genres.some((genre) => genres.has(genre))
    ) {
      continue
    }

    shelved.push(title)
  }
  return shelved
}

// TODO: Validate
/**
 * Render a labelled text field that reports each typed value that parses as a
 * number, keeping the raw text while it is being edited.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) => {
  const [typed, setTyped] = useState<string | null>(null)

  return (
    <label className="flex flex-1 flex-col gap-1 text-[11px] uppercase tracking-wide text-white/45">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={typed ?? String(value)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const next = event.target.value
          setTyped(next)
          const parsed = Number(next)
          if (next.trim() !== "" && !Number.isNaN(parsed)) onChange(parsed)
        }}
        onBlur={() => setTyped(null)}
        className="w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40"
      />
    </label>
  )
}

// TODO: Validate
/**
 * Render a labelled checkbox with an optional title count.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const Toggle = ({
  label,
  count,
  checked,
  onChange,
}: {
  label: string
  count?: number
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm text-white/75">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="size-4 accent-emerald-400"
    />
    <span className="flex-1">{label}</span>
    {count !== undefined && (
      <span className="text-xs tabular-nums text-white/40">
        {count.toLocaleString()}
      </span>
    )}
  </label>
)

// TODO: Validate
/**
 * Return the lines describing how many titles pass the filters and what each
 * filter is set to.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const filterSummary = (
  titles: StoreTitle[],
  filters: StoreFilters,
): string[] => {
  const bounds = storeBounds(titles)
  // TODO: Validate
  /**
   * Return the summary line for a range filter, or any when it covers the full
   * range and allows unknown values.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const range = (
    label: string,
    from: number,
    to: number,
    boundFrom: number,
    boundTo: number,
    unknown: boolean,
  ) =>
    from === boundFrom && to === boundTo && unknown
      ? `${label}: any`
      : `${label}: ${from} to ${to}${unknown ? "" : ", no unknown"}`
  // TODO: Validate
  /**
   * Return the summary line for an option filter, naming up to three selected
   * options.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const chosen = (
    label: string,
    selected: string[] | null,
    options: string[],
    unknown: boolean,
  ) => {
    if (selected === null || selected.length === options.length) {
      return unknown ? `${label}: any` : `${label}: any known`
    }
    if (selected.length === 0) return `${label}: none`
    return `${label}: ${selected.slice(0, 3).join(", ")}${
      selected.length > 3 ? ` +${selected.length - 3}` : ""
    }`
  }

  return [
    `${applyFilters(titles, filters).length.toLocaleString()} of ${titles.length.toLocaleString()} titles`,
    range(
      "Year",
      filters.yearFrom,
      filters.yearTo,
      bounds.yearFrom,
      bounds.yearTo,
      filters.unknownYear,
    ),
    range(
      "TMDB Score",
      filters.tmdbScoreFrom,
      filters.tmdbScoreTo,
      bounds.tmdbScore.from,
      bounds.tmdbScore.to,
      filters.unknownTmdbScore,
    ),
    range(
      "TMDB Popularity",
      filters.tmdbPopularityFrom,
      filters.tmdbPopularityTo,
      bounds.tmdbPopularity.from,
      bounds.tmdbPopularity.to,
      filters.unknownTmdbPopularity,
    ),
    range(
      "IMDb Score",
      filters.imdbScoreFrom,
      filters.imdbScoreTo,
      bounds.imdbScore.from,
      bounds.imdbScore.to,
      filters.unknownImdbScore,
    ),
    range(
      "IMDb Popularity-ish",
      filters.imdbPopularityFrom,
      filters.imdbPopularityTo,
      bounds.imdbPopularity.from,
      bounds.imdbPopularity.to,
      filters.unknownImdbPopularity,
    ),
    chosen(
      "Media",
      filters.mediaTypes,
      bounds.mediaTypes,
      filters.unknownMediaType,
    ),
    chosen(
      "Original language",
      filters.originalLanguages,
      filters.originalLanguages ?? [],
      filters.unknownOriginalLanguage,
    ),
    chosen(
      "Spoken language",
      filters.languages,
      filters.languages ?? [],
      filters.unknownLanguage,
    ),
    chosen(
      "Subtitle language",
      filters.subtitleLanguages,
      filters.subtitleLanguages ?? [],
      filters.unknownSubtitleLanguage,
    ),
    chosen("Genres", filters.genres, bounds.genres, filters.unknownGenre),
  ]
}

// TODO: Validate
/**
 * Return a short description of a range filter, or Any or Any known when it
 * covers the full range.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const rangeSummary = (
  from: number,
  to: number,
  bound: { from: number; to: number },
  unknown: boolean,
) => {
  if (from === bound.from && to === bound.to) {
    return unknown ? "Any" : "Any known"
  }
  return `${from} to ${to}${unknown ? "" : ", no unknown"}`
}

// TODO: Validate
/**
 * Render from and to number fields and an unknown values checkbox for a range
 * filter.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const RangeFields = ({
  label,
  from,
  to,
  unknown,
  unknownLabel,
  onChange,
}: {
  label: string
  from: number
  to: number
  unknown: boolean
  unknownLabel: string
  onChange: (changes: { from?: number; to?: number; unknown?: boolean }) => void
}) => (
  <div className="flex flex-col gap-2">
    <span className="text-[11px] font-medium uppercase tracking-wide text-white/60">
      {label}
    </span>
    <div className="flex gap-2">
      <NumberField
        label="From"
        value={from}
        onChange={(value) => onChange({ from: value })}
      />
      <NumberField
        label="To"
        value={to}
        onChange={(value) => onChange({ to: value })}
      />
    </div>
    <Toggle
      label={unknownLabel}
      checked={unknown}
      onChange={(checked) => onChange({ unknown: checked })}
    />
  </div>
)

// TODO: Validate
/**
 * Render a labelled button showing a filter's summary that expands to show its
 * controls, highlighted when the filter narrows the titles.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const FilterDropdown = ({
  label,
  summary,
  active,
  children,
}: {
  label: string
  summary: string
  active: boolean
  children: React.ReactNode
}) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4 flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-white/50">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left text-sm ${
          active
            ? "border-emerald-300/40 bg-emerald-300/10 text-white"
            : "border-white/15 bg-black/50 text-white/75"
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-white/50 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/5 p-2">
          {children}
        </div>
      )}
    </div>
  )
}

// TODO: Validate
/**
 * Render a dropdown of checkboxes for picking which options a filter allows,
 * with all and none buttons, a search box for long lists, and an unknown values
 * checkbox.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const OptionDropdown = ({
  label,
  options,
  selected,
  unknownLabel,
  unknownChecked,
  onSelectedChange,
  onUnknownChange,
}: {
  label: string
  options: Array<{ value: string; label: string; count?: number }>
  selected: string[] | null
  unknownLabel: string
  unknownChecked: boolean
  onSelectedChange: (selected: string[]) => void
  onUnknownChange: (checked: boolean) => void
}) => {
  const [search, setSearch] = useState("")
  const chosen = selected ?? options.map((option) => option.value)
  const chosenOptions = options.filter((option) =>
    chosen.includes(option.value),
  )
  const visible = options.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  )
  const everything = chosenOptions.length === options.length

  let summary: string
  if (everything) {
    summary = unknownChecked ? "All" : "All known"
  } else if (chosenOptions.length === 0) {
    summary = unknownChecked ? "Only unknown" : "None"
  } else if (chosenOptions.length <= 2) {
    summary = chosenOptions.map((option) => option.label).join(", ")
  } else {
    summary = `${chosenOptions.length} of ${options.length}`
  }

  return (
    <FilterDropdown
      label={label}
      summary={summary}
      active={!everything || !unknownChecked}
    >
      {options.length > 8 && (
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Filter ${label.toLowerCase()}...`}
          className="w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40"
        />
      )}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() =>
            onSelectedChange(options.map((option) => option.value))
          }
          className="rounded-full border border-white/20 px-3 py-0.5 text-white/70 hover:text-white"
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onSelectedChange([])}
          className="rounded-full border border-white/20 px-3 py-0.5 text-white/70 hover:text-white"
        >
          None
        </button>
      </div>
      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
        {visible.map((option) => (
          <Toggle
            key={option.value}
            label={option.label}
            count={option.count}
            checked={chosen.includes(option.value)}
            onChange={(checked) =>
              onSelectedChange(
                checked
                  ? [...chosen, option.value]
                  : chosen.filter((value) => value !== option.value),
              )
            }
          />
        ))}
        {visible.length === 0 && (
          <span className="text-xs text-white/40">No matches.</span>
        )}
      </div>
      <Toggle
        label={unknownLabel}
        checked={unknownChecked}
        onChange={onUnknownChange}
      />
    </FilterDropdown>
  )
}

// TODO: Validate
/**
 * Render a row of color buttons from the palette, outlining the chosen one.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const Swatches = ({
  value,
  onChange,
  palette = PALETTE,
}: {
  value: number
  onChange: (color: number) => void
  palette?: { name: string; color: number }[]
}) => (
  <div className="flex flex-wrap gap-2">
    {palette.map((entry) => (
      <button
        key={entry.color}
        type="button"
        title={entry.name}
        onClick={() => onChange(entry.color)}
        style={{
          backgroundColor: `#${entry.color.toString(16).padStart(6, "0")}`,
        }}
        className={`size-7 rounded-md border ${
          value === entry.color ? "border-white" : "border-white/20"
        }`}
      />
    ))}
  </div>
)

// TODO: Validate
/**
 * Render a row of option buttons, highlighting the chosen index.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const Choices = ({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: number
  onChange: (index: number) => void
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((option, index) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(index)}
        className={`rounded-full border px-3 py-1 text-xs ${
          value === index
            ? "border-white/70 bg-white/15 text-white"
            : "border-white/20 text-white/70 hover:text-white"
        }`}
      >
        {option}
      </button>
    ))}
  </div>
)

// TODO: Validate
/**
 * Render a range slider with a text field for typing an exact value clamped to
 * the slider's bounds.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const Slider = ({
  value,
  min = 0,
  max,
  step,
  onChange,
}: {
  value: number
  min?: number
  max: number
  step: number
  onChange: (value: number) => void
}) => {
  const [typed, setTyped] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 flex-1 accent-emerald-400"
      />
      <input
        type="text"
        inputMode="decimal"
        value={typed ?? (step < 1 ? value.toFixed(1) : String(value))}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const next = event.target.value
          setTyped(next)
          const parsed = Number(next)
          if (next.trim() !== "" && !Number.isNaN(parsed)) {
            onChange(Math.min(max, Math.max(min, parsed)))
          }
        }}
        onBlur={() => setTyped(null)}
        className="w-16 rounded-md border border-white/15 bg-black/50 px-2 py-1 text-right text-xs tabular-nums text-white outline-none focus:border-white/40"
      />
    </div>
  )
}

// TODO: Validate
/**
 * Render the video store settings panel with filters, design, and audio tabs,
 * applying the drafted filters when the panel closes.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export function StoreFilterPanel({
  titles,
  filters,
  design,
  cheatCode,
  onCheatCode,
  open,
  onOpenChange,
  onApply,
  onDesign,
  hasFilterDefault,
  onSaveDesignDefault,
  onSaveFilterDefault,
  onLoadFilterDefault,
  metadata,
  onMetadata,
}: {
  titles: StoreTitle[]
  filters: StoreFilters
  design: StoreDesign
  cheatCode: string
  onCheatCode: (cheatCode: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (filters: StoreFilters) => void
  onDesign: (design: StoreDesign) => void
  hasFilterDefault: boolean
  onSaveDesignDefault: (design: StoreDesign) => void
  onSaveFilterDefault: (filters: StoreFilters) => void
  onLoadFilterDefault: () => void
  metadata: StoreMetadata
  onMetadata?: (metadata: StoreMetadata) => void
}) {
  const [draft, setDraft] = useState(filters)
  const metadataChoices: StoreMetadata[] = ["source", "tmdb"]
  const [tab, setTab] = useState<"filters" | "design" | "audio">("filters")
  const panelRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  const bounds = storeBounds(titles)

  draftRef.current = draft

  useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])

  const { data: originalLanguages } = useQuery({
    queryKey: ["video-store-original-languages"],
    queryFn: fetchOriginalLanguages,
    refetchOnWindowFocus: false,
  })

  const { data: spokenLanguages } = useQuery({
    queryKey: ["video-store-spoken-languages"],
    queryFn: fetchSpokenLanguages,
    refetchOnWindowFocus: false,
  })

  const { data: subtitleLanguages } = useQuery({
    queryKey: ["video-store-subtitle-languages"],
    queryFn: fetchSubtitleLanguages,
    refetchOnWindowFocus: false,
  })

  const languageNames = new Map(
    [
      ...(originalLanguages ?? []),
      ...(spokenLanguages ?? []),
      ...(subtitleLanguages ?? []),
    ].map((language) => [language.code, language.name]),
  )
  // TODO: Validate
  /**
   * Return dropdown options for the language codes, labelled with each
   * language's name and title count.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const languageOptions = (codes: string[], counts: Map<string, number>) =>
    codes.map((code) => {
      const name = languageNames.get(code)
      return {
        value: code,
        label: name ? `${name} (${code})` : code,
        count: counts.get(code),
      }
    })
  const yearSummary = rangeSummary(
    draft.yearFrom,
    draft.yearTo,
    { from: bounds.yearFrom, to: bounds.yearTo },
    draft.unknownYear,
  )
  // TODO: Validate
  /**
   * Return the narrowed range filters for one score source joined into one
   * line, or Any when none are narrowed.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const sourceSummary = (
    parts: Array<{
      label: string
      from: number
      to: number
      bound: { from: number; to: number }
      unknown: boolean
    }>,
  ) => {
    const narrowed = parts.flatMap((part) => {
      const summary = rangeSummary(part.from, part.to, part.bound, part.unknown)
      return summary === "Any" ? [] : [`${part.label} ${summary}`]
    })
    return narrowed.length === 0 ? "Any" : narrowed.join(" · ")
  }
  const tmdbSummary = sourceSummary([
    {
      label: "Score",
      from: draft.tmdbScoreFrom,
      to: draft.tmdbScoreTo,
      bound: bounds.tmdbScore,
      unknown: draft.unknownTmdbScore,
    },
    {
      label: "Popularity",
      from: draft.tmdbPopularityFrom,
      to: draft.tmdbPopularityTo,
      bound: bounds.tmdbPopularity,
      unknown: draft.unknownTmdbPopularity,
    },
  ])
  const imdbSummary = sourceSummary([
    {
      label: "Score",
      from: draft.imdbScoreFrom,
      to: draft.imdbScoreTo,
      bound: bounds.imdbScore,
      unknown: draft.unknownImdbScore,
    },
    {
      label: "Popularity-ish",
      from: draft.imdbPopularityFrom,
      to: draft.imdbPopularityTo,
      bound: bounds.imdbPopularity,
      unknown: draft.unknownImdbPopularity,
    },
  ])

  // TODO: Validate
  /**
   * Apply the drafted filters and close the panel.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const close = () => {
    onApply(draftRef.current)
    onOpenChange(false)
  }

  useEffect(() => {
    if (!open) return
    // TODO: Validate
    /**
     * Apply the drafted filters and close the panel when the user presses
     * outside it.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return
      onApply(draftRef.current)
      onOpenChange(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [open, onApply, onOpenChange])

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="absolute right-4 top-16 z-30 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/80 backdrop-blur hover:text-white"
        >
          <SlidersHorizontal className="size-4" />
          Settings
        </button>
      )}
      <div
        ref={panelRef}
        className={`absolute z-30 max-h-[80vh] overflow-y-auto rounded-xl border border-white/15 bg-black/85 p-4 text-white backdrop-blur ${
          open
            ? `right-4 top-16 ${tab === "audio" ? "w-[min(38rem,92vw)]" : "w-[min(20rem,90vw)]"}`
            : "pointer-events-none left-[-9999px] top-0 w-[38rem] opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Settings</span>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-1 text-white/60 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-1 rounded-lg bg-white/5 p-1">
          {(["filters", "design", "audio"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setTab(entry)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                tab === entry ? "bg-white/15 text-white" : "text-white/60"
              }`}
            >
              {entry}
            </button>
          ))}
        </div>

        {tab === "design" && (
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Loaded shelf runs
              </span>
              <Slider
                value={design.loadedRuns}
                min={1}
                max={60}
                step={1}
                onChange={(loadedRuns) => onDesign({ ...design, loadedRuns })}
              />
              <span className="text-xs text-white/40">
                The nearest runs are loaded. Shelves, signs and posters show out
                to the farthest loaded run.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Cases
              </span>
              <Choices
                options={FORMATS}
                value={design.format}
                onChange={(format) => onDesign({ ...design, format })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Floor
              </span>
              <Swatches
                value={design.floor}
                onChange={(floor) => onDesign({ ...design, floor })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Walls
              </span>
              <Swatches
                value={design.room}
                onChange={(room) => onDesign({ ...design, room })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Wood
              </span>
              <Swatches
                value={design.wood}
                palette={WOOD_PALETTE}
                onChange={(wood) => onDesign({ ...design, wood })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Indoor lights
              </span>
              <Slider
                value={design.lights}
                max={5}
                step={0.1}
                onChange={(lights) => onDesign({ ...design, lights })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Lit lamps
              </span>
              <Slider
                value={design.lamps}
                max={64}
                step={1}
                onChange={(lamps) => onDesign({ ...design, lamps })}
              />
              <span className="text-xs text-amber-300/80">
                Changing this re-renders the store when the menu closes
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Outdoor lights
              </span>
              <Slider
                value={design.outdoor}
                max={5}
                step={0.1}
                onChange={(outdoor) => onDesign({ ...design, outdoor })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Askew
              </span>
              <Slider
                value={design.askew}
                max={400}
                step={1}
                onChange={(askew) => onDesign({ ...design, askew })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Highlight pull out
              </span>
              <Slider
                value={design.pullOut}
                max={50}
                step={1}
                onChange={(pullOut) => onDesign({ ...design, pullOut })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Toggle
                label="Rain"
                checked={design.rain}
                onChange={(rain) => onDesign({ ...design, rain })}
              />
              {design.rain && (
                <div className="flex flex-col gap-2 pl-6">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                    Rain drops
                  </span>
                  <Slider
                    value={design.rainDrops}
                    max={20000}
                    step={200}
                    onChange={(rainDrops) => onDesign({ ...design, rainDrops })}
                  />
                  <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                    Rain speed
                  </span>
                  <Slider
                    value={design.rainSpeed}
                    max={40}
                    step={1}
                    onChange={(rainSpeed) => onDesign({ ...design, rainSpeed })}
                  />
                </div>
              )}
            </div>
            <Toggle
              label="Shine on cases"
              checked={design.shine}
              onChange={(shine) => onDesign({ ...design, shine })}
            />
            <Toggle
              label="Cases ignore lighting"
              checked={design.unlit}
              onChange={(unlit) => onDesign({ ...design, unlit })}
            />
            {design.unlit && (
              <div className="flex flex-col gap-2 pl-6">
                <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                  Unlit case brightness
                </span>
                <Slider
                  value={design.unlitBrightness}
                  max={100}
                  step={1}
                  onChange={(unlitBrightness) =>
                    onDesign({ ...design, unlitBrightness })
                  }
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Toggle
                label="Condensed view"
                checked={design.condensed}
                onChange={(condensed) => onDesign({ ...design, condensed })}
              />
              <span className="pl-6 text-xs text-amber-300/80">
                May cause freezing while covers load
              </span>
              {design.condensed && (
                <div className="flex flex-col gap-2 pl-6">
                  <Toggle
                    label="Wider DVDs"
                    checked={design.widerCases}
                    onChange={(widerCases) =>
                      onDesign({ ...design, widerCases })
                    }
                  />
                  <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                    Condensed highlight pull out
                  </span>
                  <Slider
                    value={design.condensedPullOut}
                    max={50}
                    step={1}
                    onChange={(condensedPullOut) =>
                      onDesign({ ...design, condensedPullOut })
                    }
                  />
                </div>
              )}
            </div>
            <Toggle
              label="Full size posters"
              checked={design.fullPosters}
              onChange={(fullPosters) => onDesign({ ...design, fullPosters })}
            />
            <Toggle
              label="Show FPS counter"
              checked={design.fps}
              onChange={(fps) => onDesign({ ...design, fps })}
            />
            <Toggle
              label="Play trailers automatically"
              checked={design.autoplayTrailers}
              onChange={(autoplayTrailers) =>
                onDesign({ ...design, autoplayTrailers })
              }
            />
            <Toggle
              label="Auto load images"
              checked={design.autoLoadImages}
              onChange={(autoLoadImages) =>
                onDesign({ ...design, autoLoadImages })
              }
            />
            <Toggle
              label="Image logos on spines"
              checked={design.imageLogos}
              onChange={(imageLogos) => onDesign({ ...design, imageLogos })}
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                Cheat code
              </span>
              <input
                type="text"
                value={cheatCode}
                onChange={(event) => onCheatCode(event.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onSaveDesignDefault(design)}
                className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:text-white"
              >
                Save settings
              </button>
              <button
                type="button"
                onClick={() => onDesign(defaultDesign)}
                className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:text-white"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}

        <div
          className={
            tab === "audio"
              ? "flex flex-col gap-4 pt-4"
              : "pointer-events-none absolute left-[-9999px] top-0 flex w-[34rem] flex-col gap-4 opacity-0"
          }
        >
          <span className="text-xs font-medium uppercase tracking-wide text-white/50">
            Store soundtrack
          </span>
          <iframe
            title="Store soundtrack"
            src="https://www.youtube.com/embed/qX_XTr0rN2E"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="aspect-video w-full rounded-lg border border-white/15"
          />
          <p className="text-[11px] text-white/40">
            Keeps playing while you browse the shelves.
          </p>
        </div>

        {tab === "filters" && (
          <>
            {onMetadata && (
              <div className="mt-4 flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/50">
                  Data
                </span>
                <Choices
                  options={["Website", "TMDB"]}
                  value={metadataChoices.indexOf(metadata)}
                  onChange={(index) => onMetadata(metadataChoices[index])}
                />
                <p className="text-[11px] text-white/40">
                  Where the names, years, artwork, blurbs and scores come from.
                </p>
              </div>
            )}

            <FilterDropdown
              label="Year"
              summary={yearSummary}
              active={!yearSummary.startsWith("Any") || !draft.unknownYear}
            >
              <div className="flex gap-2">
                <NumberField
                  label="From"
                  value={draft.yearFrom}
                  onChange={(value) => setDraft({ ...draft, yearFrom: value })}
                />
                <NumberField
                  label="To"
                  value={draft.yearTo}
                  onChange={(value) => setDraft({ ...draft, yearTo: value })}
                />
              </div>
              <Toggle
                label="Include titles with no year"
                checked={draft.unknownYear}
                onChange={(checked) =>
                  setDraft({ ...draft, unknownYear: checked })
                }
              />
            </FilterDropdown>

            <FilterDropdown
              label="TMDB"
              summary={tmdbSummary}
              active={tmdbSummary !== "Any"}
            >
              <RangeFields
                label="Score"
                from={draft.tmdbScoreFrom}
                to={draft.tmdbScoreTo}
                unknown={draft.unknownTmdbScore}
                unknownLabel="Include titles with no TMDB score"
                onChange={({ from, to, unknown }) =>
                  setDraft({
                    ...draft,
                    tmdbScoreFrom: from ?? draft.tmdbScoreFrom,
                    tmdbScoreTo: to ?? draft.tmdbScoreTo,
                    unknownTmdbScore: unknown ?? draft.unknownTmdbScore,
                  })
                }
              />
              <RangeFields
                label="Popularity"
                from={draft.tmdbPopularityFrom}
                to={draft.tmdbPopularityTo}
                unknown={draft.unknownTmdbPopularity}
                unknownLabel="Include titles with no TMDB popularity"
                onChange={({ from, to, unknown }) =>
                  setDraft({
                    ...draft,
                    tmdbPopularityFrom: from ?? draft.tmdbPopularityFrom,
                    tmdbPopularityTo: to ?? draft.tmdbPopularityTo,
                    unknownTmdbPopularity:
                      unknown ?? draft.unknownTmdbPopularity,
                  })
                }
              />
            </FilterDropdown>

            <FilterDropdown
              label="IMDb"
              summary={imdbSummary}
              active={imdbSummary !== "Any"}
            >
              <RangeFields
                label="Score"
                from={draft.imdbScoreFrom}
                to={draft.imdbScoreTo}
                unknown={draft.unknownImdbScore}
                unknownLabel="Include titles with no IMDb score"
                onChange={({ from, to, unknown }) =>
                  setDraft({
                    ...draft,
                    imdbScoreFrom: from ?? draft.imdbScoreFrom,
                    imdbScoreTo: to ?? draft.imdbScoreTo,
                    unknownImdbScore: unknown ?? draft.unknownImdbScore,
                  })
                }
              />
              <RangeFields
                label="Popularity-ish"
                from={draft.imdbPopularityFrom}
                to={draft.imdbPopularityTo}
                unknown={draft.unknownImdbPopularity}
                unknownLabel="Include titles with no IMDb votes"
                onChange={({ from, to, unknown }) =>
                  setDraft({
                    ...draft,
                    imdbPopularityFrom: from ?? draft.imdbPopularityFrom,
                    imdbPopularityTo: to ?? draft.imdbPopularityTo,
                    unknownImdbPopularity:
                      unknown ?? draft.unknownImdbPopularity,
                  })
                }
              />
              <p className="text-[11px] text-white/40">
                Ranked by IMDb votes, so 1 to 100 keeps the 100 most voted
                titles.
              </p>
            </FilterDropdown>

            <OptionDropdown
              label="Media type"
              options={bounds.mediaTypes.map((mediaType) => ({
                value: mediaType,
                label: mediaType,
                count: bounds.counts.mediaTypes.get(mediaType),
              }))}
              selected={draft.mediaTypes}
              unknownLabel={UNKNOWN_MEDIA_TYPE}
              unknownChecked={draft.unknownMediaType}
              onSelectedChange={(selected) =>
                setDraft({ ...draft, mediaTypes: selected })
              }
              onUnknownChange={(checked) =>
                setDraft({ ...draft, unknownMediaType: checked })
              }
            />

            <OptionDropdown
              label="Original language"
              options={languageOptions(
                bounds.originalLanguages,
                bounds.counts.originalLanguages,
              )}
              selected={draft.originalLanguages}
              unknownLabel="Include titles with no original language"
              unknownChecked={draft.unknownOriginalLanguage}
              onSelectedChange={(selected) =>
                setDraft({ ...draft, originalLanguages: selected })
              }
              onUnknownChange={(checked) =>
                setDraft({ ...draft, unknownOriginalLanguage: checked })
              }
            />

            <OptionDropdown
              label="Spoken language"
              options={languageOptions(
                bounds.languages,
                bounds.counts.languages,
              )}
              selected={draft.languages}
              unknownLabel="Include titles with no spoken language"
              unknownChecked={draft.unknownLanguage}
              onSelectedChange={(selected) =>
                setDraft({ ...draft, languages: selected })
              }
              onUnknownChange={(checked) =>
                setDraft({ ...draft, unknownLanguage: checked })
              }
            />

            <OptionDropdown
              label="Subtitle language"
              options={languageOptions(
                bounds.subtitleLanguages,
                bounds.counts.subtitleLanguages,
              )}
              selected={draft.subtitleLanguages}
              unknownLabel="Include titles with no subtitle language"
              unknownChecked={draft.unknownSubtitleLanguage}
              onSelectedChange={(selected) =>
                setDraft({ ...draft, subtitleLanguages: selected })
              }
              onUnknownChange={(checked) =>
                setDraft({ ...draft, unknownSubtitleLanguage: checked })
              }
            />

            <OptionDropdown
              label="Genres"
              options={bounds.genres.map((genre) => ({
                value: genre,
                label: genre,
                count: bounds.counts.genres.get(genre),
              }))}
              selected={draft.genres}
              unknownLabel="Include titles with no genre"
              unknownChecked={draft.unknownGenre}
              onSelectedChange={(selected) =>
                setDraft({ ...draft, genres: selected })
              }
              onUnknownChange={(checked) =>
                setDraft({ ...draft, unknownGenre: checked })
              }
            />

            <div className="mt-4 flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  onApply(draft)
                  onSaveFilterDefault(draft)
                }}
                className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:text-white"
              >
                Set default
              </button>
              {hasFilterDefault && (
                <button
                  type="button"
                  onClick={onLoadFilterDefault}
                  className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:text-white"
                >
                  Load default
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/50">
              <span>
                {applyFilters(titles, draft).length.toLocaleString()} on the
                shelves
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(defaultFilters(titles))}
                  className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:text-white"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-emerald-300/40 px-3 py-1 font-medium text-emerald-200 hover:bg-emerald-300/10"
                >
                  Apply
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
