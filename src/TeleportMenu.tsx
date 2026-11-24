// TODO: Validate
import { MapPin, X } from "lucide-react"
import { useMemo, useState } from "react"
import type { StoreTitle } from "./caseTexture"
import type { VideoStore } from "./videoStore"

// TODO: Validate
/**
 * Render a menu that teleports the player to the front desk, the back corner, a
 * genre, or a title found by name.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export function TeleportMenu({
  store,
  titles,
  touch,
}: {
  store: VideoStore | null
  titles: StoreTitle[]
  touch: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [missing, setMissing] = useState<string | null>(null)
  const [mode, setMode] = useState<"titles" | "genres">("titles")
  const genres = useMemo(
    () => (open ? (store?.genreLabels() ?? []) : []),
    [open, store],
  )
  const genreMatches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return genres.filter((genre) =>
      genre.replace(/^_/, "").toLowerCase().includes(needle),
    )
  }, [genres, query])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const seen = new Set<string>()
    const unique = titles.filter((title) => {
      if (seen.has(title.id)) return false
      seen.add(title.id)
      return needle === "" || title.name.toLowerCase().includes(needle)
    })
    return unique
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 50)
  }, [titles, query])

  // TODO: Validate
  /**
   * Close the menu, clear the search, and lock the pointer back into the store.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const arrive = () => {
    setOpen(false)
    setQuery("")
    setMissing(null)
    store?.lock()
  }

  // TODO: Validate
  /**
   * Teleport to the title's case, or say it is not on the shelves when the
   * store cannot find it.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const goToTitle = (title: StoreTitle) => {
    if (!store?.teleportToTitle(title)) {
      setMissing(title.name)
      return
    }
    arrive()
  }

  const placement = touch ? "bottom-28 right-6" : "bottom-5 right-5"

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`absolute z-20 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/85 backdrop-blur hover:bg-black/75 ${placement}`}
      >
        <MapPin className="size-4" />
        Teleport
      </button>
    )
  }

  return (
    <div
      className={`absolute z-20 flex max-h-[70vh] w-[min(20rem,90vw)] flex-col gap-3 rounded-lg border border-white/15 bg-black/80 p-3 text-white backdrop-blur ${placement}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Teleport</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-1 text-white/60 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            store?.teleportToDesk()
            arrive()
          }}
          className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-white/80 hover:text-white"
        >
          Front desk
        </button>
        <button
          type="button"
          onClick={() => {
            store?.teleportToBackCorner()
            arrive()
          }}
          className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-white/80 hover:text-white"
        >
          Back corner
        </button>
      </div>
      <div className="flex gap-1 rounded-lg bg-white/5 p-1">
        {(["titles", "genres"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => {
              setMode(entry)
              setMissing(null)
            }}
            className={`flex-1 rounded-md px-3 py-1 text-xs font-medium capitalize ${
              mode === entry ? "bg-white/15 text-white" : "text-white/60"
            }`}
          >
            {entry}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={query}
        placeholder={mode === "titles" ? "Search titles" : "Search genres"}
        onChange={(event) => {
          setQuery(event.target.value)
          setMissing(null)
        }}
        className="w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40"
      />
      {missing && (
        <span className="text-xs text-amber-300/80">
          {missing} isn't on the shelves
        </span>
      )}
      <div className="flex min-h-0 flex-col overflow-y-auto">
        {mode === "genres" &&
          genreMatches.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => {
                if (store?.teleportToGenre(genre)) arrive()
              }}
              className="shrink-0 truncate rounded px-2 py-1.5 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              {genre.replace(/^_/, "")}
            </button>
          ))}
        {mode === "titles" &&
          matches.map((title) => (
            <button
              key={title.id}
              type="button"
              onClick={() => goToTitle(title)}
              className="shrink-0 truncate rounded px-2 py-1.5 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              {title.name}
              {title.year && (
                <span className="ml-2 text-xs text-white/40">{title.year}</span>
              )}
            </button>
          ))}
        {(mode === "titles" ? matches : genreMatches).length === 0 && (
          <span className="px-2 py-1.5 text-xs text-white/40">No matches</span>
        )}
      </div>
    </div>
  )
}
