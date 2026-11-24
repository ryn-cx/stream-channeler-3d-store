// TODO: Validate
import { useEffect, useMemo, useRef, useState } from "react"
import { CaseViewer } from "./CaseViewer"
import { CounterChannels } from "./CounterChannels"
import type { StoreTitle } from "./caseTexture"
import { readCounter, writeCounter } from "./counter"
import { defaultDesign, designSummary, type StoreDesign } from "./StoreDesign"
import {
  applyFilters,
  defaultFilters,
  filterSummary,
  imdbPopularityRanks,
  StoreFilterPanel,
  type StoreFilters,
} from "./StoreFilters"
import { configureStoreBackend, type StoreBackend } from "./storeBackend"
import { pickStock, type StoreMetadata, type StoreStock } from "./storeStock"
import { VideoStoreCanvas } from "./VideoStoreCanvas"
import { baySlots, shelfSlots, type VideoStore } from "./videoStore"

// TODO: Validate
/**
 * Return the store design the user saved as their default in local storage, or
 * null when none is saved.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const readDefaultDesign = (): Partial<StoreDesign> | null => {
  const stored = localStorage.getItem("video-store-design-saved")
  return stored ? JSON.parse(stored) : null
}

// TODO: Validate
/**
 * Save the store design to local storage as the user's default.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const writeDefaultDesign = (design: StoreDesign) => {
  localStorage.setItem("video-store-design-saved", JSON.stringify(design))
}

// TODO: Validate
/**
 * Return the local storage key holding the store's filters.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const filterKeyFor = (storeKey: string) => `video-store-filters:${storeKey}`

// TODO: Validate
/**
 * Return the store filters the user saved as their default in local storage, or
 * null when none are saved.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const readDefaultFilters = (): Partial<StoreFilters> | null => {
  const stored = localStorage.getItem("video-store-filters-default")
  return stored ? JSON.parse(stored) : null
}

// TODO: Validate
/**
 * Save the store filters to local storage as the user's default.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const writeDefaultFilters = (filters: StoreFilters) => {
  localStorage.setItem("video-store-filters-default", JSON.stringify(filters))
}

// TODO: Validate
/**
 * Return the filters saved for the store, falling back to the user's default
 * filters or none.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const readFilters = (storeKey: string): Partial<StoreFilters> => {
  const stored = localStorage.getItem(filterKeyFor(storeKey))
  return stored ? JSON.parse(stored) : (readDefaultFilters() ?? {})
}

// TODO: Validate
/**
 * Save the filters for the store to local storage.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const writeFilters = (storeKey: string, filters: StoreFilters) => {
  localStorage.setItem(filterKeyFor(storeKey), JSON.stringify(filters))
}

// TODO: Validate
/**
 * Render a 3D video store stocked with the downloaded titles, with its settings
 * panel, case viewer, counter, and channel actions.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export function StoreScreen({
  backend,
  storeKey,
  storeName,
  fetchStock,
  emptyMessage,
  back,
  metadata = "tmdb",
  onMetadata,
}: {
  backend: StoreBackend
  storeKey: string
  storeName: string
  fetchStock: () => Promise<StoreStock>
  emptyMessage: string
  back: React.ReactNode
  metadata?: StoreMetadata
  onMetadata?: (metadata: StoreMetadata) => void
}) {
  const [stock, setStock] = useState<StoreStock | null>(null)
  const [filters, setFilters] = useState<StoreFilters | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [store, setStore] = useState<VideoStore | null>(null)
  const [design, setDesign] = useState<StoreDesign>(() => ({
    ...defaultDesign,
    ...readDefaultDesign(),
  }))
  const [cheatCode, setCheatCode] = useState("")
  const [shelfLayout, setShelfLayout] = useState({
    condensed: design.condensed,
    format: design.format,
    widerCases: design.widerCases,
    lamps: design.lamps,
  })
  const [hasFilterDefault, setHasFilterDefault] = useState(
    readDefaultFilters() !== null,
  )
  const [inspecting, setInspecting] = useState<StoreTitle | null>(null)
  const [caseFormat, setCaseFormat] = useState(0)
  const [counter, setCounter] = useState<StoreTitle[]>(readCounter)
  const [flash, setFlash] = useState<string | null>(null)
  const [channelAction, setChannelAction] = useState<"create" | "add" | null>(
    null,
  )
  const fetchRef = useRef(fetchStock)
  const metadataRef = useRef(metadata)
  const stockedKey = useRef<string | null>(null)

  configureStoreBackend(backend)
  fetchRef.current = fetchStock
  metadataRef.current = metadata

  useEffect(() => {
    let cancelled = false
    if (stockedKey.current !== storeKey) {
      stockedKey.current = storeKey
      setStock(null)
    }

    // TODO: Validate
    /**
     * Download the store's stock and load its filters, starting from defaults
     * that cover every title and applying any saved filters.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const stockShelves = async () => {
      const shelved = await fetchRef.current()
      if (cancelled) return
      setStock(shelved)
      setFilters({
        ...defaultFilters(pickStock(shelved, metadataRef.current)),
        ...readFilters(storeKey),
      })
    }

    stockShelves()
    return () => {
      cancelled = true
    }
  }, [storeKey])

  const titles = useMemo(
    () => (stock ? pickStock(stock, metadata) : null),
    [stock, metadata],
  )

  useEffect(() => {
    if (!store || !titles || !filters) return
    store.setBoard(filterSummary(titles, filters), designSummary(design))
  }, [store, titles, filters, design])

  useEffect(() => {
    store?.setMetadata(metadata)
  }, [store, metadata])

  useEffect(() => {
    if (!flash) return
    const handle = setTimeout(() => setFlash(null), 2600)
    return () => clearTimeout(handle)
  }, [flash])

  useEffect(() => {
    store?.setCounter(counter)
  }, [store, counter])

  useEffect(() => {
    store?.setChannelButtons(backend.channelsAvailable())
  }, [store, backend])

  useEffect(() => {
    if (!store) return
    store.setFloorColor(design.floor)
    store.setRoomColor(design.room)
    store.setWoodColor(design.wood)
    store.setReflections(design.shine)
    store.setUnlitBrightness(design.unlitBrightness)
    store.setUnlit(design.unlit)
    store.setWiderCases(design.widerCases)
    store.setFormat(design.format)
    store.setCondensed(design.condensed)
    store.setFullPosters(design.fullPosters)
    store.setLights(design.lights)
    store.setOutdoorLights(design.outdoor)
    store.setAskew(design.askew)
    store.setRain(design.rain ? design.rainDrops : 0, design.rainSpeed)
    store.setFps(design.fps)
    store.setAutoLoadImages(design.autoLoadImages)
    store.setImageLogos(design.imageLogos)
    store.setPullOut(design.pullOut, design.condensedPullOut)
    store.setLoadedRuns(design.loadedRuns)
  }, [store, design])

  useEffect(() => {
    if (filtersOpen) return
    setShelfLayout({
      condensed: design.condensed,
      format: design.format,
      widerCases: design.widerCases,
      lamps: design.lamps,
    })
  }, [
    filtersOpen,
    design.condensed,
    design.format,
    design.widerCases,
    design.lamps,
  ])

  useEffect(() => {
    store?.setLampCount(shelfLayout.lamps)
  }, [store, shelfLayout.lamps])

  useEffect(() => {
    store?.setCheatCode(cheatCode)
  }, [store, cheatCode])

  // TODO: Validate
  /**
   * Open the case viewer for the title in the store's current case format.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const onActivate = (title: StoreTitle) => {
    setCaseFormat(store?.caseFormat() ?? 0)
    setInspecting(title)
  }

  const shelved = useMemo(
    () => (titles && filters ? applyFilters(titles, filters) : []),
    [titles, filters],
  )

  useEffect(() => {
    const shuffledTvTrailers = shelved.flatMap((title) =>
      title.trailerUrl ? [{ title, url: title.trailerUrl }] : [],
    )
    for (let index = shuffledTvTrailers.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[shuffledTvTrailers[index], shuffledTvTrailers[swapIndex]] = [
        shuffledTvTrailers[swapIndex],
        shuffledTvTrailers[index],
      ]
    }
    store?.setTvTrailers(shuffledTvTrailers)
  }, [store, shelved])

  // TODO: Validate
  /**
   * Put the title at the counter, moving it to the end if it is already there,
   * and say how many titles are held.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const takeToCounter = (title: StoreTitle) => {
    const next = [...counter.filter((entry) => entry.id !== title.id), title]
    writeCounter(next)
    setCounter(next)
    setFlash(`${title.name} is waiting at the counter · ${next.length} held`)
  }

  const shelfFilter = useMemo(
    () => (filters?.genres ? new Set(filters.genres) : null),
    [filters],
  )
  const bay = baySlots(
    shelfLayout.condensed,
    shelfLayout.format,
    shelfLayout.widerCases,
  )
  const slotCount = useMemo(
    () => shelfSlots(shelved, shelfFilter, bay),
    [shelved, shelfFilter, bay],
  )
  const filterKey = useMemo(
    () => (filters ? `${metadata}:${JSON.stringify(filters)}` : ""),
    [filters, metadata],
  )

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {stock === null || shelved.length > 0 ? (
        <VideoStoreCanvas
          key={`${storeKey}:${bay}:${shelfLayout.format}:${shelfLayout.condensed}:${shelfLayout.widerCases}:${shelfLayout.lamps}`}
          stocked={stock !== null && filters !== null}
          titles={shelved}
          slotCount={slotCount}
          bay={bay}
          genres={filters?.genres ?? null}
          restockKey={filterKey}
          storeName={storeName}
          paused={inspecting !== null || filtersOpen || channelAction !== null}
          onStore={setStore}
          onFilters={() => setFiltersOpen(true)}
          onChannelAction={setChannelAction}
          onActivate={onActivate}
          onTakeToCounter={takeToCounter}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center text-white/70">
          <span>
            {stock.length > 0 ? "Nothing matches these filters." : emptyMessage}
          </span>
        </div>
      )}

      {titles && filters && (
        <StoreFilterPanel
          titles={titles}
          filters={filters}
          design={design}
          cheatCode={cheatCode}
          onCheatCode={setCheatCode}
          onDesign={setDesign}
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          onApply={(next) => {
            writeFilters(storeKey, next)
            setFilters(next)
          }}
          hasFilterDefault={hasFilterDefault}
          onSaveDesignDefault={writeDefaultDesign}
          onSaveFilterDefault={(next) => {
            writeDefaultFilters(next)
            setHasFilterDefault(true)
          }}
          onLoadFilterDefault={() => {
            const stored = readDefaultFilters()
            if (!stored || !titles) return
            const next = { ...defaultFilters(titles), ...stored }
            writeFilters(storeKey, next)
            setFilters(next)
          }}
          metadata={metadata}
          onMetadata={onMetadata}
        />
      )}

      {flash && (
        <div className="pointer-events-none absolute inset-x-0 top-6 z-40 flex justify-center">
          <div className="max-w-[90vw] truncate rounded-full border border-emerald-300/40 bg-black/80 px-5 py-2 text-sm text-emerald-100 backdrop-blur">
            {flash}
          </div>
        </div>
      )}

      {channelAction && (
        <CounterChannels
          action={channelAction}
          titles={counter}
          onClose={() => setChannelAction(null)}
        />
      )}

      {inspecting && (
        <CaseViewer
          title={inspecting}
          imdbRank={
            titles
              ? (imdbPopularityRanks(titles).get(inspecting.id) ?? null)
              : null
          }
          format={caseFormat}
          metadata={metadata}
          autoplayTrailers={design.autoplayTrailers}
          imageLogos={design.imageLogos}
          onClose={() => {
            setInspecting(null)
            if (navigator.userActivation.isActive) store?.lock()
          }}
          atCounter={counter.some((entry) => entry.id === inspecting.id)}
          onTakeToCounter={() => takeToCounter(inspecting)}
          onRemoveFromCounter={() => {
            const next = counter.filter((entry) => entry.id !== inspecting.id)
            writeCounter(next)
            setCounter(next)
            setFlash(`${inspecting.name} went back on the shelf`)
          }}
        />
      )}

      {back}
    </div>
  )
}
