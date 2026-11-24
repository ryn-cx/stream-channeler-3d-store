// TODO: Validate
import { Info, ShoppingCart, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import imdbIconUrl from "./assets/imdb.svg?url"
import {
  createBackTexture,
  createCaseCanvas,
  type StoreTitle,
  spineSpan,
} from "./caseTexture"
import { storeBackend } from "./storeBackend"
import { loadStoreImage } from "./storeImage"
import type { StoreMetadata } from "./storeStock"
import type {
  StoreTitleSource,
  StoreTrailer,
  StoreWatchLink,
} from "./storeTypes"
import { TrailerPlayer } from "./TrailerPlayer"
import { fetchTitleDetail } from "./titleDetail"

// TODO: Validate
/**
 * Return a texture that shows one region of the 256 pixel case canvas, so each
 * face of the case box can use its own part of the artwork.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const regionTexture = (
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.offset.set(x / 256, y / 256)
  texture.repeat.set(width / 256, height / 256)
  return texture
}

// TODO: Validate
/**
 * Render a close-up of a title's case that the user can spin and zoom, with its
 * trailers, watch links, IMDb link, more information, and counter buttons.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export function CaseViewer({
  title,
  imdbRank,
  format,
  metadata,
  autoplayTrailers,
  imageLogos,
  atCounter,
  onClose,
  onTakeToCounter,
  onRemoveFromCounter,
}: {
  title: StoreTitle
  imdbRank: number | null
  format: number
  metadata: StoreMetadata
  autoplayTrailers: boolean
  imageLogos: boolean
  atCounter: boolean
  onClose: () => void
  onTakeToCounter: () => void
  onRemoveFromCounter: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [links, setLinks] = useState<StoreWatchLink[]>([])
  const [sources, setSources] = useState<StoreTitleSource[]>([])
  const [trailers, setTrailers] = useState<StoreTrailer[]>([])
  const [imdbId, setImdbId] = useState<string | null>(null)
  const [showingInformation, setShowingInformation] = useState(false)

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    // TODO: Validate
    /**
     * Stop the event from reaching the store scene underneath the overlay.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const swallow = (event: Event) => event.stopPropagation()
    // TODO: Validate
    /**
     * Prevent the event's default browser behaviour, such as dragging.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const block = (event: Event) => event.preventDefault()
    overlay.addEventListener("mousedown", swallow)
    overlay.addEventListener("pointerdown", swallow)
    overlay.addEventListener("dragstart", block)
    return () => {
      overlay.removeEventListener("mousedown", swallow)
      overlay.removeEventListener("pointerdown", swallow)
      overlay.removeEventListener("dragstart", block)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const stage = stageRef.current
    if (!container || !stage) return

    let disposed = false
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(stage.clientWidth, stage.clientHeight)
    renderer.domElement.draggable = false
    renderer.domElement.style.userSelect = "none"
    stage.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      50,
    )
    camera.position.set(0, 0, 4.4)

    scene.add(new THREE.AmbientLight(0xffffff, 1.9))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(2.5, 3, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x9ad7ff, 0.7)
    rim.position.set(-3, -1, -4)
    scene.add(rim)

    const leftEdge = new THREE.MeshStandardMaterial({ roughness: 0.5 })
    const rightEdge = new THREE.MeshStandardMaterial({ roughness: 0.5 })
    const top = new THREE.MeshStandardMaterial({ roughness: 0.5 })
    const bottom = new THREE.MeshStandardMaterial({ roughness: 0.5 })
    const front = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0,
    })
    const back = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0,
    })
    const materials = [rightEdge, leftEdge, top, bottom, front, back]

    const depth = format === 1 ? 0.28 : format === 3 ? 0.9 : 0.15
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(format === 1 ? 1.05 : 1.35, 1.9, depth),
      materials,
    )
    mesh.rotation.set(0, -0.5, 0)
    scene.add(mesh)

    // TODO: Validate
    /**
     * Download the title's detail and images, then paint its cover, spine,
     * edges, and back onto the case faces.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const paint = async () => {
      const detail = await fetchTitleDetail(title.id, metadata)
      if (disposed) return
      setLinks(detail.links)
      setSources(detail.sources)
      setTrailers(detail.trailers)
      setImdbId(detail.imdb_id)
      const poster = detail.poster ?? (title.isPoster ? title.image : null)
      const [cover, backdrop, logo] = await Promise.all([
        loadStoreImage(poster ?? detail.backdrop ?? title.image, "w780"),
        loadStoreImage(detail.backdrop, "w780"),
        imageLogos ? loadStoreImage(detail.logo ?? title.logo, "w300") : null,
      ])
      if (disposed) return
      const caseCanvas = createCaseCanvas(
        { ...title, isPoster: Boolean(poster) },
        cover,
        5,
        false,
        logo,
        depth / 1.9,
      )
      const span = spineSpan(depth / 1.9)
      front.map = regionTexture(caseCanvas, 0, 32, 168, 224)
      front.needsUpdate = true
      leftEdge.map = regionTexture(caseCanvas, 168, 32, span, 224)
      leftEdge.needsUpdate = true
      rightEdge.map = regionTexture(caseCanvas, 168 + span, 32, 88 - span, 224)
      rightEdge.needsUpdate = true
      top.map = regionTexture(caseCanvas, 0, 16, 168, 16)
      top.needsUpdate = true
      bottom.map = regionTexture(caseCanvas, 0, 0, 168, 16)
      bottom.needsUpdate = true
      back.map = createBackTexture(
        title,
        {
          description: detail.description ?? null,
          originalLanguage: detail.original_language ?? null,
          languages: detail.languages,
          subtitleLanguages: detail.subtitle_languages,
          runtime: detail.runtime,
          imdbRank,
          watchSites: detail.links.map((link) => link.source_name),
        },
        backdrop,
        cover,
      )
      back.needsUpdate = true
    }
    paint()

    let lastX = 0
    let lastY = 0
    let spin = 0.0045
    let distance = 4.4
    let pinch = 0
    const pointers = new Map<number, { x: number; y: number }>()

    // TODO: Validate
    /**
     * Move the camera to the distance, clamped to the allowed zoom range.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const zoom = (next: number) => {
      distance = THREE.MathUtils.clamp(next, 1.9, 9)
      camera.position.z = distance
    }

    // TODO: Validate
    /**
     * Return the distance between the two active pointers of a pinch.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const pinchSpan = () => {
      const [first, second] = [...pointers.values()]
      return Math.hypot(first.x - second.x, first.y - second.y)
    }

    // TODO: Validate
    /**
     * Stop the idle spin and start tracking the pointer for dragging or
     * pinching.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault()
      spin = 0
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      lastX = event.clientX
      lastY = event.clientY
      if (pointers.size === 2) pinch = pinchSpan()
      container.setPointerCapture(event.pointerId)
    }

    // TODO: Validate
    /**
     * Zoom by the change in pinch span when two pointers are down, otherwise
     * rotate the case by the drag distance.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointers.size >= 2) {
        const span = pinchSpan()
        if (pinch > 0 && span > 0) zoom(distance * (pinch / span))
        pinch = span
        return
      }

      mesh.rotation.y += (event.clientX - lastX) * 0.01
      mesh.rotation.x = THREE.MathUtils.clamp(
        mesh.rotation.x + (event.clientY - lastY) * 0.01,
        -Math.PI / 2,
        Math.PI / 2,
      )
      lastX = event.clientX
      lastY = event.clientY
    }

    // TODO: Validate
    /**
     * Stop tracking the pointer and continue the drag from any pointer still
     * down.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const onPointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      pinch = 0
      const remaining = [...pointers.values()][0]
      if (remaining) {
        lastX = remaining.x
        lastY = remaining.y
      }
      container.releasePointerCapture(event.pointerId)
    }

    // TODO: Validate
    /**
     * Stop the idle spin and zoom the camera by the wheel distance.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      spin = 0
      zoom(distance + event.deltaY * 0.0022)
    }

    container.addEventListener("pointerdown", onPointerDown)
    container.addEventListener("pointermove", onPointerMove)
    container.addEventListener("pointerup", onPointerUp)
    container.addEventListener("pointercancel", onPointerUp)
    container.addEventListener("wheel", onWheel, { passive: false })

    let layout = ""
    // TODO: Validate
    /**
     * Resize the renderer to the stage and offset the camera so the case stays
     * centred in its slot, skipping the work when the layout has not changed.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const fitView = () => {
      const slot = container.getBoundingClientRect()
      const bounds = stage.getBoundingClientRect()
      if (!slot.width || !slot.height || !bounds.width || !bounds.height) return
      const next = [
        slot.left,
        slot.top,
        slot.width,
        slot.height,
        bounds.left,
        bounds.top,
        bounds.width,
        bounds.height,
      ].join()
      if (next === layout) return
      layout = next
      renderer.setSize(bounds.width, bounds.height)
      camera.aspect = slot.width / slot.height
      camera.setViewOffset(
        slot.width,
        slot.height,
        bounds.left - slot.left,
        bounds.top - slot.top,
        bounds.width,
        bounds.height,
      )
    }

    let frame = 0
    // TODO: Validate
    /**
     * Render one animation frame, fitting the view and applying the idle spin,
     * and schedule the next.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const tick = () => {
      if (disposed) return
      frame = requestAnimationFrame(tick)
      fitView()
      mesh.rotation.y += spin
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      container.removeEventListener("pointerdown", onPointerDown)
      container.removeEventListener("pointermove", onPointerMove)
      container.removeEventListener("pointerup", onPointerUp)
      container.removeEventListener("pointercancel", onPointerUp)
      container.removeEventListener("wheel", onWheel)
      mesh.geometry.dispose()
      for (const material of materials) {
        material.map?.dispose()
        material.dispose()
      }
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [title, imdbRank, format, metadata, imageLogos])

  useEffect(() => {
    // TODO: Validate
    /**
     * Close the viewer when Escape is pressed while the information dialog is
     * not open.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape" && !showingInformation) onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, showingInformation])

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-20 flex select-none flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div
        ref={stageRef}
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/80 hover:text-white"
      >
        <X className="size-4" />
        Back to the shelves
      </button>

      <div className="flex w-full flex-col items-center gap-4 px-4 lg:flex-row">
        <div
          ref={containerRef}
          className={`w-full cursor-grab touch-none active:cursor-grabbing ${
            trailers.length > 0
              ? "h-[35vh] lg:h-[70vh] lg:min-w-0 lg:flex-1"
              : "h-[70vh]"
          }`}
        />
        {trailers.length > 0 && (
          <TrailerPlayer
            key={title.id}
            trailers={trailers}
            autoplay={autoplayTrailers}
            className="flex w-[min(100%,calc(55vh*16/9))] flex-col gap-2 lg:w-[min(72%,calc(78vh*16/9))] lg:shrink-0"
            frameClassName="aspect-video w-full rounded-lg bg-black"
          />
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-2 pb-6 text-center">
        <div className="text-lg font-semibold text-white">{title.name}</div>
        <div className="text-xs text-white/50">
          Drag to spin · Scroll or pinch to zoom · Esc to close
        </div>
        <div className="mt-1 flex max-w-full items-center gap-2 overflow-x-auto px-4">
          {atCounter ? (
            <button
              type="button"
              onClick={onRemoveFromCounter}
              className="shrink-0 whitespace-nowrap rounded-full border border-rose-300/40 px-5 py-2 text-sm font-medium text-rose-200 hover:bg-rose-300/10"
            >
              Remove from the counter
            </button>
          ) : (
            <button
              type="button"
              onClick={onTakeToCounter}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-emerald-300/40 px-5 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-300/10"
            >
              <ShoppingCart className="size-4" />
              Take it to the counter
            </button>
          )}
          {links.map((link) => (
            <a
              key={`${link.source_name}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/25 px-5 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
            >
              {link.favicon_url && (
                <img
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  src={link.favicon_url}
                  alt={link.source_name}
                  className="size-4 shrink-0 select-none"
                />
              )}
              {link.source_name}
            </a>
          ))}
          {imdbId && (
            <a
              href={`https://www.imdb.com/title/${imdbId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/25 px-5 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
            >
              <img
                loading="lazy"
                src={imdbIconUrl}
                alt="IMDb"
                className="size-4 shrink-0 select-none"
              />
              IMDb
            </a>
          )}
          {sources.length > 0 && storeBackend().renderTitleInformation && (
            <button
              type="button"
              onClick={() => setShowingInformation(true)}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/25 px-5 py-2 text-sm font-medium text-white/85 hover:bg-white/10"
            >
              <Info className="size-4" />
              More information
            </button>
          )}
        </div>
      </div>

      {storeBackend().renderTitleInformation?.({
        open: showingInformation,
        onOpenChange: setShowingInformation,
        sources,
      })}
    </div>
  )
}
