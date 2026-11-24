// TODO: Validate
import * as THREE from "three"
import { CarGenerator } from "three/addons/generators/city/CarGenerator.js"
import { SidewalkGenerator } from "three/addons/generators/city/SidewalkGenerator.js"
import { StreetlightGenerator } from "three/addons/generators/city/StreetlightGenerator.js"
import { StreetTreeGenerator } from "three/addons/generators/city/StreetTreeGenerator.js"
import { ForestGenerator } from "three/addons/generators/ForestGenerator.js"
import { TerrainGenerator } from "three/addons/generators/TerrainGenerator.js"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import Stats from "three/addons/libs/stats.module.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { WoodNodeMaterial } from "three/addons/materials/WoodNodeMaterial.js"
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js"
import {
  color,
  float,
  instancedBufferAttribute,
  instanceIndex,
  lights,
  mix,
  mx_noise_float,
  positionLocal,
  texture,
  uniform,
  uv,
  varying,
  vec3,
} from "three/tsl"
import { WebGPURenderer } from "three/webgpu"
import tvRoomFurnitureUrl from "./assets/video-store-furniture.glb?url"
import {
  compareGenres,
  createAisleSignTexture,
  createCarpetTexture,
  createCaseCanvas,
  createCaseTexture,
  createCeilingTexture,
  createDiffuserTexture,
  createFilterBoardTexture,
  createGlowTexture,
  createGrassTexture,
  createLabelTexture,
  createLoaderTexture,
  createLotTexture,
  createStoreSignTexture,
  createTagCanvas,
  genreHue,
  type StoreTitle,
  shelfGenres,
  spineSpan,
} from "./caseTexture"
import { CoverDownloadQueue } from "./coverDownloadQueue"
import { type ParkedCar, ParkingLot } from "./parkingLot"
import { PlayerMovement } from "./playerMovement"
import { Rain } from "./rain"
import { loadStoreImage } from "./storeImage"
import type { StoreMetadata } from "./storeStock"
import { fetchTitleDetail } from "./titleDetail"
import { TvTrailerPlayer } from "./tvTrailerPlayer"

type Slot = { position: THREE.Vector3; facing: THREE.Vector3 }

type ShelfRun = {
  levels: Slot[][]
  order: Slot[]
  fill: Slot[]
  readsAlongFill: boolean
  aisle: number | null
  side: "left" | "right"
  unit: number | null
  endcap: "front" | "back" | null
}

type AisleSign = {
  left: string[]
  right: string[]
  near: THREE.Mesh
  far: THREE.Mesh
  group: THREE.Group
  anchor: THREE.Vector3
  dirty: boolean
}

// TODO: Validate
/**
 * Return a vector with each axis randomly between -0.5 and 0.5, used to tilt
 * and nudge counter cases.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const randomOffset = () =>
  new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5,
  )

// TODO: Validate
/**
 * Return a vector with each axis between -0.5 and 0.5 derived from a hash of
 * the seed, so a title's case always gets the same tilt and nudge.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const seededOffset = (seed: string) => {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  // TODO: Validate
  /**
   * Return one axis value between -0.5 and 0.5 from ten bits of the hash
   * starting at the given shift.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  const axis = (shift: number) => ((hash >>> shift) & 1023) / 1023 - 0.5
  return new THREE.Vector3(axis(0), axis(10), axis(20))
}

// TODO: Validate
/**
 * Return whether the browser reports a coarse pointer, meaning the store uses
 * touch controls instead of pointer lock.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const isTouchDevice = () =>
  window.matchMedia("(pointer: coarse)").matches

// TODO: Validate
/**
 * Return how many cases fit side by side in one shelf bay, which depends on the
 * case format and width when spines face out in condensed mode.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const baySlots = (
  condensed: boolean,
  format: number,
  widerCases: boolean,
) =>
  condensed
    ? Math.round(
        1.72 /
          ((format === 3
            ? 0.09
            : format === 1 || widerCases
              ? 0.028
              : format === 2
                ? (0.015 * 0.168) / 0.135
                : 0.015) +
            0.0064),
      )
    : 10

// TODO: Validate
/**
 * Return the number of shelf slots the store needs to hold every title in its
 * allowed genres, rounding each genre up to whole columns and adding one spare
 * gondola side.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const shelfSlots = (
  titles: StoreTitle[],
  allowed: Set<string> | null,
  bay: number,
) => {
  const counts = new Map<string, number>()
  for (const title of titles) {
    const genreNames = shelfGenres(title, allowed)
    if (genreNames.length === 0 && title.genres.length > 0) continue
    for (const genre of genreNames.length ? genreNames : ["_Unknown"]) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1)
    }
  }
  const shelved = [...counts.values()].reduce(
    (total, count) => total + Math.ceil(count / 6) * 6,
    0,
  )
  return (1 + Math.ceil(shelved / (30 * bay))) * 30 * bay
}

export type StoreProgress =
  | { stage: "building" }
  | { stage: "starting" }
  | {
      stage: "compiling"
      compiled: number
      total: number
      groups: Array<{ label: string; compiled: number; total: number }>
    }
  | { stage: "ready" }

export type VideoStoreCallbacks = {
  onFocus: (title: StoreTitle | null) => void
  onActivate: (title: StoreTitle) => void
  onChannelAction: (action: "create" | "add") => void
  onFilters: () => void
  onLockChange: (locked: boolean) => void
  onProgress: (progress: StoreProgress) => void
  onCovers: (pending: number) => void
  onTakeToCounter: (title: StoreTitle) => void
}

// TODO: Validate
/**
 * Return a box geometry for a video case whose UVs map each face onto its
 * region of the shared case texture, including the spine.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const buildCaseGeometry = (width = 0.135, height = 0.19, depth = 0.015) => {
  const geometry = new THREE.BoxGeometry(width, height, depth)
  const span = spineSpan(depth / height)
  const leftEdge = { x: 168 / 256, y: 0.125, w: span / 256, h: 224 / 256 }
  const rightEdge = {
    x: (168 + span) / 256,
    y: 0.125,
    w: (88 - span) / 256,
    h: 224 / 256,
  }
  const top = { x: 0, y: 16 / 256, w: 168 / 256, h: 16 / 256 }
  const bottom = { x: 0, y: 0, w: 168 / 256, h: 16 / 256 }
  const front = { x: 0, y: 0.125, w: 168 / 256, h: 224 / 256 }
  const rects = [rightEdge, leftEdge, top, bottom, front, front]
  const uv = geometry.attributes.uv
  for (let face = 0; face < 6; face++) {
    const rect = rects[face]
    for (let corner = 0; corner < 4; corner++) {
      const index = face * 4 + corner
      uv.setXY(
        index,
        rect.x + uv.getX(index) * rect.w,
        rect.y + uv.getY(index) * rect.h,
      )
    }
  }
  uv.needsUpdate = true
  return geometry
}

// TODO: Validate
/**
 * Return a run's slots ordered column by column from bottom shelf to top,
 * starting from the near or far end.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const buildRunOrder = (rows: Slot[][], fromFar = false) => {
  const order: Slot[] = []
  const columns = rows[0].length
  for (let step = 0; step < columns; step++) {
    const column = fromFar ? step : columns - 1 - step
    for (let row = rows.length - 1; row >= 0; row--) {
      order.push(rows[row][column])
    }
  }
  return order
}

// TODO: Validate
/**
 * Three.js scene of a walkable video rental store that shelves a channel's
 * titles as cases by genre, with its outdoor lot, lighting, and controls.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export class VideoStore {
  private container: HTMLElement
  private callbacks: VideoStoreCallbacks
  private renderer: WebGPURenderer
  private parkingLot: ParkingLot | null = null
  private sidewalk: SidewalkGenerator | null = null
  private dressed = new WeakSet<THREE.Material>()
  private moonLight = new THREE.DirectionalLight(0xaebede, 0.55)
  private skyLight = new THREE.HemisphereLight(0x33425f, 0x05060a, 0.5)
  private indoorLight = new THREE.AmbientLight(0xfff1e0, 0.45)
  private poolMaterial: THREE.MeshBasicMaterial | null = null
  private trees: StreetTreeGenerator | null = null
  private forest: ForestGenerator | null = null
  private terrain: TerrainGenerator | null = null
  private rain: Rain | null = null
  private lamps: StreetlightGenerator | null = null
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: PointerLockControls
  private clock = new THREE.Clock()
  private raycaster = new THREE.Raycaster()
  private colliders: THREE.Box3[] = []
  private focused: THREE.Mesh | null = null
  private storeWidth = 0
  private storeDepth = 0
  private genreStarts: Array<{ genre: string; slot: Slot; run: number }> = []
  private animationHandle = 0
  private disposed = false
  private storeSigns: THREE.Mesh[] = []
  private runs: ShelfRun[] = []
  private aisleSigns: AisleSign[] = []
  private packOrder: number[] = []
  private posters: THREE.Mesh[] = []
  private counterTop = new THREE.Vector3()
  private counterRows: THREE.Vector3[] = []
  private counterStep = 0
  private bay = 10
  private slotWidth = 0.172
  private counterCapacity = 0
  private counterCases: THREE.Mesh[] = []
  private counterTitles: StoreTitle[] = []
  private couchCaseTitle: StoreTitle | null = null
  private couchCaseSlot: Slot | null = null
  private couchCaseTurn = 0
  private tvTitleSign: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  > | null = null
  private channelButtons: THREE.Mesh[] = []
  private tvTrailerPlayer = new TvTrailerPlayer((title) =>
    this.showCouchCase(title),
  )
  private doorLeaves: Array<{
    group: THREE.Group
    swing: number
    open: boolean
    collider: THREE.Box3
  }> = []
  private filterBoard: THREE.Mesh | null = null
  private swatches: THREE.Mesh[] = []
  private caseMaterials = new Set<
    THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  >()
  private unlit = false
  private reflections = true
  private format = 0
  private caseScale = 1
  private askew = 0.5
  private condensed = false
  private pullOut = 0.04
  private condensedPullOut = 0.15
  private spineRatio = 0.015 / 0.19
  private widerCases = true
  private unlitBrightness = uniform(0.5)
  private lightLevel = 1
  private fullPosters = false
  private lampPool: THREE.PointLight[] = []
  private lampAnchors: THREE.Vector3[] = []
  private glowMaterial: THREE.MeshBasicMaterial | null = null
  private diffuserMaterial: THREE.MeshBasicMaterial | null = null
  private ceilingMaterial: THREE.MeshStandardMaterial | null = null
  private floorMaterial: THREE.MeshStandardMaterial | null = null
  private carpetRepeat = new THREE.Vector2(20, 20)
  private roomMaterials: THREE.MeshStandardMaterial[] = []
  private woodMaterial: WoodNodeMaterial | null = null
  private woodFallback: THREE.MeshStandardMaterial | null = null
  private tvRoomWoodMaterial: WoodNodeMaterial | null = null
  private tvRoomWoodFallback: THREE.MeshStandardMaterial | null = null
  private tvRoomFloorMaterial: THREE.MeshStandardMaterial | null = null
  private tvRoomCarpetRepeat = new THREE.Vector2()
  private tvRoomLamps: THREE.PointLight[] = []
  private couchSeatedPosition = new THREE.Vector3()
  private couchStandingPosition = new THREE.Vector3()
  private couchLookTarget = new THREE.Vector3()
  private runMeshes: THREE.Mesh[][] = []
  private loaderButtons: THREE.Mesh[] = []
  private revealedRuns = new Set<number>()
  private autoLoadImages = false
  private imageLogos = true
  private counterCoverButtons: THREE.Mesh[] = []
  private runBoxes: THREE.Box3[] = []
  private viewFrustum = new THREE.Frustum()
  private viewProjection = new THREE.Matrix4()
  private allTitles: StoreTitle[] = []
  private genreTitles = new Map<string, StoreTitle[]>()
  private runTitles: StoreTitle[][] = []
  private runSlots: number[][] = []
  private caseGroups: THREE.Group[] = []
  private casePool: THREE.Mesh[] = []
  private mountedRuns = new Set<number>()
  private generationCounter = 0
  private tagGeometry = new THREE.PlaneGeometry(0.155, 0.042)
  private tagArray: THREE.DataArrayTexture | null = null
  private tagBatch: THREE.InstancedMesh | null = null
  private headerGeometry = new THREE.PlaneGeometry(1.2, 0.3)
  private headerBatch: THREE.InstancedMesh | null = null
  private stripBatch: THREE.InstancedMesh | null = null
  private runDecor: Array<
    Array<{ mesh: THREE.InstancedMesh; slot: number; placement: THREE.Matrix4 }>
  > = []
  private decoratedRuns = new Set<number>()
  private loadButtons: THREE.InstancedMesh | null = null
  private unloadButtons: THREE.InstancedMesh | null = null
  private dirtyCovers = new Set<THREE.DataArrayTexture>()
  private coversFlushedAt = 0
  private placeholderMaterials = new Map<number, THREE.MeshStandardMaterial>()
  private instanced: THREE.InstancedMesh[] = []
  private shelves: THREE.InstancedMesh[] = []
  private runCenters: THREE.Vector3[] = []
  private visibleRuns = new Set<number>()
  private runsKeptMounted = new Set<number>()
  private mountQueue = new Set<number>()
  private batchPool = new Map<number, THREE.InstancedMesh[]>()
  private white = new THREE.Color(0xffffff)
  private visibleSigns = new Set<number>()
  private renderRange = 25
  private loadedRuns = 25
  private scratch = new THREE.Vector3()
  private toCamera = new THREE.Vector3()
  private coverSphere = new THREE.Sphere()
  private lastFocusAt = new THREE.Vector3(Number.NaN, 0, 0)
  private lastFocusTurn = new THREE.Quaternion()
  private lodCountdown = 0
  private highlightMaterial = this.trackCase(
    new THREE.MeshStandardMaterial({
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      roughness: 0.42,
      metalness: 0.06,
    }),
  )
  private batchMaterial = this.trackCase(
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.04 }),
  )
  private runBatches = new Map<
    number,
    Array<{
      mesh: THREE.InstancedMesh
      covers: THREE.DataArrayTexture | null
      members: THREE.Mesh[]
    }>
  >()
  private hiddenInstance = new THREE.Matrix4().makeScale(0, 0, 0)
  private loadCoversMaterial = new THREE.MeshBasicMaterial({
    map: createLoaderTexture("LOAD COVERS"),
  })
  private unloadCoversMaterial = new THREE.MeshBasicMaterial({
    map: createLoaderTexture("UNLOAD COVERS"),
  })
  private stripGeometry = new THREE.BoxGeometry(0.014, 0.018, 1)
  private placedTitles = 0
  private restocked = false
  private shelfFilter: Set<string> | null = null
  private paused = false
  private heldPosition = new THREE.Vector3()
  private heldView = new THREE.Quaternion()
  private viewHeldUntil = 0
  private touchActive = false
  private lastExit = 0
  private euler = new THREE.Euler(0, 0, 0, "YXZ")
  readonly touch = isTouchDevice()
  private caseGeometry = buildCaseGeometry()
  private resizeObserver: ResizeObserver
  private coverDownloadQueue: CoverDownloadQueue
  private playerMovement: PlayerMovement
  private metadata: StoreMetadata = "tmdb"
  private stats = new Stats()
  private drawCallPanel = new Stats.Panel("CALLS", "#ff8", "#221")
  private statsPanel = document.createElement("div")
  private distancePanel = document.createElement("div")
  private drawCallsShownAt = 0
  private drawCallPeak = 0

  // TODO: Validate
  /**
   * Create the renderer, camera, controls, and stats panels in the container,
   * build the store, and start compiling its shaders.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  constructor(
    container: HTMLElement,
    slotCount: number,
    bay: number,
    storeName: string,
    callbacks: VideoStoreCallbacks,
  ) {
    this.container = container
    this.callbacks = callbacks
    this.bay = bay
    this.slotWidth = 1.72 / bay

    this.renderer = new WebGPURenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.sortObjects = false
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1
    this.renderer.info.autoReset = false
    this.tvTrailerPlayer.mount(container)
    this.renderer.domElement.style.position = "relative"
    container.appendChild(this.renderer.domElement)
    this.statsPanel.style.cssText =
      "position:absolute;right:0;top:50%;transform:translateY(-50%);display:none;gap:2px;opacity:0.9;z-index:10"
    this.stats.dom.style.cssText = "cursor:pointer"
    this.distancePanel.style.cssText =
      "min-width:80px;height:48px;padding:0 8px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;white-space:nowrap;background:#022;color:#0ff;font:bold 12px Helvetica,Arial,sans-serif"
    this.statsPanel.append(
      this.distancePanel,
      this.drawCallPanel.dom,
      this.stats.dom,
    )
    container.appendChild(this.statsPanel)

    this.scene.background = new THREE.Color(0x07070b)

    this.camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / container.clientHeight,
      0.05,
      420,
    )
    this.controls = new PointerLockControls(this.camera, container)
    this.scene.add(this.camera)
    this.coverDownloadQueue = new CoverDownloadQueue(
      this.camera,
      (mesh) => this.coverWanted(mesh),
      (pending) => this.callbacks.onCovers(pending),
    )
    this.playerMovement = new PlayerMovement(
      this.camera,
      this.touch,
      this.colliders,
      this.doorLeaves,
      this.couchStandingPosition,
    )

    this.buildStore(slotCount, storeName)

    this.controls.addEventListener("lock", this.handleLock)
    this.controls.addEventListener("unlock", this.handleUnlock)
    window.addEventListener("keydown", this.handleKeyDown)
    window.addEventListener("keyup", this.handleKeyUp)
    window.addEventListener("mousedown", this.handleMouseDown)
    window.addEventListener(
      "message",
      this.tvTrailerPlayer.handleTvVideoMessage,
    )
    this.resizeObserver = new ResizeObserver(this.handleResize)
    this.resizeObserver.observe(container)

    this.callbacks.onProgress({ stage: "starting" })
    void this.start()
  }

  // TODO: Validate
  /**
   * Initialize the renderer, swap in a plain wood material on WebGL, and
   * compile every object near the spawn point nearest first while reporting
   * progress by category.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private async start() {
    await this.renderer.init()
    if (this.disposed) return
    const webgl = (this.renderer.backend as { isWebGLBackend?: boolean })
      .isWebGLBackend
    if (webgl && this.woodMaterial) {
      const wood = this.woodMaterial
      const fallback = new THREE.MeshStandardMaterial({
        color: wood.lightGrainColor.clone(),
        roughness: 0.8,
        metalness: 0,
      })
      this.woodFallback = fallback
      this.scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.material === wood) mesh.material = fallback
      })
    }
    if (webgl && this.tvRoomWoodMaterial) {
      const tvRoomWood = this.tvRoomWoodMaterial
      const tvRoomWoodFallback = new THREE.MeshStandardMaterial({
        color: tvRoomWood.lightGrainColor.clone(),
        roughness: 0.8,
        metalness: 0,
      })
      tvRoomWoodFallback.lightsNode = tvRoomWood.lightsNode
      this.tvRoomWoodFallback = tvRoomWoodFallback
      this.scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.material === tvRoomWood) mesh.material = tvRoomWoodFallback
      })
    }
    if (this.tagArray) this.uploadTexture(this.tagArray)
    for (const sign of this.aisleSigns) {
      if (sign.dirty) continue
      for (const face of [sign.near, sign.far]) {
        const map = (face.material as THREE.MeshBasicMaterial).map
        if (map) this.uploadTexture(map)
      }
    }
    for (const group of this.caseGroups) {
      group.traverse((object) => {
        object.userData.category ??= "Cases"
      })
    }
    this.parkingLot?.labelFleetsAsCars()
    for (const batch of [this.tagBatch, this.headerBatch, this.stripBatch]) {
      if (batch) batch.userData.category ??= "Genre tags"
    }
    const warmLayer = 30
    const warmCamera = this.camera.clone()
    warmCamera.layers.set(warmLayer)
    const pending: Array<[THREE.Object3D, number]> = []
    const spawn = this.camera.position.clone()
    this.scene.traverse((object) => {
      if ((object as THREE.Light).isLight) object.layers.enable(warmLayer)
      if (!(object as THREE.Mesh).material) return
      if (!object.visible || object.layers.mask === 0) return
      let hidden = false
      object.traverseAncestors((ancestor) => {
        if (!ancestor.visible) hidden = true
      })
      if (hidden) return
      const away = new THREE.Box3().setFromObject(object).distanceToPoint(spawn)
      if (away > this.renderRange) return
      pending.push([object, object.layers.mask])
      object.layers.disableAll()
    })
    // TODO: Validate
    /**
     * Return the squared distance from an object's world position to the spawn
     * point.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const distance = (object: THREE.Object3D) =>
      object.getWorldPosition(new THREE.Vector3()).distanceToSquared(spawn)
    pending.sort(([left], [right]) => distance(left) - distance(right))
    const groups = new Map<
      string,
      { label: string; compiled: number; total: number }
    >()
    for (const [object] of pending) {
      const label = (object.userData.category as string | undefined) ?? "Other"
      const group = groups.get(label) ?? { label, compiled: 0, total: 0 }
      group.total++
      groups.set(label, group)
    }
    this.animationHandle = requestAnimationFrame(this.tick)
    for (const [index, [object, mask]] of pending.entries()) {
      if (this.disposed) return
      this.callbacks.onProgress({
        stage: "compiling",
        compiled: index,
        total: pending.length,
        groups: [...groups.values()].map((group) => ({ ...group })),
      })
      const culled = object.frustumCulled
      object.layers.set(warmLayer)
      object.frustumCulled = false
      await this.renderer.compileAsync(object, warmCamera, this.scene)
      object.frustumCulled = culled
      object.layers.mask = mask
      const label = (object.userData.category as string | undefined) ?? "Other"
      const group = groups.get(label)
      if (group) group.compiled++
    }
    if (this.disposed) return
    this.callbacks.onProgress({ stage: "ready" })
  }

  // TODO: Validate
  /**
   * Repaint the storefront signs with a new store name.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setStoreName(storeName: string) {
    for (const sign of this.storeSigns) {
      const material = sign.material as THREE.MeshBasicMaterial
      material.map?.dispose()
      material.map = createStoreSignTexture(storeName)
      material.needsUpdate = true
    }
  }

  // TODO: Validate
  /**
   * Build the store sized to the slot count: room, doors and windows, rain, the
   * outdoor lot with cars and terrain, ceiling lights, shelving runs, wall
   * posters, the counter, aisle signs, and the cover loader buttons.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private buildStore(slotCount: number, storeName: string) {
    const levels = [0.29, 0.58, 0.87, 1.16, 1.45, 1.74]
    const slotWidth = this.slotWidth
    const perLevel = this.bay * 5
    const gondolaLength = perLevel * slotWidth
    const sides = Math.max(2, Math.ceil(slotCount / (levels.length * perLevel)))
    const unitCount = Math.min(400, Math.max(2, Math.ceil(sides / 2)))
    const width = unitCount * 2.33 + 2.9
    const depth = gondolaLength + 6
    this.storeWidth = width
    this.storeDepth = depth
    this.camera.position.set(-width / 2 + 1.8, 1.65, depth / 2 - 1.05)
    this.camera.lookAt(width / 2 - 1.2, 1.3, -depth / 2 + 1.2)

    this.carpetRepeat.set(width / 1.5, depth / 1.5)
    this.floorMaterial = new THREE.MeshStandardMaterial({
      map: createCarpetTexture(),
      color: 0xbababa,
      roughness: 1,
      metalness: 0,
    })
    this.floorMaterial.map?.repeat.copy(this.carpetRepeat)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      this.floorMaterial,
    )
    floor.rotation.x = -Math.PI / 2
    this.scene.add(floor)

    const columns = Math.max(1, Math.round(width / 0.61))
    const rows = Math.max(1, Math.round(depth / 1.22))
    const tileX = width / columns
    const tileZ = depth / rows
    const ceilingTexture = createCeilingTexture()
    ceilingTexture.repeat.set(columns, rows)
    this.ceilingMaterial = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      emissiveMap: ceilingTexture,
      color: 0x9a9a9a,
      roughness: 1,
    })
    this.ceilingMaterial.lightsNode = lights([this.skyLight, this.moonLight])
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      this.ceilingMaterial,
    )
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = 3.2
    this.scene.add(ceiling)

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8b13a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    })
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(depth, 3.2),
      wallMaterial,
    )
    rightWall.position.set(width / 2, 1.6, 0)
    rightWall.rotation.y = -Math.PI / 2
    this.scene.add(rightWall)

    const sideCount = Math.max(2, Math.floor(depth / 1.45))
    const sideSpacing = depth / sideCount
    const tvRoomCenterZ =
      -depth / 2 +
      sideSpacing *
        (Math.max(0, Math.floor((depth - 4.74) / sideSpacing - 0.5)) + 0.5)
    const tvRoomDoorPoster = sideCount - 1
    const tvRoomDoorZ = -depth / 2 + sideSpacing * (tvRoomDoorPoster + 0.5)
    for (const [minZ, maxZ, bottom] of [
      [-depth / 2, tvRoomDoorZ - 0.5, 0],
      [tvRoomDoorZ + 0.5, depth / 2, 0],
      [tvRoomDoorZ - 0.5, tvRoomDoorZ + 0.5, 2.1],
    ]) {
      const leftWallPiece = new THREE.Mesh(
        new THREE.PlaneGeometry(maxZ - minZ, 3.2 - bottom),
        wallMaterial,
      )
      leftWallPiece.position.set(
        -width / 2,
        (3.2 + bottom) / 2,
        (minZ + maxZ) / 2,
      )
      leftWallPiece.rotation.y = Math.PI / 2
      this.scene.add(leftWallPiece)
    }

    this.moonLight.position.set(-70, 90, depth / 2 + 120)
    this.moonLight.target.position.set(0, 0, depth / 2 + 30)
    this.scene.add(this.moonLight)
    this.scene.add(this.moonLight.target)
    this.scene.add(this.skyLight)
    this.scene.add(this.indoorLight)

    const bays = Math.max(4, Math.round(width / 1.3))
    const bayWidth = width / bays
    const doorBay = Math.min(
      bays - 2,
      Math.max(0, Math.round(6.6 / bayWidth) - 1),
    )
    const doorCenter = -width / 2 + bayWidth * (doorBay + 1)
    const tvRoomBays = Math.max(1, Math.ceil(4.3 / bayWidth))
    const tvRoomDepth = tvRoomBays * bayWidth

    for (const [minX, minZ, maxX, maxZ] of [
      [-width / 2 - 0.2, -depth / 2 - 0.2, width / 2 + 0.2, -depth / 2],
      [-width / 2 - 0.2, -depth / 2, -width / 2, tvRoomDoorZ - 0.5],
      [-width / 2 - 0.2, tvRoomDoorZ + 0.5, -width / 2, depth / 2],
      [width / 2, -depth / 2, width / 2 + 0.2, depth / 2],
      [-width / 2, depth / 2, doorCenter - bayWidth, depth / 2 + 0.2],
      [doorCenter + bayWidth, depth / 2, width / 2, depth / 2 + 0.2],
    ] as const) {
      if (maxX - minX < 0.01) continue
      this.colliders.push(
        new THREE.Box3(
          new THREE.Vector3(minX, 0, minZ),
          new THREE.Vector3(maxX, 3.2, maxZ),
        ),
      )
    }

    const glassMaterial = new THREE.MeshBasicMaterial({
      color: 0x7d98ad,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const doorFrameMaterial = new THREE.MeshBasicMaterial({ color: 0x24262d })

    const backPlacements: THREE.Matrix4[] = []
    const headerPlacements: THREE.Matrix4[] = []
    const headPlacements: THREE.Matrix4[] = []
    const bulkheadPlacements: THREE.Matrix4[] = []
    const glazingPlacements: THREE.Matrix4[] = []
    const sillPlacements: THREE.Matrix4[] = []
    const mullionPlacements: THREE.Matrix4[] = []
    for (let bay = -tvRoomBays; bay < bays; bay++) {
      const x = -width / 2 + bayWidth * (bay + 0.5)
      if (bay >= 0) {
        backPlacements.push(
          new THREE.Matrix4().makeTranslation(x, 1.6, -depth / 2),
        )
      }
      headerPlacements.push(
        new THREE.Matrix4()
          .makeRotationY(Math.PI)
          .setPosition(x, 2.8, depth / 2),
      )
      headPlacements.push(
        new THREE.Matrix4().makeTranslation(x, 2.4, depth / 2 - 0.04),
      )
      if (bay === doorBay || bay === doorBay + 1) continue
      bulkheadPlacements.push(
        new THREE.Matrix4()
          .makeRotationY(Math.PI)
          .setPosition(x, 0.175, depth / 2),
      )
      glazingPlacements.push(
        new THREE.Matrix4().makeTranslation(x, 1.375, depth / 2 - 0.04),
      )
      sillPlacements.push(
        new THREE.Matrix4().makeTranslation(x, 0.36, depth / 2 - 0.04),
      )
    }
    for (let bay = 1 - tvRoomBays; bay < bays; bay++) {
      if (bay >= doorBay && bay <= doorBay + 2) continue
      mullionPlacements.push(
        new THREE.Matrix4().makeTranslation(
          -width / 2 + bayWidth * bay,
          1.375,
          depth / 2 - 0.04,
        ),
      )
    }
    for (const [geometry, material, placements] of [
      [new THREE.PlaneGeometry(bayWidth, 3.2), wallMaterial, backPlacements],
      [new THREE.PlaneGeometry(bayWidth, 0.8), wallMaterial, headerPlacements],
      [
        new THREE.BoxGeometry(bayWidth, 0.1, 0.09),
        doorFrameMaterial,
        headPlacements,
      ],
      [
        new THREE.PlaneGeometry(bayWidth, 0.35),
        wallMaterial,
        bulkheadPlacements,
      ],
      [
        new THREE.PlaneGeometry(bayWidth, 2.05),
        glassMaterial,
        glazingPlacements,
      ],
      [
        new THREE.BoxGeometry(bayWidth, 0.08, 0.09),
        doorFrameMaterial,
        sillPlacements,
      ],
      [
        new THREE.BoxGeometry(0.07, 2.05, 0.09),
        doorFrameMaterial,
        mullionPlacements,
      ],
    ] as const) {
      if (placements.length === 0) continue
      this.buildInstanced(geometry, material, placements)
    }

    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 2.4, 0.1),
        doorFrameMaterial,
      )
      jamb.position.set(doorCenter + side * bayWidth, 1.2, depth / 2 - 0.06)
      this.scene.add(jamb)

      const leaf = new THREE.Group()
      leaf.position.set(doorCenter + side * bayWidth, 1.2, depth / 2 - 0.06)
      this.scene.add(leaf)
      const index = this.doorLeaves.length
      const hinge = doorCenter + side * bayWidth
      this.doorLeaves.push({
        group: leaf,
        swing: (side * Math.PI) / 2,
        open: false,
        collider: new THREE.Box3(
          new THREE.Vector3(Math.min(hinge, doorCenter), 0, depth / 2 - 0.12),
          new THREE.Vector3(Math.max(hinge, doorCenter), 3.2, depth / 2 + 0.2),
        ),
      })

      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(bayWidth * 0.94, 2.4),
        glassMaterial,
      )
      pane.position.set((-side * bayWidth) / 2, 0, 0)
      pane.userData = { toggle: "door", leaf: index }
      leaf.add(pane)
      this.swatches.push(pane)

      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 2.4, 0.1),
        doorFrameMaterial,
      )
      edge.position.set(-side * bayWidth * 0.97, 0, 0)
      edge.userData = { toggle: "door", leaf: index }
      leaf.add(edge)
      this.swatches.push(edge)

      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.62, 0.05),
        doorFrameMaterial,
      )
      handle.position.set(-side * bayWidth * 0.82, -0.15, -0.09)
      handle.userData = { toggle: "door", leaf: index }
      leaf.add(handle)
      this.swatches.push(handle)
    }

    this.labelNew("Room, doors and windows")
    const lotUnits = Math.max(
      1,
      Math.round(width / 19.9),
      Math.ceil((width + 2 * tvRoomDepth) / 19.9),
    )
    const lotWidth = lotUnits * 19.9
    const parked: ParkedCar[] = []
    this.rain = new Rain(
      this.scene,
      Math.max(width, lotWidth),
      depth + 50,
      25,
      width / 2,
      depth / 2,
    )

    this.labelNew("Rain")
    const domeMaterial = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    const skyDirection = positionLocal.normalize()
    const clusters = mx_noise_float(
      skyDirection.mul(3.2).add(vec3(13.7, 5.1, 21.3)),
    )
    const speckle = mx_noise_float(skyDirection.mul(210))
    const starfield = clusters
      .abs()
      .pow(1 / 0.2)
      .abs()
      .add(speckle)
      .abs()
      .pow(1 / 0.042)
      .abs()
      .clamp(0, 1)
    const horizon = skyDirection.y.mul(0.5).add(0.5)
    domeMaterial.colorNode = mix(color(0x22324c), color(0x03040c), horizon).add(
      color(0xeaf1ff).mul(starfield),
    )
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(360, 64, 40),
      domeMaterial,
    )
    dome.position.set(0, -12, depth / 2 + 20)
    dome.renderOrder = -1
    this.scene.add(dome)

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(lotWidth + 60, 84),
      new THREE.MeshBasicMaterial({ color: 0x101016, fog: false }),
    )
    apron.position.set(0, -0.12, depth / 2 + 42)
    apron.rotation.x = -Math.PI / 2
    this.scene.add(apron)

    this.sidewalk = new SidewalkGenerator({
      width: Math.max(width, lotWidth),
      depth: 2.3,
      height: 0.15,
      radius: 0.6,
    })
    const walk = this.sidewalk.build([
      new THREE.Matrix4().makeTranslation(0, -0.12, depth / 2 + 1.15),
    ])
    this.dressOutdoors(walk)
    this.scene.add(walk)

    const nearBays = createLotTexture(false)
    nearBays.repeat.set(lotWidth / 2.6, 1)
    const nearLot = new THREE.Mesh(
      new THREE.PlaneGeometry(lotWidth, 5.2),
      new THREE.MeshBasicMaterial({ map: nearBays, fog: false }),
    )
    nearLot.position.set(0, -0.1, depth / 2 + 4.9)
    nearLot.rotation.x = -Math.PI / 2
    this.scene.add(nearLot)

    for (let spot = 0; spot < Math.floor(lotWidth / 2.6); spot++) {
      if (Math.random() < 0.5) continue
      parked.push({
        x: -lotWidth / 2 + 2.6 * (spot + 0.5),
        z: depth / 2 + 4.9,
        turn: Math.random() < 0.7 ? Math.PI : 0,
        spin: randomOffset(),
        drift: randomOffset(),
        lit: Math.random() < 0.1,
        color:
          Math.random() < 0.15
            ? CarGenerator.taxiColor
            : [0x9aa3ad, 0x2f3a4a, 0x7d2b2b, 0xd7d9dc, 0x1d2126, 0x35543f][
                Math.floor(Math.random() * 6)
              ],
      })
    }

    const farBays = createLotTexture(true)
    farBays.repeat.set(1, 13)
    const farBayMaterial = new THREE.MeshBasicMaterial({
      map: farBays,
      fog: false,
    })
    const farBayGeometry = new THREE.PlaneGeometry(5.2, 34)
    const grassTexture = createGrassTexture()
    grassTexture.repeat.set(1.5, 17)
    const grassMaterial = new THREE.MeshBasicMaterial({
      map: grassTexture,
      fog: false,
    })
    const islandGeometry = new THREE.PlaneGeometry(3, 34)
    const islandXs: number[] = []
    let cursor = -lotWidth / 2
    const bayPlacements: THREE.Matrix4[] = []
    const grassPlacements: THREE.Matrix4[] = []
    for (let unit = 0; unit < lotUnits; unit++) {
      for (const [kind, span] of [
        ["bay", 5.2],
        ["aisle", 6.5],
        ["bay", 5.2],
        ["grass", 3],
      ] as const) {
        const x = cursor + span / 2
        cursor += span
        if (kind === "aisle") continue
        ;(kind === "bay" ? bayPlacements : grassPlacements).push(
          new THREE.Matrix4()
            .makeRotationX(-Math.PI / 2)
            .setPosition(x, kind === "bay" ? -0.1 : -0.06, depth / 2 + 31),
        )
        if (kind === "grass") islandXs.push(x)
        if (kind !== "bay") continue
        for (let stall = 0; stall < 12; stall++) {
          if (Math.random() < 0.55) continue
          parked.push({
            x,
            z: depth / 2 + 15.3 + stall * 2.6,
            turn: (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2),
            spin: randomOffset(),
            drift: randomOffset(),
            lit: Math.random() < 0.1,
            color:
              Math.random() < 0.12
                ? CarGenerator.taxiColor
                : [0x9aa3ad, 0x2f3a4a, 0x7d2b2b, 0xd7d9dc, 0x1d2126, 0x35543f][
                    Math.floor(Math.random() * 6)
                  ],
          })
        }
      }
    }

    for (const [geometry, material, placements] of [
      [farBayGeometry, farBayMaterial, bayPlacements],
      [islandGeometry, grassMaterial, grassPlacements],
    ] as const) {
      this.buildInstanced(geometry, material, placements)
    }

    this.poolMaterial = new THREE.MeshBasicMaterial({
      map: createGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.25,
      fog: false,
    })
    const poolMaterial = this.poolMaterial
    const treePlacements: THREE.Matrix4[] = []
    const lampPlacements: THREE.Matrix4[] = []
    for (const islandX of islandXs) {
      for (let spot = 0; spot < 9; spot++) {
        const z = depth / 2 + 16 + spot * 3.75
        if (spot % 2 === 0) {
          treePlacements.push(
            new THREE.Matrix4()
              .makeRotationY(Math.random() * Math.PI * 2)
              .setPosition(islandX, -0.06, z),
          )
        } else {
          for (const turn of [Math.PI / 2, -Math.PI / 2]) {
            lampPlacements.push(
              new THREE.Matrix4()
                .makeRotationY(turn)
                .setPosition(islandX, -0.06, z),
            )
          }
        }
      }
    }

    this.parkingLot = new ParkingLot(
      this.scene,
      this.camera,
      parked,
      this.askew,
      (group) => this.dressOutdoors(group),
    )

    this.terrain = new TerrainGenerator({
      seed: Math.floor(Math.random() * 1000),
      size: 900,
      segments: 256,
      heightScale: 34,
      frequency: 0.004,
      talusPasses: 8,
    })
    const ground = this.terrain.build()
    this.levelTerrain(
      this.terrain,
      lotWidth / 2 + 42,
      -depth / 2 - 30,
      depth / 2 + 95,
      90,
    )
    ground.position.y = -0.2
    this.dressOutdoors(ground)
    this.scene.add(ground)

    this.forest = new ForestGenerator({
      seed: Math.floor(Math.random() * 1000),
      count: 42000,
      altitudeMin: 0.02,
      altitudeMax: 1,
      minSlope: 0,
      densityFrequency: 0.02,
      from: 190,
      to: 380,
    })
    const woodland = this.forest.build(this.terrain)
    woodland.position.y = -0.2
    this.dressOutdoors(woodland)
    this.scene.add(woodland)

    this.trees = new StreetTreeGenerator()
    const grove = this.trees.build(treePlacements)
    this.dressOutdoors(grove)
    this.scene.add(grove)

    this.lamps = new StreetlightGenerator({ height: 5.6, reach: 1.8 })
    const posts = this.lamps.build(lampPlacements)
    this.dressOutdoors(posts)
    this.scene.add(posts)

    const poolGeometry = new THREE.CircleGeometry(2.6, 24)
    const lampHead = new THREE.Vector3(
      0,
      this.lamps.parameters.height,
      this.lamps.parameters.reach,
    )
    const poolPlacements = lampPlacements.map((placement) => {
      const lamp = lampHead.clone().applyMatrix4(placement)
      return new THREE.Matrix4()
        .makeRotationX(-Math.PI / 2)
        .setPosition(lamp.x, -0.08, lamp.z)
    })
    this.buildInstanced(poolGeometry, poolMaterial, poolPlacements)

    this.labelNew("Outdoors")
    const housingMaterial = new THREE.MeshStandardMaterial({
      color: 0x3c3f47,
      roughness: 0.55,
      metalness: 0.35,
    })
    this.diffuserMaterial = new THREE.MeshBasicMaterial({
      map: createDiffuserTexture(),
      toneMapped: false,
    })
    const diffuserMaterial = this.diffuserMaterial
    this.glowMaterial = new THREE.MeshBasicMaterial({
      map: createGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    })
    const glowMaterial = this.glowMaterial
    const housingGeometry = new THREE.BoxGeometry(
      tileX * 0.98,
      0.012,
      tileZ * 0.98,
    )
    const diffuserGeometry = new THREE.PlaneGeometry(tileX * 0.88, tileZ * 0.92)
    const glowGeometry = new THREE.PlaneGeometry(3.6, 3.6)
    const housingPlacements: THREE.Matrix4[] = []
    const diffuserPlacements: THREE.Matrix4[] = []
    const glowPlacements: THREE.Matrix4[] = []
    for (let column = 1; column < columns; column += 3) {
      const x = -width / 2 + (column + 0.5) * tileX
      for (let row = 1; row < rows; row += 2) {
        const z = -depth / 2 + (row + 0.5) * tileZ
        housingPlacements.push(new THREE.Matrix4().makeTranslation(x, 3.194, z))
        diffuserPlacements.push(
          new THREE.Matrix4()
            .makeRotationX(Math.PI / 2)
            .setPosition(x, 3.187, z),
        )

        glowPlacements.push(
          new THREE.Matrix4()
            .makeRotationX(-Math.PI / 2)
            .setPosition(x, 0.02, z),
        )
      }
    }
    const lampRows = Math.max(1, Math.round(depth / 3.6))
    for (let aisle = 0; aisle <= unitCount; aisle++) {
      for (let row = 0; row < lampRows; row++) {
        this.lampAnchors.push(
          new THREE.Vector3(
            (aisle - unitCount / 2) * 2.33,
            2.85,
            -depth / 2 + (depth / lampRows) * (row + 0.5),
          ),
        )
      }
    }
    this.buildInstanced(housingGeometry, housingMaterial, housingPlacements)
    this.buildInstanced(diffuserGeometry, diffuserMaterial, diffuserPlacements)
    this.buildInstanced(glowGeometry, glowMaterial, glowPlacements)

    this.labelNew("Ceiling lights")
    const woodMaterial = WoodNodeMaterial.fromPreset("maple", "matte")
    woodMaterial.transformationMatrix.makeScale(4, 4, 4)
    this.woodMaterial = woodMaterial
    const runs: ShelfRun[] = []
    const spinePlacements: THREE.Matrix4[] = []
    const basePlacements: THREE.Matrix4[] = []
    const boardPlacements: THREE.Matrix4[] = []
    const dividerPlacements: THREE.Matrix4[] = []
    const endPanelPlacements: THREE.Matrix4[] = []
    const endBasePlacements: THREE.Matrix4[] = []
    const endBoardPlacements: THREE.Matrix4[] = []

    for (let unit = 0; unit < unitCount; unit++) {
      const x = (unit - (unitCount - 1) / 2) * 2.33
      const zStart = -0.5 - gondolaLength / 2

      spinePlacements.push(new THREE.Matrix4().makeTranslation(x, 1.025, -0.5))
      basePlacements.push(new THREE.Matrix4().makeTranslation(x, 0.11, -0.5))

      const margin = (gondolaLength - perLevel * slotWidth) / 2
      for (let divider = this.bay; divider < perLevel; divider += this.bay) {
        dividerPlacements.push(
          new THREE.Matrix4().makeTranslation(
            x,
            1.155,
            zStart + margin + slotWidth * divider,
          ),
        )
      }
      for (const side of [-1, 1]) {
        const rows: Slot[][] = []
        for (const level of levels) {
          boardPlacements.push(
            new THREE.Matrix4().makeTranslation(
              x + side * 0.2325,
              level - 0.015,
              -0.5,
            ),
          )

          const row: Slot[] = []
          for (let index = 0; index < perLevel; index++) {
            row.push({
              position: new THREE.Vector3(
                x + side * 0.2446,
                level + 0.092,
                zStart + margin + slotWidth * (index + 0.5),
              ),
              facing: new THREE.Vector3(side, 0, 0),
            })
          }
          rows.push(row)
        }
        runs.push({
          levels: rows,
          order: buildRunOrder(rows),
          fill: buildRunOrder(rows),
          readsAlongFill: side > 0,
          aisle: side < 0 ? unit : unit + 1,
          side: side < 0 ? "right" : "left",
          unit,
          endcap: null,
        })
      }

      for (const end of [1, -1]) {
        const panel = -0.5 + end * (gondolaLength / 2 + 0.04)
        endPanelPlacements.push(
          new THREE.Matrix4().makeTranslation(x, 1.025, panel),
        )
        endBasePlacements.push(
          new THREE.Matrix4().makeTranslation(x, 0.11, panel + end * 0.08),
        )
        const rows: Slot[][] = []
        for (const level of levels) {
          endBoardPlacements.push(
            new THREE.Matrix4().makeTranslation(
              x,
              level - 0.015,
              panel + end * 0.0675,
            ),
          )
          const row: Slot[] = []
          const endcapCount = Math.round(this.bay * 0.3)
          for (let index = 0; index < endcapCount; index++) {
            row.push({
              position: new THREE.Vector3(
                x + (index - (endcapCount - 1) / 2) * slotWidth * end,
                level + 0.092,
                panel + end * 0.0796,
              ),
              facing: new THREE.Vector3(0, 0, end),
            })
          }
          rows.push(row)
        }
        runs.push({
          levels: rows,
          order: buildRunOrder(rows),
          fill: buildRunOrder(rows),
          readsAlongFill: true,
          aisle: null,
          side: "left",
          unit,
          endcap: end > 0 ? "front" : "back",
        })
        this.colliders.push(
          new THREE.Box3(
            new THREE.Vector3(
              x - 0.3,
              0,
              Math.min(panel - end * 0.04, panel + end * 0.3),
            ),
            new THREE.Vector3(
              x + 0.3,
              2.1,
              Math.max(panel - end * 0.04, panel + end * 0.3),
            ),
          ),
        )
      }

      this.colliders.push(
        new THREE.Box3(
          new THREE.Vector3(x - 0.385, 0, zStart - 0.1),
          new THREE.Vector3(x + 0.385, 2.1, zStart + gondolaLength + 0.1),
        ),
      )
    }

    this.shelves.push(
      this.buildInstanced(
        new THREE.BoxGeometry(0.33, 2.05, gondolaLength),
        woodMaterial,
        spinePlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.6, 0.22, gondolaLength),
        woodMaterial,
        basePlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.135, 0.03, gondolaLength),
        woodMaterial,
        boardPlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.62, 1.75, 0.012),
        woodMaterial,
        dividerPlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.6, 2.05, 0.08),
        woodMaterial,
        endPanelPlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.6, 0.22, 0.2),
        woodMaterial,
        endBasePlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.6, 0.03, 0.135),
        woodMaterial,
        endBoardPlacements,
      ),
    )

    this.labelNew("Shelving")
    // TODO: Validate
    /**
     * Add a blank wall poster sized to the spacing at the given position and
     * rotation, ready for a title's art to be painted on later.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const hangPoster = (
      along: number,
      spacing: number,
      place: (offset: number, size: number) => THREE.Vector3,
      turn: number,
    ) => {
      const size = Math.min(1.2, spacing - 0.14)
      const poster = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size * 1.5),
        new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: 0.6 }),
      )
      poster.position.copy(place(along, size))
      poster.rotation.y = turn
      poster.matrixAutoUpdate = false
      poster.updateMatrix()
      this.scene.add(poster)
      this.posters.push(poster)
    }

    const backCount = Math.max(3, Math.floor(width / 1.45))
    const backSpacing = width / backCount
    for (let index = 0; index < backCount; index++) {
      hangPoster(
        index,
        backSpacing,
        (offset) =>
          new THREE.Vector3(
            -width / 2 + backSpacing * (offset + 0.5),
            1.75,
            -depth / 2 + 0.07,
          ),
        0,
      )
    }

    for (let index = 0; index < sideCount; index++) {
      const z = -depth / 2 + sideSpacing * (index + 0.5)
      if (index !== tvRoomDoorPoster) {
        hangPoster(
          index,
          sideSpacing,
          () => new THREE.Vector3(-width / 2 + 0.07, 1.75, z),
          Math.PI / 2,
        )
      }
      hangPoster(
        index,
        sideSpacing,
        () => new THREE.Vector3(width / 2 - 0.07, 1.75, z),
        -Math.PI / 2,
      )
    }

    this.labelNew("Wall posters")
    this.roomMaterials.push(wallMaterial)
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.05, 0.7),
      woodMaterial,
    )
    counter.position.set(-width / 2 + 1.8, 0.525, depth / 2 - 1.95)
    counter.userData = { toggle: "filters" }
    this.swatches.push(counter)
    this.counterTop.set(-width / 2 + 1.8, 1.09, depth / 2 - 2.27)
    this.scene.add(counter)

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.7),
      new THREE.MeshBasicMaterial({ map: createFilterBoardTexture([], []) }),
    )
    board.position.set(-width / 2 + 1.8, 1.056, depth / 2 - 1.95)
    board.rotation.x = -Math.PI / 2
    board.matrixAutoUpdate = false
    board.updateMatrix()
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.8),
      new THREE.MeshBasicMaterial({
        map: createStoreSignTexture(storeName),
        toneMapped: false,
      }),
    )
    sign.position.set(-width / 2 + 1.8, 2.8, depth / 2 - 0.09)
    sign.rotation.y = Math.PI
    sign.matrixAutoUpdate = false
    sign.updateMatrix()
    this.scene.add(sign)
    this.storeSigns.push(sign)

    const streetSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.8),
      new THREE.MeshBasicMaterial({
        map: createStoreSignTexture(storeName),
        toneMapped: false,
      }),
    )
    streetSign.position.set(doorCenter, 2.8, depth / 2 + 0.09)
    streetSign.matrixAutoUpdate = false
    streetSign.updateMatrix()
    this.scene.add(streetSign)
    this.storeSigns.push(streetSign)

    for (const level of [0.9, 1.22, 1.54]) {
      const holdBoard = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.03, 0.135),
        woodMaterial,
      )
      holdBoard.position.set(-width / 2 + 1.8, level, depth / 2 - 0.12)
      this.scene.add(holdBoard)
      this.counterRows.push(
        new THREE.Vector3(
          -width / 2 + 1.8 + 1.3 - 0.172 / 2,
          level + 0.107,
          depth / 2 - 0.12,
        ),
      )
    }
    this.counterStep = 0.172
    this.counterCapacity = Math.max(1, Math.floor(2.6 / 0.172))

    const deskButtons = [
      ["create-channel", "Create channel"],
      ["counter-covers", "Load covers"],
      ["add-channel", "Add to channel"],
    ]
    const buttonGeometry = new THREE.PlaneGeometry(0.62, 0.194)
    for (const [index, [toggle, label]] of deskButtons.entries()) {
      const buttonMaterial = new THREE.MeshBasicMaterial({
        map: createLabelTexture(label),
      })
      for (const [side, z, turn] of [
        [-1, depth / 2 - 2.306, Math.PI],
        [1, depth / 2 - 1.594, 0],
      ] as const) {
        const button = new THREE.Mesh(buttonGeometry, buttonMaterial)
        button.position.set(
          -width / 2 + 1.8 - side * (index - 1) * 0.85,
          0.72,
          z,
        )
        button.rotation.y = turn
        button.userData = { toggle }
        button.matrixAutoUpdate = false
        button.updateMatrix()
        this.scene.add(button)
        this.swatches.push(button)
        if (toggle !== "counter-covers") {
          button.visible = false
          button.layers.disableAll()
          this.channelButtons.push(button)
        } else {
          button.visible = !this.autoLoadImages
          if (this.autoLoadImages) button.layers.disableAll()
          this.counterCoverButtons.push(button)
        }
      }
    }

    board.userData = { toggle: "filters" }
    this.scene.add(board)
    this.swatches.push(board)
    this.filterBoard = board

    this.colliders.push(new THREE.Box3().setFromObject(counter))

    this.labelNew("Counter and signs")
    this.buildTvRoom(
      width,
      depth,
      tvRoomCenterZ,
      tvRoomDoorZ,
      tvRoomDepth,
      levels,
      doorFrameMaterial,
      runs,
    )
    this.labelNew("TV room")
    const signGeometry = new THREE.PlaneGeometry(1.8, 0.45)
    for (let aisle = 0; aisle <= unitCount; aisle++) {
      const signX = (aisle - unitCount / 2) * 2.33
      const near = new THREE.Mesh(signGeometry, new THREE.MeshBasicMaterial())
      near.position.set(signX, 2.46, -0.5 + gondolaLength / 2 + 0.22)
      const far = new THREE.Mesh(signGeometry, new THREE.MeshBasicMaterial())
      far.position.set(signX, 2.46, -0.5 - gondolaLength / 2 - 0.22)
      far.rotation.y = Math.PI
      const nearBack = new THREE.Mesh(signGeometry, far.material)
      nearBack.position.copy(near.position)
      nearBack.rotation.y = Math.PI
      const farBack = new THREE.Mesh(signGeometry, near.material)
      farBack.position.copy(far.position)
      const group = new THREE.Group()
      group.visible = false
      for (const face of [near, far, nearBack, farBack]) {
        face.matrixAutoUpdate = false
        face.updateMatrix()
        group.add(face)
      }
      this.scene.add(group)
      this.aisleSigns.push({
        left: [],
        right: [],
        near,
        far,
        group,
        anchor: new THREE.Vector3(signX, 2.46, -0.5),
        dirty: true,
      })
    }

    this.labelNew("Aisle signs")
    const spawn = this.camera.position.clone()
    runs.sort(
      (left, right) =>
        left.levels[left.levels.length - 1][
          left.levels[0].length - 1
        ].position.distanceToSquared(spawn) -
        right.levels[right.levels.length - 1][
          right.levels[0].length - 1
        ].position.distanceToSquared(spawn),
    )

    this.runs = runs

    const spawnPoint = this.camera.position.clone()
    const aisleGroups = new Map<number, number[]>()
    for (let index = 0; index < runs.length; index++) {
      const aisle = runs[index].aisle
      if (aisle === null) continue
      const group = aisleGroups.get(aisle) ?? []
      group.push(index)
      aisleGroups.set(aisle, group)
    }
    const aisles = [...aisleGroups.keys()].sort((left, right) => left - right)
    if (
      Math.abs(
        this.aisleSigns[aisles[aisles.length - 1]].anchor.x - spawnPoint.x,
      ) < Math.abs(this.aisleSigns[aisles[0]].anchor.x - spawnPoint.x)
    ) {
      aisles.reverse()
    }
    const movement = aisles[0] < aisles[aisles.length - 1] ? 1 : -1
    let fromFar = movement > 0
    for (const aisle of aisles) {
      const group = [...(aisleGroups.get(aisle) ?? [])].sort(
        (left, right) =>
          (runs[right].order[0].facing.x - runs[left].order[0].facing.x) *
          movement,
      )
      for (const index of group) {
        runs[index].fill = buildRunOrder(runs[index].levels, fromFar)
        runs[index].readsAlongFill =
          fromFar === runs[index].order[0].facing.x < 0
        fromFar = !fromFar
        this.packOrder.push(index)
      }
    }

    this.runMeshes = runs.map(() => [])
    this.runTitles = runs.map(() => [])
    this.runSlots = runs.map(() => [])
    this.runCenters = runs.map((run) => {
      const row = run.levels[Math.floor(run.levels.length / 2)]
      return row[0].position.clone().lerp(row[row.length - 1].position, 0.5)
    })
    this.runBoxes = runs.map((run) =>
      new THREE.Box3()
        .setFromPoints(run.levels.flat().map((slot) => slot.position))
        .expandByScalar(0.15),
    )
    this.caseGroups = runs.map(() => {
      const group = new THREE.Group()
      group.visible = false
      group.matrixAutoUpdate = false
      this.scene.add(group)
      return group
    })

    const loaderGeometry = new THREE.PlaneGeometry(0.62, 0.194)
    for (let index = 0; index < runs.length; index++) {
      const slot = runs[index].order[0]
      for (const end of runs[index].endcap ? ["front"] : ["front", "back"]) {
        const button = new THREE.Mesh(loaderGeometry, this.loadCoversMaterial)
        button.rotation.y = Math.atan2(slot.facing.x, slot.facing.z)
        button.userData = { run: index, end }
        button.matrixAutoUpdate = false
        button.visible = false
        button.layers.set(2)
        this.scene.add(button)
        this.loaderButtons.push(button)
      }
      this.placeLoaderButton(index)
    }
    this.raycaster.layers.enable(2)
    this.loadButtons = this.buildInstanced(
      loaderGeometry,
      this.loadCoversMaterial,
      [],
      this.loaderButtons.length,
    )
    this.unloadButtons = this.buildInstanced(
      loaderGeometry,
      this.unloadCoversMaterial,
      [],
      this.loaderButtons.length,
    )
    this.labelNew("Cover buttons")
  }

  // TODO: Validate
  private buildTvRoom(
    width: number,
    depth: number,
    tvRoomCenterZ: number,
    tvRoomDoorZ: number,
    tvRoomDepth: number,
    levels: number[],
    doorFrameMaterial: THREE.Material,
    runs: ShelfRun[],
  ) {
    const doorWallX = -width / 2
    const farWallX = doorWallX - tvRoomDepth
    const tvRoomMaxZ = depth / 2
    const tvRoomMinZ = 2 * tvRoomCenterZ - tvRoomMaxZ
    const tvRoomWidth = tvRoomMaxZ - tvRoomMinZ
    const bookcaseLength = this.slotWidth * this.bay
    const bookcaseGap = (tvRoomWidth - 2 * bookcaseLength - 2.6) / 4
    const couchCenterX = farWallX + 3.24

    for (const side of [-1, 1]) {
      const tvRoomLamp = new THREE.PointLight(0xffd9a0, 2.5, 7, 2)
      tvRoomLamp.position.set(couchCenterX, 0.83, tvRoomCenterZ + side * 1.465)
      tvRoomLamp.updateMatrixWorld()
      this.tvRoomLamps.push(tvRoomLamp)
    }
    const tvRoomLights = lights([this.indoorLight, ...this.tvRoomLamps])

    const tvRoomWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8b13a,
      roughness: 0.9,
      side: THREE.DoubleSide,
    })
    this.roomMaterials.push(tvRoomWallMaterial)
    const tvRoomCeilingMaterial = new THREE.MeshStandardMaterial({
      color: 0x8f8f8f,
      roughness: 1,
    })
    this.tvRoomCarpetRepeat.set(tvRoomDepth / 1.5, tvRoomWidth / 1.5)
    const tvRoomFloorMaterial = new THREE.MeshStandardMaterial({
      map: createCarpetTexture(),
      color: 0xbababa,
      roughness: 1,
      metalness: 0,
    })
    tvRoomFloorMaterial.map?.repeat.copy(this.tvRoomCarpetRepeat)
    this.tvRoomFloorMaterial = tvRoomFloorMaterial
    const tvRoomWoodMaterial = WoodNodeMaterial.fromPreset("maple", "matte")
    tvRoomWoodMaterial.transformationMatrix.makeScale(4, 4, 4)
    this.tvRoomWoodMaterial = tvRoomWoodMaterial
    const tvBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x13a08f,
      roughness: 0.45,
    })
    const tvTrimMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c7a6c,
      roughness: 0.5,
    })
    const tvBezelMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fb3a6,
      roughness: 0.6,
    })
    for (const material of [
      tvRoomWallMaterial,
      tvRoomCeilingMaterial,
      tvRoomFloorMaterial,
      tvRoomWoodMaterial,
      tvBodyMaterial,
      tvTrimMaterial,
      tvBezelMaterial,
    ]) {
      material.lightsNode = tvRoomLights
    }

    const tvRoomFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(tvRoomDepth, tvRoomWidth),
      tvRoomFloorMaterial,
    )
    tvRoomFloor.rotation.x = -Math.PI / 2
    tvRoomFloor.position.set(farWallX + tvRoomDepth / 2, 0, tvRoomCenterZ)
    const tvRoomCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(tvRoomDepth, tvRoomWidth),
      tvRoomCeilingMaterial,
    )
    tvRoomCeiling.rotation.x = Math.PI / 2
    tvRoomCeiling.position.set(farWallX + tvRoomDepth / 2, 3.2, tvRoomCenterZ)
    this.scene.add(tvRoomFloor, tvRoomCeiling)

    for (const [centerX, centerZ, length, turn, bottom] of [
      [farWallX, tvRoomCenterZ, tvRoomWidth, Math.PI / 2, 0],
      [farWallX + tvRoomDepth / 2, tvRoomMinZ, tvRoomDepth, 0, 0],
      [
        doorWallX - 0.005,
        (tvRoomMinZ + tvRoomDoorZ - 0.5) / 2,
        tvRoomDoorZ - 0.5 - tvRoomMinZ,
        -Math.PI / 2,
        0,
      ],
      [
        doorWallX - 0.005,
        (tvRoomDoorZ + 0.5 + tvRoomMaxZ) / 2,
        tvRoomMaxZ - tvRoomDoorZ - 0.5,
        -Math.PI / 2,
        0,
      ],
      [doorWallX - 0.005, tvRoomDoorZ, 1, -Math.PI / 2, 2.1],
    ]) {
      const tvRoomWall = new THREE.Mesh(
        new THREE.PlaneGeometry(length, 3.2 - bottom),
        tvRoomWallMaterial,
      )
      tvRoomWall.position.set(centerX, (3.2 + bottom) / 2, centerZ)
      tvRoomWall.rotation.y = turn
      this.scene.add(tvRoomWall)
    }

    for (const side of [-1, 1]) {
      const doorJamb = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 2.1, 0.06),
        doorFrameMaterial,
      )
      doorJamb.position.set(doorWallX, 1.05, tvRoomDoorZ + side * 0.53)
      this.scene.add(doorJamb)
    }
    const doorHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.06, 1.12),
      doorFrameMaterial,
    )
    doorHead.position.set(doorWallX, 2.13, tvRoomDoorZ)
    this.scene.add(doorHead)

    const doorLeafIndex = this.doorLeaves.length
    const doorLeaf = new THREE.Group()
    doorLeaf.position.set(doorWallX, 0, tvRoomDoorZ - 0.5)
    this.scene.add(doorLeaf)
    this.doorLeaves.push({
      group: doorLeaf,
      swing: -Math.PI / 2,
      open: false,
      collider: new THREE.Box3(
        new THREE.Vector3(doorWallX - 0.05, 0, tvRoomDoorZ - 0.5),
        new THREE.Vector3(doorWallX + 0.05, 3.2, tvRoomDoorZ + 0.5),
      ),
    })
    const doorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 2.1, 0.98),
      tvRoomWoodMaterial,
    )
    doorSlab.position.set(0, 1.05, 0.5)
    const doorParts: THREE.Mesh[] = [doorSlab]
    for (const side of [-1, 1]) {
      const doorKnob = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 12, 8),
        doorFrameMaterial,
      )
      doorKnob.position.set(side * 0.05, 1, 0.88)
      doorParts.push(doorKnob)
    }
    for (const doorPart of doorParts) {
      doorPart.userData = { toggle: "door", leaf: doorLeafIndex }
      doorLeaf.add(doorPart)
      this.swatches.push(doorPart)
    }

    const bookcaseX = farWallX + 0.3
    const bookcaseSpinePlacements: THREE.Matrix4[] = []
    const bookcaseBasePlacements: THREE.Matrix4[] = []
    const bookcaseBoardPlacements: THREE.Matrix4[] = []
    const bookcaseEndPanelPlacements: THREE.Matrix4[] = []
    for (const [bookcaseStartZ, endcap] of [
      [tvRoomMinZ + bookcaseGap, "front"],
      [tvRoomMaxZ - bookcaseGap - bookcaseLength, "back"],
    ] as const) {
      const bookcaseCenterZ = bookcaseStartZ + bookcaseLength / 2
      bookcaseSpinePlacements.push(
        new THREE.Matrix4().makeTranslation(bookcaseX, 1.025, bookcaseCenterZ),
      )
      bookcaseBasePlacements.push(
        new THREE.Matrix4().makeTranslation(bookcaseX, 0.11, bookcaseCenterZ),
      )
      for (const end of [-1, 1]) {
        bookcaseEndPanelPlacements.push(
          new THREE.Matrix4().makeTranslation(
            bookcaseX,
            1.025,
            bookcaseCenterZ + end * (bookcaseLength / 2 + 0.04),
          ),
        )
      }
      const rows: Slot[][] = []
      for (const level of levels) {
        bookcaseBoardPlacements.push(
          new THREE.Matrix4().makeTranslation(
            bookcaseX + 0.2325,
            level - 0.015,
            bookcaseCenterZ,
          ),
        )
        const row: Slot[] = []
        for (let index = 0; index < this.bay; index++) {
          row.push({
            position: new THREE.Vector3(
              bookcaseX + 0.2446,
              level + 0.092,
              bookcaseStartZ + this.slotWidth * (index + 0.5),
            ),
            facing: new THREE.Vector3(1, 0, 0),
          })
        }
        rows.push(row)
      }
      runs.push({
        levels: rows,
        order: buildRunOrder(rows),
        fill: buildRunOrder(rows),
        readsAlongFill: true,
        aisle: null,
        side: "left",
        unit: null,
        endcap,
      })
    }
    this.shelves.push(
      this.buildInstanced(
        new THREE.BoxGeometry(0.33, 2.05, bookcaseLength),
        tvRoomWoodMaterial,
        bookcaseSpinePlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.6, 0.22, bookcaseLength),
        tvRoomWoodMaterial,
        bookcaseBasePlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.135, 0.03, bookcaseLength),
        tvRoomWoodMaterial,
        bookcaseBoardPlacements,
      ),
      this.buildInstanced(
        new THREE.BoxGeometry(0.6, 2.05, 0.08),
        tvRoomWoodMaterial,
        bookcaseEndPanelPlacements,
      ),
    )

    const tv = new THREE.Group()
    const tvBody = new THREE.Mesh(
      new RoundedBoxGeometry(2.4, 1.6, 0.9, 4, 0.15),
      tvBodyMaterial,
    )
    tvBody.position.y = 1.1
    tvBody.userData = { toggle: "tv" }
    tv.add(tvBody)
    const tvBezel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.04, 1.29),
      tvBezelMaterial,
    )
    tvBezel.position.set(0, 1.1, 0.451)
    tv.add(tvBezel)
    const tvScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.15),
      this.tvTrailerPlayer.tvBlackScreenMaterial,
    )
    tvScreen.position.set(0, 1.1, 0.452)
    tvScreen.userData = { toggle: "tv" }
    tv.add(tvScreen)
    this.tvTrailerPlayer.tvScreen = tvScreen
    for (const side of [-1, 1]) {
      const tvLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.34, 0.18),
        tvTrimMaterial,
      )
      tvLeg.position.set(side * 0.8, 0.15, 0)
      tvLeg.rotation.z = side * 0.35
      tv.add(tvLeg)
      const antennaLean = side * 0.6
      const antennaRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.85).translate(0, 0.425, 0),
        tvTrimMaterial,
      )
      antennaRod.position.set(0, 1.9, 0)
      antennaRod.rotation.z = antennaLean
      tv.add(antennaRod)
      const antennaTip = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 8),
        tvTrimMaterial,
      )
      antennaTip.position.set(
        -Math.sin(antennaLean) * 0.85,
        1.9 + Math.cos(antennaLean) * 0.85,
        0,
      )
      tv.add(antennaTip)
    }
    const antennaBase = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      tvTrimMaterial,
    )
    antennaBase.position.set(0, 1.9, 0)
    tv.add(antennaBase)
    tv.position.set(farWallX + 0.55, 0, tvRoomCenterZ)
    tv.rotation.y = Math.PI / 2
    this.scene.add(tv)
    this.swatches.push(tvBody, tvScreen)
    this.couchCaseSlot = {
      position: new THREE.Vector3(farWallX + 3.12, 0.46, tvRoomCenterZ - 0.45),
      facing: new THREE.Vector3(0, 1, 0),
    }
    const tvTitleSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.45),
      new THREE.MeshBasicMaterial({ toneMapped: false }),
    )
    tvTitleSign.position.set(farWallX + 0.7, 2.155, tvRoomCenterZ)
    tvTitleSign.rotation.y = Math.PI / 2
    tvTitleSign.visible = false
    tvTitleSign.layers.disableAll()
    tvTitleSign.userData = { toggle: "tv-title" }
    this.swatches.push(tvTitleSign)
    this.scene.add(tvTitleSign)
    this.tvTitleSign = tvTitleSign

    for (const [toggle, label, controlZ] of [
      ["tv-back", "<< 10s", 0.45],
      ["tv-pause", "Pause", 0],
      ["tv-forward", "10s >>", -0.45],
    ] as const) {
      const tvVideoControl = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.125),
        new THREE.MeshBasicMaterial({ map: createLabelTexture(label) }),
      )
      tvVideoControl.position.set(
        farWallX + 1.02,
        0.38,
        tvRoomCenterZ + controlZ,
      )
      tvVideoControl.rotation.y = Math.PI / 2
      tvVideoControl.userData = { toggle }
      tvVideoControl.visible = false
      tvVideoControl.layers.disableAll()
      this.scene.add(tvVideoControl)
      this.swatches.push(tvVideoControl)
      this.tvTrailerPlayer.tvVideoControls.push(tvVideoControl)
      if (toggle === "tv-pause") {
        this.tvTrailerPlayer.tvPauseButton = tvVideoControl
      }
    }

    for (const [toggle, label, buttonX, buttonZ, buttonWidth] of [
      ["trailer-counter", "Take it to the Counter", 2.045, 0.22, 0.62],
      ["tv-stop", "Stop", 2.045, -0.33, 0.36],
      ["trailer-previous", "Previous", 1.805, 0.3, 0.5],
      ["trailer-next", "Next", 1.805, -0.3, 0.5],
    ] as const) {
      const tvTrailerButton = new THREE.Mesh(
        new THREE.PlaneGeometry(buttonWidth, buttonWidth * 0.3125),
        new THREE.MeshBasicMaterial({ map: createLabelTexture(label) }),
      )
      tvTrailerButton.position.set(
        farWallX + buttonX,
        0.395,
        tvRoomCenterZ + buttonZ,
      )
      tvTrailerButton.rotation.set(-Math.PI / 2, 0, Math.PI / 2)
      tvTrailerButton.userData = { toggle }
      this.scene.add(tvTrailerButton)
      this.swatches.push(tvTrailerButton)
      if (toggle === "tv-stop") continue
      tvTrailerButton.visible = false
      tvTrailerButton.layers.disableAll()
      this.tvTrailerPlayer.tvTrailerButtons.push(tvTrailerButton)
    }

    for (const [minX, minZ, maxX, maxZ] of [
      [farWallX - 0.2, tvRoomMinZ - 0.2, farWallX, tvRoomMaxZ + 0.2],
      [farWallX - 0.2, tvRoomMinZ - 0.2, doorWallX, tvRoomMinZ],
      [farWallX - 0.2, tvRoomMaxZ, doorWallX, tvRoomMaxZ + 0.2],
      [
        farWallX,
        tvRoomMinZ + bookcaseGap - 0.08,
        farWallX + 0.6,
        tvRoomMinZ + bookcaseGap + bookcaseLength + 0.08,
      ],
      [
        farWallX,
        tvRoomMaxZ - bookcaseGap - bookcaseLength - 0.08,
        farWallX + 0.6,
        tvRoomMaxZ - bookcaseGap + 0.08,
      ],
      [farWallX + 0.1, tvRoomCenterZ - 1.2, farWallX + 1, tvRoomCenterZ + 1.2],
      [
        farWallX + 1.66,
        tvRoomCenterZ - 0.6,
        farWallX + 2.19,
        tvRoomCenterZ + 0.6,
      ],
      [
        farWallX + 2.85,
        tvRoomCenterZ - 1.1,
        farWallX + 3.63,
        tvRoomCenterZ + 1.1,
      ],
      [
        couchCenterX - 0.265,
        tvRoomCenterZ - 1.73,
        couchCenterX + 0.265,
        tvRoomCenterZ - 1.2,
      ],
      [
        couchCenterX - 0.265,
        tvRoomCenterZ + 1.2,
        couchCenterX + 0.265,
        tvRoomCenterZ + 1.73,
      ],
    ]) {
      this.colliders.push(
        new THREE.Box3(
          new THREE.Vector3(minX, 0, minZ),
          new THREE.Vector3(maxX, 3.2, maxZ),
        ),
      )
    }

    this.rain?.tvRoomRainRoof.set(
      new THREE.Vector2(farWallX, tvRoomMinZ),
      new THREE.Vector2(doorWallX, tvRoomMaxZ),
    )
    void this.loadTvRoomFurniture(farWallX, tvRoomCenterZ, tvRoomLights)
  }

  // TODO: Validate
  /**
   * Load the couch, coffee table, side tables, and table lamps into the TV
   * room, lit only by the TV room lights with the lamp shades glowing.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private async loadTvRoomFurniture(
    farWallX: number,
    tvRoomCenterZ: number,
    tvRoomLights: ReturnType<typeof lights>,
  ) {
    const furniture = await new GLTFLoader().loadAsync(tvRoomFurnitureUrl)
    if (this.disposed) return
    furniture.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const material = mesh.material as THREE.MeshStandardMaterial
      material.lightsNode = tvRoomLights
      if (material.name === "lamp_shade") {
        material.emissive.set(0xffd9a0)
        material.emissiveMap = material.map
        material.emissiveIntensity = 0.8
      }
    })
    furniture.scene.traverse((object) => {
      object.frustumCulled = false
    })
    await this.renderer.compileAsync(furniture.scene, this.camera, this.scene)
    if (this.disposed) return
    furniture.scene.traverse((object) => {
      object.frustumCulled = true
    })
    const couch = furniture.scene.getObjectByName("couch")
    const coffeeTable = furniture.scene.getObjectByName("coffee_table")
    const sideTable = furniture.scene.getObjectByName("side_table")
    const lamp = furniture.scene.getObjectByName("lamp")
    if (!couch || !coffeeTable || !sideTable || !lamp) return
    couch.position.set(farWallX + 3.17, 0, tvRoomCenterZ)
    couch.rotation.y = -Math.PI / 2
    couch.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.userData = { toggle: "couch" }
      this.swatches.push(mesh)
    })
    this.couchSeatedPosition.set(farWallX + 3.1, 1.15, tvRoomCenterZ)
    this.couchStandingPosition.set(farWallX + 2.52, 1.65, tvRoomCenterZ)
    this.couchLookTarget.set(farWallX + 1, 1.1, tvRoomCenterZ)
    coffeeTable.position.set(farWallX + 1.925, 0, tvRoomCenterZ)
    coffeeTable.rotation.y = Math.PI / 2
    this.scene.add(couch, coffeeTable)
    for (const side of [-1, 1]) {
      const sideTableCopy = sideTable.clone()
      sideTableCopy.position.set(
        farWallX + 3.24,
        0,
        tvRoomCenterZ + side * 1.465,
      )
      const lampCopy = lamp.clone()
      lampCopy.position.set(farWallX + 3.24, 0.39, tvRoomCenterZ + side * 1.465)
      this.scene.add(sideTableCopy, lampCopy)
    }
  }

  // TODO: Validate
  /**
   * Tag every scene object that has no category yet with the given label, used
   * to group shader compile progress.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private labelNew(label: string) {
    this.scene.traverse((object) => {
      object.userData.category ??= label
    })
  }

  // TODO: Validate
  /**
   * Return an instanced mesh added to the scene with one instance per placement
   * and any extra capacity hidden.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private buildInstanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    placements: THREE.Matrix4[],
    count = placements.length,
  ) {
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    for (const [index, placement] of placements.entries()) {
      mesh.setMatrixAt(index, placement)
    }
    for (let index = placements.length; index < count; index++) {
      mesh.setMatrixAt(index, new THREE.Matrix4().makeScale(0, 0, 0))
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    mesh.matrixAutoUpdate = false
    mesh.userData.placements = placements
    this.instanced.push(mesh)
    this.scene.add(mesh)
    return mesh
  }

  // TODO: Validate
  /**
   * Choose the nearest shelf runs in view up to the loaded run limit, update
   * the render range, signs, posters, and shelves to match, and remount runs
   * when the choice changes.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private updateLod() {
    this.updateViewFrustum()
    const ranked = this.runs
      .map((_, index) => {
        const distance = this.runCenters[index].distanceTo(this.camera.position)
        const held = this.visibleRuns.has(index) ? 1 : 0
        return { index, distance, rank: distance - held }
      })
      .filter(
        (entry) =>
          entry.distance < 4 ||
          this.viewFrustum.intersectsBox(this.runBoxes[entry.index]),
      )
      .sort((left, right) => left.rank - right.rank)
      .slice(0, this.loadedRuns)
    let changed = ranked.length !== this.visibleRuns.size
    const chosen = new Set(ranked.map((entry) => entry.index))
    for (const index of chosen) {
      if (!this.visibleRuns.has(index)) changed = true
    }
    this.visibleRuns = chosen
    const runsKeptMounted = new Set(chosen)
    for (const [index, box] of this.runBoxes.entries()) {
      if (box.distanceToPoint(this.camera.position) <= 8) {
        runsKeptMounted.add(index)
      }
    }
    if (runsKeptMounted.size !== this.runsKeptMounted.size) changed = true
    for (const index of runsKeptMounted) {
      if (!this.runsKeptMounted.has(index)) changed = true
    }
    this.runsKeptMounted = runsKeptMounted
    this.renderRange = Math.max(0, ...ranked.map((entry) => entry.distance)) + 3
    this.updateSigns()
    this.updatePosters()
    this.cullShelves()
    if (changed) this.applyLod()
  }

  // TODO: Validate
  /**
   * Hide shelf instances farther than the render range and show the ones back
   * within it.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private cullShelves() {
    for (const mesh of this.shelves) {
      const placements = mesh.userData.placements as THREE.Matrix4[]
      if (!mesh.userData.boxes) {
        mesh.geometry.computeBoundingBox()
        const bounds = mesh.geometry.boundingBox ?? new THREE.Box3()
        mesh.userData.boxes = placements.map((placement) =>
          bounds.clone().applyMatrix4(placement),
        )
        mesh.userData.shown = placements.map(() => true)
      }
      const boxes = mesh.userData.boxes as THREE.Box3[]
      const shown = mesh.userData.shown as boolean[]
      let changed = false
      for (const [index, box] of boxes.entries()) {
        const visible =
          box.distanceToPoint(this.camera.position) < this.renderRange
        if (visible === shown[index]) continue
        shown[index] = visible
        changed = true
        mesh.setMatrixAt(
          index,
          visible ? placements[index] : this.hiddenInstance,
        )
      }
      if (changed) mesh.instanceMatrix.needsUpdate = true
    }
  }

  // TODO: Validate
  /**
   * Show aisle signs within the render range, hide the rest, and repaint the
   * nearest out-of-range sign whose genres changed so it is ready before it
   * comes into view.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private updateSigns() {
    let upcoming: AisleSign | null = null
    let upcomingDistance = Number.POSITIVE_INFINITY
    for (const [index, sign] of this.aisleSigns.entries()) {
      const distance = sign.anchor.distanceTo(this.camera.position)
      const shown = this.visibleSigns.has(index)
      if (distance < (shown ? this.renderRange * 1.15 : this.renderRange)) {
        if (shown) continue
        this.visibleSigns.add(index)
        if (sign.dirty) this.refreshSign(sign)
        sign.group.visible = true
        continue
      }
      if (sign.dirty && distance < upcomingDistance) {
        upcoming = sign
        upcomingDistance = distance
      }
      if (!shown) continue
      this.visibleSigns.delete(index)
      sign.group.visible = false
    }
    if (upcoming) this.refreshSign(upcoming)
  }

  // TODO: Validate
  /**
   * Show wall posters within the render range and paint each one's title art
   * the first time it comes into view.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private updatePosters() {
    for (const poster of this.posters) {
      const distance = poster.position.distanceTo(this.camera.position)
      const shown = distance < this.renderRange
      poster.visible = shown
      if (!shown || poster.userData.painted) continue
      const title = poster.userData.title as StoreTitle | undefined
      if (!title || !this.coverWanted(poster, 0.9, 30)) continue
      poster.userData.painted = true
      void this.paintPoster(poster, title)
    }
  }

  // TODO: Validate
  /**
   * Move the pool of ceiling point lights to the lamp anchors nearest the
   * camera, fading out the farthest ones so lights do not pop.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private moveLights() {
    this.forest?.setCameraPosition(this.camera.position)
    if (this.lampPool.length === 0) return
    const kept = this.lampPool.length + 1
    const chosen: number[] = []
    const ranges: number[] = []
    for (const [index, anchor] of this.lampAnchors.entries()) {
      const range = anchor.distanceToSquared(this.camera.position)
      if (chosen.length === kept && range >= ranges[ranges.length - 1]) {
        continue
      }
      let slot = chosen.length
      while (slot > 0 && ranges[slot - 1] > range) slot--
      chosen.splice(slot, 0, index)
      ranges.splice(slot, 0, range)
      if (chosen.length > kept) {
        chosen.pop()
        ranges.pop()
      }
    }
    const edge = Math.sqrt(
      ranges[this.lampPool.length] ?? Number.POSITIVE_INFINITY,
    )
    for (const [slot, bulb] of this.lampPool.entries()) {
      bulb.position.copy(this.lampAnchors[chosen[slot] ?? 0])
      const margin = (edge - Math.sqrt(ranges[slot] ?? edge)) / (edge * 0.35)
      const fade = Number.isFinite(edge) ? Math.min(Math.max(margin, 0), 1) : 1
      bulb.intensity = 1.3 * this.lightLevel * fade * fade * (3 - 2 * fade)
    }
  }

  // TODO: Validate
  private applyLod(immediate = false) {
    for (let index = 0; index < this.runs.length; index++) {
      if (!this.runsKeptMounted.has(index)) {
        this.mountQueue.delete(index)
        this.unmountRun(index)
      } else if (immediate) {
        this.mountQueue.delete(index)
        this.mountRun(index)
      } else if (!this.mountedRuns.has(index)) {
        this.mountQueue.add(index)
      }
    }
    this.cullRuns()
  }

  // TODO: Validate
  private mountQueued() {
    const started = performance.now()
    while (this.mountQueue.size > 0 && performance.now() - started < 3) {
      let nearest = -1
      let nearestHidden = true
      let shortest = Number.POSITIVE_INFINITY
      for (const index of this.mountQueue) {
        const hidden = !this.visibleRuns.has(index)
        const distance = this.runCenters[index].distanceToSquared(
          this.camera.position,
        )
        if (hidden && !nearestHidden) continue
        if (distance < shortest || (nearestHidden && !hidden)) {
          shortest = distance
          nearest = index
          nearestHidden = hidden
        }
      }
      this.mountQueue.delete(nearest)
      if (this.runsKeptMounted.has(nearest)) this.mountRun(nearest)
    }
  }

  // TODO: Validate
  /**
   * Show or hide a run's genre tags, headers, and strips.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private showDecor(index: number, shown: boolean) {
    if (shown === this.decoratedRuns.has(index)) return
    if (shown) this.decoratedRuns.add(index)
    else this.decoratedRuns.delete(index)
    for (const { mesh, slot, placement } of this.runDecor[index] ?? []) {
      mesh.setMatrixAt(slot, shown ? placement : this.hiddenInstance)
      mesh.instanceMatrix.needsUpdate = true
    }
  }

  // TODO: Validate
  /**
   * Update the instanced load and unload cover buttons for a run to match
   * whether its covers are loaded.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private showLoaderButtons(runIndex: number) {
    if (!this.loadButtons || !this.unloadButtons) return
    const revealed = this.revealedRuns.has(runIndex)
    for (const [slot, button] of this.loaderButtons.entries()) {
      if (button.userData.run !== runIndex) continue
      this.loadButtons.setMatrixAt(
        slot,
        button.visible && !revealed ? button.matrix : this.hiddenInstance,
      )
      this.unloadButtons.setMatrixAt(
        slot,
        button.visible && revealed ? button.matrix : this.hiddenInstance,
      )
    }
    this.loadButtons.instanceMatrix.needsUpdate = true
    this.unloadButtons.instanceMatrix.needsUpdate = true
  }

  // TODO: Validate
  /**
   * Show or hide each run's cases, decor, and cover loader buttons to match the
   * visible runs.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private cullRuns() {
    for (let index = 0; index < this.runs.length; index++) {
      const shown = this.visibleRuns.has(index)
      this.showDecor(index, shown)
      this.caseGroups[index].visible = shown
      const buttonShown = shown && !this.autoLoadImages
      let toggled = false
      for (const button of this.loaderButtons) {
        if (button.userData.run !== index || button.visible === buttonShown) {
          continue
        }
        button.visible = buttonShown
        toggled = true
      }
      if (toggled) this.showLoaderButtons(index)
    }
  }

  // TODO: Validate
  /**
   * Place a case mesh for every title in a run, batch them into instanced
   * meshes, and queue their covers when the run's covers are loaded.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private mountRun(index: number) {
    if (this.mountedRuns.has(index)) return
    this.mountedRuns.add(index)
    const run = this.runs[index]
    const titles = this.runTitles[index]
    const group = this.caseGroups[index]
    const meshes: THREE.Mesh[] = []
    const slots = this.runSlots[index]
    for (const [offset, title] of titles.entries()) {
      const mesh = this.takeCase(title)
      group.add(mesh)
      this.settleCase(mesh, run.fill[slots[offset]])
      meshes.push(mesh)
    }
    this.runMeshes[index] = meshes
    this.batchRun(index)
    if (!this.revealedRuns.has(index) || this.autoLoadImages) return
    for (const mesh of meshes) this.queueImage(mesh)
    for (let concurrent = 0; concurrent < 32; concurrent++)
      this.coverDownloadQueue.nextImage()
  }

  // TODO: Validate
  /**
   * Remove a run's case meshes and batches and return the meshes to the case
   * pool.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private unmountRun(index: number) {
    if (!this.mountedRuns.has(index)) return
    this.unbatchRun(index)
    this.mountedRuns.delete(index)
    const meshes = this.runMeshes[index]
    this.runMeshes[index] = []
    const group = this.caseGroups[index]
    for (const mesh of meshes) {
      group.remove(mesh)
      this.releaseCase(mesh)
    }
  }

  // TODO: Validate
  /**
   * Draw a run's cases through pooled instanced meshes, one batch for the whole
   * run or batches of 32 when its covers are loaded.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private batchRun(index: number) {
    const meshes = this.runMeshes[index]
    if (meshes.length === 0) return
    const revealed = this.revealedRuns.has(index)
    const chunk = revealed ? 32 : meshes.length
    const capacity = revealed ? 32 : this.runs[index].levels.flat().length
    const batches: Array<{
      mesh: THREE.InstancedMesh
      covers: THREE.DataArrayTexture | null
      members: THREE.Mesh[]
    }> = []
    for (let start = 0; start < meshes.length; start += chunk) {
      const members = meshes.slice(start, start + chunk)
      const batch = this.takeBatch(capacity)
      batch.count = members.length
      const entry = { mesh: batch, covers: null, members }
      for (const [slot, mesh] of members.entries()) {
        mesh.userData.batch = batch
        mesh.userData.batchSlot = slot
        if (revealed) mesh.userData.batchEntry = entry
        batch.setColorAt(
          slot,
          this.placeholderMaterial(mesh.userData.title as StoreTitle).color,
        )
        this.batchCase(mesh, mesh === this.focused)
      }
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true
      batch.computeBoundingSphere()
      this.caseGroups[index].add(batch)
      batches.push(entry)
    }
    this.runBatches.set(index, batches)
  }

  // TODO: Validate
  /**
   * Return a pooled instanced case mesh of the given capacity, or create one.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private takeBatch(capacity: number) {
    const pool = this.batchPool.get(capacity) ?? []
    this.batchPool.set(capacity, pool)
    const pooled = pool.pop()
    if (pooled) {
      pooled.geometry = this.caseGeometry
      pooled.material = this.batchMaterial
      return pooled
    }
    const batch = new THREE.InstancedMesh(
      this.caseGeometry,
      this.batchMaterial,
      capacity,
    )
    batch.matrixAutoUpdate = false
    batch.setColorAt(0, this.white)
    return batch
  }

  // TODO: Validate
  /**
   * Return a texture array with one layer per case, each filled with that
   * case's placeholder color until its cover is painted.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private buildCovers(meshes: THREE.Mesh[]) {
    const layerSize = 512 * 512
    const data = new Uint8Array(layerSize * 4 * meshes.length)
    const pixels = new Uint32Array(data.buffer)
    const shade = new THREE.Color()
    for (const [layer, mesh] of meshes.entries()) {
      this.placeholderMaterial(mesh.userData.title as StoreTitle).color.getRGB(
        shade,
        THREE.SRGBColorSpace,
      )
      const fill =
        (Math.round(shade.r * 255) |
          (Math.round(shade.g * 255) << 8) |
          (Math.round(shade.b * 255) << 16) |
          (255 << 24)) >>>
        0
      pixels.fill(fill, layer * layerSize, (layer + 1) * layerSize)
    }
    const covers = new THREE.DataArrayTexture(data, 512, 512, meshes.length)
    covers.colorSpace = THREE.SRGBColorSpace
    covers.magFilter = THREE.LinearFilter
    covers.minFilter = THREE.LinearMipmapLinearFilter
    covers.generateMipmaps = true
    covers.anisotropy = 4
    covers.needsUpdate = true
    covers.onUpdate = () => {
      covers.userData.uploaded = true
    }
    return covers
  }

  // TODO: Validate
  /**
   * Return a tracked case material that samples each instance's cover from the
   * texture array, dimmed by the unlit brightness when unlit.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private coverMaterial(covers: THREE.DataArrayTexture) {
    const material = this.unlit
      ? new THREE.MeshBasicMaterial()
      : new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.06 })
    const sampled = texture(covers, uv()).depth(
      varying(float(instanceIndex)).round(),
    )
    material.colorNode = this.unlit
      ? sampled.mul(this.unlitBrightness)
      : sampled
    return this.trackCase(material)
  }

  // TODO: Validate
  /**
   * Paint a title's cover into its batch's texture array layer and return a
   * texture of that layer, or a standalone case texture when the case is not in
   * a cover batch.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private paintCover(
    mesh: THREE.Mesh,
    title: StoreTitle,
    image: HTMLImageElement,
    logo: HTMLImageElement | null,
  ) {
    const entry = mesh.userData.batchEntry as
      | {
          mesh: THREE.InstancedMesh
          covers: THREE.DataArrayTexture | null
          members: THREE.Mesh[]
        }
      | undefined
    if (entry && !entry.covers) {
      entry.covers = this.buildCovers(entry.members)
      for (let slot = 0; slot < entry.members.length; slot++) {
        entry.mesh.setColorAt(slot, this.white)
      }
      if (entry.mesh.instanceColor) entry.mesh.instanceColor.needsUpdate = true
      entry.mesh.material = this.coverMaterial(entry.covers)
      for (const member of entry.members) {
        member.userData.covers = entry.covers
      }
    }
    const covers = mesh.userData.covers as THREE.DataArrayTexture | undefined
    const pixels = covers
      ? createCaseCanvas(title, image, 2, false, logo, this.spineRatio)
          .getContext("2d")
          ?.getImageData(0, 0, 512, 512).data
      : undefined
    if (!covers || !pixels) {
      return createCaseTexture(title, image, logo, this.spineRatio)
    }
    const layer = mesh.userData.batchSlot as number
    const row = 512 * 4
    const offset = layer * 512 * row
    const data = covers.image.data as Uint8Array
    for (let line = 0; line < 512; line++) {
      data.set(
        pixels.subarray(line * row, (line + 1) * row),
        offset + (511 - line) * row,
      )
    }
    if (covers.userData.uploaded) {
      covers.addLayerUpdate(layer)
      this.dirtyCovers.add(covers)
    }
    const cover = new THREE.DataTexture(
      data.subarray(offset, offset + 512 * row),
      512,
      512,
    )
    cover.colorSpace = THREE.SRGBColorSpace
    cover.magFilter = THREE.LinearFilter
    cover.minFilter = THREE.LinearMipmapLinearFilter
    cover.generateMipmaps = true
    cover.anisotropy = 4
    cover.needsUpdate = true
    return cover
  }

  // TODO: Validate
  /**
   * Upload changed cover texture arrays at most every 200 milliseconds.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private flushCovers() {
    if (this.dirtyCovers.size === 0) return
    const now = performance.now()
    if (now - this.coversFlushedAt < 200) return
    this.coversFlushedAt = now
    for (const covers of this.dirtyCovers) covers.needsUpdate = true
    this.dirtyCovers.clear()
  }

  // TODO: Validate
  /**
   * Return a run's instanced batches to the pool, dispose their cover textures
   * and materials, and clear the batch data from its cases.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private unbatchRun(index: number) {
    const batches = this.runBatches.get(index)
    if (!batches) return
    this.runBatches.delete(index)
    for (const { mesh: batch, covers } of batches) {
      batch.removeFromParent()
      this.batchPool.get(batch.instanceMatrix.count)?.push(batch)
      if (!covers) continue
      this.dirtyCovers.delete(covers)
      const material = batch.material as
        | THREE.MeshStandardMaterial
        | THREE.MeshBasicMaterial
      this.caseMaterials.delete(material)
      material.dispose()
      covers.dispose()
    }
    for (const mesh of this.runMeshes[index]) {
      mesh.visible = true
      delete mesh.userData.batch
      delete mesh.userData.batchSlot
      delete mesh.userData.covers
      delete mesh.userData.batchEntry
    }
  }

  // TODO: Validate
  /**
   * Show a case as its own mesh and hide its batch instance, or the reverse, so
   * a focused case can move independently.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private batchCase(mesh: THREE.Mesh, shown: boolean) {
    const batch = mesh.userData.batch as THREE.InstancedMesh | undefined
    if (!batch) return
    mesh.visible = shown
    batch.setMatrixAt(
      mesh.userData.batchSlot as number,
      shown ? this.hiddenInstance : mesh.matrix,
    )
    batch.instanceMatrix.needsUpdate = true
  }

  // TODO: Validate
  /**
   * Return every case mesh in the mounted runs.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private mountedCases() {
    const meshes: THREE.Mesh[] = []
    for (const index of this.mountedRuns) meshes.push(...this.runMeshes[index])
    return meshes
  }

  // TODO: Validate
  /**
   * Return a pooled or new case mesh set up for a title with its placeholder
   * material and seeded tilt.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private takeCase(title: StoreTitle) {
    let mesh = this.casePool.pop()
    if (!mesh) {
      mesh = new THREE.Mesh(this.caseGeometry)
      mesh.matrixAutoUpdate = false
      mesh.rotation.order = "YXZ"
    }
    mesh.geometry = this.caseGeometry
    mesh.scale.setScalar(this.caseScale)
    mesh.material = this.placeholderMaterial(title)
    mesh.visible = true
    mesh.userData = {
      title,
      generation: ++this.generationCounter,
      basePosition: new THREE.Vector3(),
      facing: new THREE.Vector3(0, 0, 1),
      spin: seededOffset(`${title.id}-spin`),
      drift: seededOffset(`${title.id}-drift`),
    }
    return mesh
  }

  // TODO: Validate
  /**
   * Clear a case's focus and cover and return it to the case pool.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private releaseCase(mesh: THREE.Mesh) {
    if (mesh === this.focused) this.applyFocus(null)
    this.clearCover(mesh)
    mesh.userData = {}
    this.casePool.push(mesh)
  }

  // TODO: Validate
  /**
   * Drop a case's queued image and dispose its cover material unless a counter
   * case shares it, bumping its generation so in-flight loads are ignored.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private clearCover(mesh: THREE.Mesh) {
    if (mesh.userData.imageQueued) this.coverDownloadQueue.remove(mesh)
    const material = mesh.userData.material as
      | THREE.MeshStandardMaterial
      | THREE.MeshBasicMaterial
      | undefined
    const shared = this.counterCases.some((held) => held.material === material)
    if (material && !shared) {
      this.caseMaterials.delete(material)
      material.map?.dispose()
      material.dispose()
    }
    mesh.userData.generation = ++this.generationCounter
    delete mesh.userData.imageQueued
    delete mesh.userData.material
    delete mesh.userData.texture
  }

  // TODO: Validate
  /**
   * Repaint both faces of an aisle sign with its current left and right genre
   * lists.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private refreshSign(sign: AisleSign) {
    sign.dirty = false
    const faces: Array<[THREE.Mesh, string[], string[]]> = [
      [sign.near, sign.left, sign.right],
      [sign.far, sign.right, sign.left],
    ]
    for (const [face, left, right] of faces) {
      const material = face.material as THREE.MeshBasicMaterial
      material.map?.dispose()
      material.map = createAisleSignTexture(left, right)
      material.needsUpdate = true
      this.uploadTexture(material.map)
    }
  }

  // TODO: Validate
  /**
   * Upload a texture to the GPU now if the renderer is initialized.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private uploadTexture(texture: THREE.Texture) {
    if (this.renderer.initialized) this.renderer.initTexture(texture)
  }

  // TODO: Validate
  /**
   * Set which metadata source title details are downloaded from.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setMetadata(metadata: StoreMetadata) {
    this.metadata = metadata
  }

  // TODO: Validate
  /**
   * Set the genres titles may be shelved under, or null to allow every genre.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setShelfGenres(genres: string[] | null) {
    this.shelfFilter = genres === null ? null : new Set(genres)
  }

  // TODO: Validate
  /**
   * Clear the shelved titles and shelve the given titles from scratch.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  restock(titles: StoreTitle[]) {
    this.allTitles = []
    this.genreTitles.clear()
    this.placedTitles = 0
    this.restocked = true
    this.addTitles(titles)
  }

  // TODO: Validate
  /**
   * Shelve the titles not placed yet under their genres and lay out the store
   * again when anything was added.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  addTitles(titles: StoreTitle[]) {
    let added = this.restocked
    this.restocked = false
    for (let index = this.placedTitles; index < titles.length; index++) {
      const title = titles[index]
      this.allTitles.push(title)
      const genreNames = shelfGenres(title, this.shelfFilter)
      if (genreNames.length === 0 && title.genres.length > 0) continue
      for (const genre of genreNames.length ? genreNames : ["_Unknown"]) {
        const shelved = this.genreTitles.get(genre) ?? []
        shelved.push(title)
        this.genreTitles.set(genre, shelved)
        added = true
      }
    }
    this.placedTitles = titles.length

    if (added) {
      this.layoutStore()
      this.dressPosters()
      this.updateLod()
      this.applyLod(true)
      this.moveLights()
    }
    for (let concurrent = 0; concurrent < 32; concurrent++)
      this.coverDownloadQueue.nextImage()
  }

  // TODO: Validate
  /**
   * Return the shelved genres in display order.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private genreOrder() {
    return [...this.genreTitles.keys()].sort(compareGenres)
  }

  // TODO: Validate
  /**
   * Return the shelved titles that have a release date, newest first.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private newReleases() {
    const dated = [...new Set([...this.genreTitles.values()].flat())].flatMap(
      (title) =>
        title.releaseDate === null
          ? []
          : [{ title, releaseDate: title.releaseDate }],
    )
    dated.sort((left, right) =>
      right.releaseDate.localeCompare(left.releaseDate),
    )
    return dated.map((entry) => entry.title)
  }

  // TODO: Validate
  /**
   * Assign titles to shelf slots, New Releases first and then each genre in
   * order, then stock the endcaps, build genre decor, and post aisle signs.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private layoutStore() {
    for (const index of [...this.mountedRuns]) this.unmountRun(index)
    this.runTitles = this.runs.map(() => [])
    this.runSlots = this.runs.map(() => [])
    const entries = this.runs.map(() => [] as string[])
    const sections: Array<{
      run: number
      start: number
      end: number
      genre: string
    }> = []
    const tagged: Array<{ genre: string; slot: Slot; run: number }> = []
    let slot = 0
    let column = 0

    for (const genre of ["New Releases", ...this.genreOrder()]) {
      const newest = genre === "New Releases"
      const shelved = newest
        ? this.newReleases().slice(
            0,
            this.runs[this.packOrder[0]].levels.flat().length,
          )
        : (this.genreTitles.get(genre) ?? [])
      const end = newest ? 1 : this.packOrder.length
      if (!newest && slot === 0) {
        slot = 1
        column = 0
      }
      let placed = 0
      while (placed < shelved.length) {
        while (
          slot < this.packOrder.length &&
          column >= this.runs[this.packOrder[slot]].levels[0].length
        ) {
          slot++
          column = 0
        }
        if (slot >= end) break
        const runIndex = this.packOrder[slot]
        const run = this.runs[runIndex]
        const levels = run.levels.length
        const width = Math.min(
          this.bay - (column % this.bay),
          run.levels[0].length - column,
          Math.ceil((shelved.length - placed) / levels),
        )
        for (
          let offset = 0;
          offset < width * levels && placed < shelved.length;
          offset++
        ) {
          const across = offset % width
          const fillColumn = run.readsAlongFill
            ? column + across
            : column + width - 1 - across
          const index = fillColumn * levels + Math.floor(offset / width)
          if (offset === 0) {
            if (entries[runIndex][entries[runIndex].length - 1] !== genre) {
              entries[runIndex].push(genre)
            }
            tagged.push({ genre, slot: run.fill[index], run: runIndex })
            sections.push({ run: runIndex, start: index, end: index, genre })
          }
          const current = sections[sections.length - 1]
          current.start = Math.min(current.start, index)
          current.end = Math.max(current.end, index)
          this.runTitles[runIndex].push(shelved[placed])
          this.runSlots[runIndex].push(index)
          placed++
        }
        column += width
      }
    }

    this.genreStarts = tagged
    this.stockEndcaps()
    this.buildDecor(tagged, sections)
    this.postSigns(entries)
  }

  // TODO: Validate
  /**
   * Fill each gondola's endcaps with the top tenth of its titles by IMDb score,
   * falling back to TMDB score and then a random order.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private stockEndcaps() {
    const unitPicks = new Map<number | null, StoreTitle[]>()
    for (const [index, run] of this.runs.entries()) {
      if (!run.endcap) continue
      let ranked = unitPicks.get(run.unit)
      if (!ranked) {
        const stocked = new Map<string, StoreTitle>()
        for (const [otherIndex, other] of this.runs.entries()) {
          if (other.endcap) continue
          if (run.unit !== null && other.unit !== run.unit) continue
          for (const title of this.runTitles[otherIndex]) {
            stocked.set(title.id, title)
          }
        }
        const imdbRated = [...stocked.values()].flatMap((title) =>
          title.imdbScore === null ? [] : [{ title, order: title.imdbScore }],
        )
        const rated =
          imdbRated.length > 0
            ? imdbRated
            : [...stocked.values()].flatMap((title) =>
                title.tmdbScore === null
                  ? []
                  : [{ title, order: title.tmdbScore }],
              )
        const ordered =
          rated.length > 0
            ? rated
            : [...stocked.values()].map((title) => ({
                title,
                order: Math.random(),
              }))
        ordered.sort((left, right) => right.order - left.order)
        ranked = ordered
          .slice(
            0,
            rated.length > 0 ? Math.ceil(rated.length * 0.1) : ordered.length,
          )
          .map((entry) => entry.title)
        unitPicks.set(run.unit, ranked)
      }
      const capacity = run.levels.length * run.levels[0].length
      const frontCount = Math.min(capacity, Math.ceil(ranked.length / 2))
      const start = run.endcap === "front" ? 0 : frontCount
      const end = run.endcap === "front" ? frontCount : start + capacity
      const titles = ranked.slice(start, end)
      const slots = [...run.levels].reverse().flat()
      this.runTitles[index] = titles
      this.runSlots[index] = titles.map((_, offset) =>
        run.fill.indexOf(slots[offset]),
      )
    }
  }

  // TODO: Validate
  /**
   * Rebuild the instanced genre tags, section headers, and shelf strips that
   * mark where each genre starts and spans.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private buildDecor(
    tagged: Array<{ genre: string; slot: Slot; run: number }>,
    sections: Array<{ run: number; start: number; end: number; genre: string }>,
  ) {
    for (const batch of [this.tagBatch, this.headerBatch, this.stripBatch]) {
      if (!batch) continue
      batch.removeFromParent()
      ;(batch.material as THREE.Material).dispose()
      batch.dispose()
    }
    this.tagBatch = null
    this.headerBatch = null
    this.stripBatch = null
    this.tagArray?.dispose()
    this.tagArray = null
    this.runDecor = this.runs.map(() => [])
    this.decoratedRuns.clear()

    const strips: Array<{ genre: string; near: Slot; far: Slot; run: number }> =
      []
    for (const section of sections) {
      const run = this.runs[section.run]
      const levels = run.levels.length
      const first = Math.floor(section.start / levels)
      const last = Math.floor(section.end / levels)
      for (let level = 0; level < levels; level++) {
        strips.push({
          genre: section.genre,
          near: run.fill[first * levels + levels - 1 - level],
          far: run.fill[last * levels + levels - 1 - level],
          run: section.run,
        })
      }
    }

    if (tagged.length > 0) {
      const genres = [...new Set(tagged.map((entry) => entry.genre))]
      this.tagArray = this.buildTagArray(genres)
      const layers = new THREE.InstancedBufferAttribute(
        new Float32Array(tagged.map((entry) => genres.indexOf(entry.genre))),
        1,
      )
      const material = new THREE.MeshBasicMaterial()
      material.colorNode = texture(this.tagArray, uv()).depth(
        varying(instancedBufferAttribute<"float">(layers)).round(),
      )
      this.tagBatch = new THREE.InstancedMesh(
        this.tagGeometry,
        material,
        tagged.length,
      )
      const turn = new THREE.Quaternion()
      const unit = new THREE.Vector3(1, 1, 1)
      const lanes = new Map<string, number[][]>()
      for (const [slot, entry] of tagged.entries()) {
        const facing = entry.slot.facing
        const along =
          Math.abs(facing.x) > 0.5
            ? entry.slot.position.z
            : entry.slot.position.x
        const shelf = `${entry.run}:${entry.slot.position.y.toFixed(3)}`
        const shelfLanes = lanes.get(shelf) ?? []
        lanes.set(shelf, shelfLanes)
        let lane = shelfLanes.findIndex((placed) =>
          placed.every((other) => Math.abs(other - along) >= 0.16),
        )
        if (lane === -1) lane = Math.min(shelfLanes.length, 2)
        shelfLanes[lane] = [...(shelfLanes[lane] ?? []), along]
        const placement = new THREE.Matrix4().compose(
          entry.slot.position
            .clone()
            .addScaledVector(facing, 0.066)
            .setY(entry.slot.position.y - 0.117 - lane * 0.046),
          turn.setFromAxisAngle(
            THREE.Object3D.DEFAULT_UP,
            Math.atan2(facing.x, facing.z),
          ),
          unit,
        )
        this.tagBatch.setMatrixAt(slot, this.hiddenInstance)
        this.runDecor[entry.run].push({
          mesh: this.tagBatch,
          slot,
          placement,
        })
      }
      this.tagBatch.frustumCulled = false
      this.tagBatch.matrixAutoUpdate = false
      this.scene.add(this.tagBatch)
      this.uploadTexture(this.tagArray)

      const spans = new Map<
        string,
        { genre: string; run: number; first: number; last: number }
      >()
      for (const section of sections) {
        const levels = this.runs[section.run].levels.length
        const first = Math.floor(section.start / levels)
        const last = Math.floor(section.end / levels)
        const key = `${section.run}:${section.genre}`
        const span = spans.get(key)
        if (span) {
          span.first = Math.min(span.first, first)
          span.last = Math.max(span.last, last)
        } else {
          spans.set(key, {
            genre: section.genre,
            run: section.run,
            first,
            last,
          })
        }
      }
      const headers = [...spans.values()].flatMap((span) => {
        const run = this.runs[span.run]
        const levels = run.levels.length
        const near = run.fill[span.first * levels]
        const far = run.fill[span.last * levels]
        return Math.abs(near.position.z - far.position.z) + this.slotWidth >=
          1.3
          ? [{ genre: span.genre, run: span.run, near, far }]
          : []
      })
      if (headers.length > 0) {
        const headerLayers = new THREE.InstancedBufferAttribute(
          new Float32Array(headers.map((entry) => genres.indexOf(entry.genre))),
          1,
        )
        const headerMaterial = new THREE.MeshBasicMaterial()
        headerMaterial.colorNode = texture(this.tagArray, uv()).depth(
          varying(instancedBufferAttribute<"float">(headerLayers)).round(),
        )
        this.headerBatch = new THREE.InstancedMesh(
          this.headerGeometry,
          headerMaterial,
          headers.length,
        )
        for (const [slot, entry] of headers.entries()) {
          const facing = entry.near.facing
          const placement = new THREE.Matrix4().compose(
            entry.near.position
              .clone()
              .addScaledVector(facing, 0.06)
              .setY(2.22)
              .setZ((entry.near.position.z + entry.far.position.z) / 2),
            turn.setFromAxisAngle(
              THREE.Object3D.DEFAULT_UP,
              Math.atan2(facing.x, facing.z),
            ),
            unit,
          )
          this.headerBatch.setMatrixAt(slot, this.hiddenInstance)
          this.runDecor[entry.run].push({
            mesh: this.headerBatch,
            slot,
            placement,
          })
        }
        this.headerBatch.frustumCulled = false
        this.headerBatch.matrixAutoUpdate = false
        this.scene.add(this.headerBatch)
      }
    }

    if (strips.length > 0) {
      const glow = new Float32Array(strips.length * 3)
      const material = new THREE.MeshStandardMaterial({ roughness: 0.6 })
      const glowing = new THREE.InstancedBufferAttribute(glow, 3)
      material.emissiveNode = varying(instancedBufferAttribute<"vec3">(glowing))
      this.stripBatch = new THREE.InstancedMesh(
        this.stripGeometry,
        material,
        strips.length,
      )
      const shade = new THREE.Color()
      const still = new THREE.Quaternion()
      for (const [slot, entry] of strips.entries()) {
        const hue = genreHue(entry.genre) / 360
        this.stripBatch.setColorAt(slot, shade.setHSL(hue, 0.62, 0.46))
        shade.setHSL(hue, 0.62, 0.22).toArray(glow, slot * 3)
        const placement = new THREE.Matrix4().compose(
          entry.near.position
            .clone()
            .addScaledVector(entry.near.facing, 0.056)
            .setY(entry.near.position.y - 0.104)
            .setZ((entry.near.position.z + entry.far.position.z) / 2),
          still,
          new THREE.Vector3(
            1,
            1,
            Math.abs(entry.near.position.z - entry.far.position.z) +
              this.slotWidth,
          ),
        )
        this.stripBatch.setMatrixAt(slot, this.hiddenInstance)
        this.runDecor[entry.run].push({
          mesh: this.stripBatch,
          slot,
          placement,
        })
      }
      this.stripBatch.frustumCulled = false
      this.stripBatch.matrixAutoUpdate = false
      this.scene.add(this.stripBatch)
    }
  }

  // TODO: Validate
  /**
   * Return a texture array with one genre tag image per layer.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private buildTagArray(genres: string[]) {
    const layerSize = 512 * 128 * 4
    const row = 512 * 4
    const data = new Uint8Array(layerSize * genres.length)
    for (const [layer, genre] of genres.entries()) {
      const pixels = createTagCanvas(genre)
        .getContext("2d")
        ?.getImageData(0, 0, 512, 128).data
      if (!pixels) continue
      for (let line = 0; line < 128; line++) {
        data.set(
          pixels.subarray(line * row, (line + 1) * row),
          layer * layerSize + (127 - line) * row,
        )
      }
    }
    const tags = new THREE.DataArrayTexture(data, 512, 128, genres.length)
    tags.colorSpace = THREE.SRGBColorSpace
    tags.magFilter = THREE.LinearFilter
    tags.minFilter = THREE.LinearMipmapLinearFilter
    tags.generateMipmaps = true
    tags.anisotropy = 4
    tags.needsUpdate = true
    return tags
  }

  // TODO: Validate
  /**
   * Set each aisle sign's left and right genre lists from its runs and repaint
   * the visible ones.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private postSigns(entries: string[][]) {
    for (const sign of this.aisleSigns) {
      sign.left = []
      sign.right = []
    }
    for (let runIndex = 0; runIndex < this.runs.length; runIndex++) {
      const run = this.runs[runIndex]
      if (run.aisle === null) continue
      const sign = this.aisleSigns[run.aisle]
      const listed = entries[runIndex]
      if (run.side === "left") sign.left = listed
      else sign.right = listed
    }
    for (const [index, sign] of this.aisleSigns.entries()) {
      sign.dirty = true
      if (this.visibleSigns.has(index)) this.refreshSign(sign)
    }
  }

  // TODO: Validate
  /**
   * Assign the wall posters a shuffled pick of the most popular titles that
   * have images.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private dressPosters() {
    const seen = new Set<string>()
    const candidates: StoreTitle[] = []
    for (const title of this.allTitles) {
      if (!title.image || seen.has(title.id)) continue
      seen.add(title.id)
      candidates.push(title)
    }
    if (candidates.length === 0) return

    // TODO: Validate
    /**
     * Return a title's TMDB popularity, or -1 when it has none.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const popularity = (title: StoreTitle) => title.tmdbPopularity ?? -1
    candidates.sort((left, right) => popularity(right) - popularity(left))
    const picks = candidates.slice(
      0,
      Math.max(Math.ceil(candidates.length * 0.1), this.posters.length),
    )
    for (let index = picks.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1))
      ;[picks[index], picks[swap]] = [picks[swap], picks[index]]
    }

    for (const [index, poster] of this.posters.entries()) {
      const title = picks[index % picks.length]
      if (!title || poster.userData.title === title) continue
      poster.userData = {
        title,
        painted: false,
        basePosition: poster.position.clone(),
        facing: new THREE.Vector3(
          Math.sin(poster.rotation.y),
          0,
          Math.cos(poster.rotation.y),
        ),
        material: poster.material,
      }
    }
    this.updatePosters()
  }

  // TODO: Validate
  /**
   * Download a title's image, or its poster or backdrop from the title details
   * when full posters are on, and paint it onto a wall poster.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private async paintPoster(poster: THREE.Mesh, title: StoreTitle) {
    const full = this.fullPosters
    let source = title.image
    let isPoster = title.isPoster
    if (full) {
      const detail = await fetchTitleDetail(title.id, this.metadata)
      if (this.disposed) return
      const posterImage = detail.poster ?? (title.isPoster ? title.image : null)
      source = posterImage ?? detail.backdrop ?? title.image
      isPoster = Boolean(posterImage)
    }
    if (!source) return
    // TODO: Validate
    /**
     * Paint the loaded image onto the poster unless the store was disposed, the
     * poster setting changed, or the poster now shows another title.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const finish = (loaded: HTMLImageElement | null) => {
      if (
        this.disposed ||
        !loaded ||
        full !== this.fullPosters ||
        poster.userData.title !== title
      ) {
        return
      }
      const canvas = createCaseCanvas(
        { ...title, isPoster },
        loaded,
        Math.max(3, loaded.naturalWidth / 168),
        true,
      )
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 4
      const material = poster.material as THREE.MeshStandardMaterial
      material.map?.dispose()
      material.map = texture
      material.color.set(0xffffff)
      material.needsUpdate = true
    }
    finish(await loadStoreImage(source, "w780"))
  }

  // TODO: Validate
  /**
   * Run the action of a clicked button: open filters, swing a door, load
   * counter covers, create or add a channel, or toggle a run's covers.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private trigger(mesh: THREE.Mesh) {
    if (mesh.userData.toggle === "filters") {
      if (!this.touch) this.exit()
      this.callbacks.onFilters()
      return
    }
    if (mesh.userData.toggle === "door") {
      const leaf = this.doorLeaves[mesh.userData.leaf as number]
      const position = this.camera.position
      if (
        leaf.open &&
        this.playerMovement.overlaps(leaf.collider, position.x, position.z)
      ) {
        return
      }
      leaf.open = !leaf.open
      return
    }
    if (mesh.userData.toggle === "counter-covers") {
      for (const held of this.counterCases) this.queueImage(held)
      for (let concurrent = 0; concurrent < 32; concurrent++)
        this.coverDownloadQueue.nextImage()
      return
    }
    if (mesh.userData.toggle === "create-channel") {
      if (!this.touch) this.exit()
      this.callbacks.onChannelAction("create")
      return
    }
    if (mesh.userData.toggle === "add-channel") {
      if (!this.touch) this.exit()
      this.callbacks.onChannelAction("add")
      return
    }
    if (mesh.userData.toggle === "tv") {
      this.tvTrailerPlayer.startTvVideo()
      return
    }
    if (mesh.userData.toggle === "tv-title") {
      if (!this.couchCaseTitle) return
      if (!this.touch) this.exit()
      this.callbacks.onActivate(this.couchCaseTitle)
      return
    }
    if (mesh.userData.toggle === "tv-back") {
      this.tvTrailerPlayer.seekTvVideo(-10)
      return
    }
    if (mesh.userData.toggle === "tv-forward") {
      this.tvTrailerPlayer.seekTvVideo(10)
      return
    }
    if (mesh.userData.toggle === "tv-pause") {
      this.tvTrailerPlayer.toggleTvVideoPaused()
      return
    }
    if (mesh.userData.toggle === "tv-stop") {
      this.tvTrailerPlayer.stopTvVideo()
      this.showCouchCase(null)
      return
    }
    if (mesh.userData.toggle === "trailer-next") {
      this.tvTrailerPlayer.stepTvTrailer(1)
      return
    }
    if (mesh.userData.toggle === "trailer-previous") {
      this.tvTrailerPlayer.stepTvTrailer(-1)
      return
    }
    if (mesh.userData.toggle === "trailer-counter") {
      const shownTrailer = this.tvTrailerPlayer.shownTvTrailer()
      if (shownTrailer) this.callbacks.onTakeToCounter(shownTrailer.title)
      return
    }
    if (mesh.userData.toggle === "couch") {
      this.playerMovement.sitOnCouch()
      this.camera.position.copy(this.couchSeatedPosition)
      this.camera.lookAt(this.couchLookTarget)
      return
    }
    const runIndex = mesh.userData.run as number
    if (this.revealedRuns.has(runIndex)) this.conceal(runIndex)
    else this.reveal(runIndex)
  }

  // TODO: Validate
  setTvTrailers(tvTrailers: Array<{ title: StoreTitle; url: string }>) {
    this.tvTrailerPlayer.setTvTrailers(tvTrailers)
  }

  // TODO: Validate
  /**
   * Lay the case of the title whose trailer is playing on the couch beside the
   * seat, face up and turned to read upright from the seat give or take up to
   * 45 degrees, and show its name above the TV, or clear both when given null.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private showCouchCase(title: StoreTitle | null) {
    if (title?.id === this.couchCaseTitle?.id) return
    this.couchCaseTitle = title
    if (this.couchCaseSlot) {
      const seatToCase = this.couchCaseSlot.position
        .clone()
        .sub(this.couchSeatedPosition)
      this.couchCaseTurn =
        Math.atan2(-seatToCase.x, -seatToCase.z) +
        (Math.random() - 0.5) * (Math.PI / 2)
    }
    if (this.tvTitleSign) {
      const tvTitleSignMaterial = this.tvTitleSign.material
      tvTitleSignMaterial.map?.dispose()
      tvTitleSignMaterial.map = title ? createLabelTexture(title.name) : null
      tvTitleSignMaterial.needsUpdate = true
      this.tvTitleSign.visible = title !== null
      if (title) this.tvTitleSign.layers.enableAll()
      else this.tvTitleSign.layers.disableAll()
    }
    this.setCounter(this.counterTitles)
    const couchCase = this.counterCases[this.counterTitles.length]
    if (!couchCase || couchCase.userData.material) return
    this.queueImage(couchCase)
    this.coverDownloadQueue.nextImage()
  }

  // TODO: Validate
  /**
   * Position a run's cover loader buttons above the shelf or down by the floor
   * depending on whether its covers are loaded.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private placeLoaderButton(runIndex: number) {
    const run = this.runs[runIndex]
    const revealed = this.revealedRuns.has(runIndex)
    for (const button of this.loaderButtons) {
      if (button.userData.run !== runIndex) continue
      const slot = run.endcap
        ? run.levels[0][1]
        : button.userData.end === "front"
          ? run.order[0]
          : run.levels[run.levels.length - 1][0]
      button.position
        .copy(slot.position)
        .addScaledVector(slot.facing, revealed ? 0.1 : 0.42)
        .setY(revealed ? 0.14 : 1.58)
      button.updateMatrix()
    }
    this.showLoaderButtons(runIndex)
  }

  // TODO: Validate
  /**
   * Mark a run's covers as loaded, rebatch it for covers, and queue its cover
   * images.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private reveal(runIndex: number) {
    this.revealedRuns.add(runIndex)
    this.placeLoaderButton(runIndex)
    this.unbatchRun(runIndex)
    if (this.mountedRuns.has(runIndex)) this.batchRun(runIndex)
    if (this.autoLoadImages) return
    for (const mesh of this.runMeshes[runIndex]) this.queueImage(mesh)
    for (let concurrent = 0; concurrent < 32; concurrent++)
      this.coverDownloadQueue.nextImage()
  }

  // TODO: Validate
  /**
   * Turn automatic cover loading on or off, hiding the cover buttons while it
   * is on.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setAutoLoadImages(enabled: boolean) {
    if (enabled === this.autoLoadImages) return
    this.autoLoadImages = enabled
    for (const button of this.counterCoverButtons) {
      button.visible = !enabled
      if (enabled) button.layers.disableAll()
      else button.layers.enableAll()
    }
    this.cullRuns()
    if (enabled) this.autoLoad()
  }

  // TODO: Validate
  /**
   * Turn title logos on covers on or off and repaint the covers.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setImageLogos(enabled: boolean) {
    if (enabled === this.imageLogos) return
    this.imageLogos = enabled
    this.repaintCovers()
  }

  // TODO: Validate
  /**
   * Reload every loaded run's covers and the counter covers so they pick up
   * changed cover settings.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private repaintCovers() {
    for (const index of [...this.revealedRuns]) {
      this.conceal(index)
      this.reveal(index)
    }
    for (const held of this.counterCases) {
      delete held.userData.imageQueued
      this.queueImage(held)
    }
    this.autoLoad()
    for (let concurrent = 0; concurrent < 32; concurrent++)
      this.coverDownloadQueue.nextImage()
  }

  // TODO: Validate
  /**
   * When automatic cover loading is on, unload covers of distant runs, load
   * covers for at most one new nearby run in view, and queue wanted covers.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private autoLoad() {
    if (!this.autoLoadImages) return
    const position = this.camera.position
    const reach = 5
    let revealedOne = false
    for (const [index, box] of this.runBoxes.entries()) {
      const distance = box.distanceToPoint(position)
      if (!this.mountedRuns.has(index) || distance > 8) {
        if (this.revealedRuns.has(index)) this.conceal(index)
        continue
      }
      if (distance > reach || !this.viewFrustum.intersectsBox(box)) continue
      const meshes = this.runMeshes[index].filter((mesh) =>
        this.coverWanted(mesh),
      )
      if (meshes.length === 0) continue
      if (!this.revealedRuns.has(index)) {
        if (revealedOne) continue
        this.reveal(index)
        revealedOne = true
      }
      for (const mesh of meshes) this.queueImage(mesh)
    }
    for (const held of this.counterCases) this.queueImage(held)
    for (let concurrent = 0; concurrent < 32; concurrent++)
      this.coverDownloadQueue.nextImage()
  }

  // TODO: Validate
  /**
   * Unload a run's covers, put its cases back on placeholder materials, and
   * rebatch it.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private conceal(runIndex: number) {
    this.revealedRuns.delete(runIndex)
    this.placeLoaderButton(runIndex)
    for (const mesh of this.runMeshes[runIndex]) {
      this.clearCover(mesh)
      const placeholder = this.placeholderMaterial(
        mesh.userData.title as StoreTitle,
      )
      if (mesh === this.focused) this.dressHighlight(mesh)
      else mesh.material = placeholder
    }
    this.unbatchRun(runIndex)
    if (this.mountedRuns.has(runIndex)) this.batchRun(runIndex)
  }

  // TODO: Validate
  /**
   * Return how far a focused case slides out of its shelf, which is farther for
   * spine-out cases in condensed mode.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private focusSlide(mesh: THREE.Mesh) {
    return this.condensed && !this.counterCases.includes(mesh)
      ? this.condensedPullOut * this.caseScale
      : this.pullOut
  }

  // TODO: Validate
  /**
   * Set how far focused cases slide out, as percentages, and move the focused
   * case to match.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setPullOut(standard: number, condensed: number) {
    this.pullOut = standard / 100
    this.condensedPullOut = condensed / 100
    const mesh = this.focused
    if (!mesh?.userData.basePosition) return
    mesh.position
      .copy(mesh.userData.basePosition as THREE.Vector3)
      .addScaledVector(
        mesh.userData.facing as THREE.Vector3,
        this.focusSlide(mesh),
      )
    mesh.updateMatrix()
    this.batchCase(mesh, true)
  }

  // TODO: Validate
  /**
   * Position and rotate a case in its slot with its seeded tilt and nudge
   * scaled by the askew setting, turned spine out in condensed mode.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private settleCase(mesh: THREE.Mesh, slot: Slot) {
    if (slot.facing.y > 0.5) {
      mesh.userData.slot = slot.position.clone()
      mesh.userData.basePosition = slot.position.clone()
      mesh.userData.facing = slot.facing.clone()
      mesh.position.copy(slot.position)
      if (mesh === this.focused) {
        mesh.position.addScaledVector(slot.facing, this.focusSlide(mesh))
      }
      mesh.rotation.set(-Math.PI / 2, mesh.userData.lyingTurn as number, 0)
      mesh.updateMatrix()
      this.batchCase(mesh, mesh.visible)
      return
    }
    const strength = this.askew * this.askew
    const spin = mesh.userData.spin as THREE.Vector3
    const drift = mesh.userData.drift as THREE.Vector3
    mesh.userData.slot = slot.position.clone()
    mesh.userData.basePosition = slot.position
      .clone()
      .setY(slot.position.y + 0.092 * (this.caseScale - 1))
      .addScaledVector(drift, 0.06 * strength)
    mesh.userData.facing = slot.facing.clone()
    mesh.position.copy(mesh.userData.basePosition as THREE.Vector3)
    if (mesh === this.focused) {
      mesh.position.addScaledVector(slot.facing, this.focusSlide(mesh))
    }
    const spineOut = this.condensed && !this.counterCases.includes(mesh)
    mesh.rotation.x = (spineOut ? 0 : -0.349) + spin.x * 0.6 * strength
    mesh.rotation.y =
      Math.atan2(slot.facing.x, slot.facing.z) +
      (spineOut ? Math.PI / 2 : 0) +
      spin.y * 0.6 * strength
    mesh.rotation.z = spin.z * 0.6 * strength
    mesh.updateMatrix()
    this.batchCase(mesh, mesh.visible)
  }

  // TODO: Validate
  /**
   * Register a case material so lighting and reflection settings apply to it,
   * remembering its original roughness and metalness.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private trackCase<
    T extends THREE.MeshStandardMaterial | THREE.MeshBasicMaterial,
  >(material: T) {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.userData.roughness = material.roughness
      material.userData.metalness = material.metalness
      if (!this.reflections) {
        material.roughness = 1
        material.metalness = 0
      }
    }
    this.caseMaterials.add(material)
    return material
  }

  // TODO: Validate
  /**
   * Return the current case format.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  caseFormat() {
    return this.format
  }

  // TODO: Validate
  setRain(drops: number, speed: number) {
    this.rain?.setRain(drops, speed)
  }

  // TODO: Validate
  /**
   * Flatten the terrain around the store and lot, blending back to the original
   * heights over the blend distance, and recompute its normals and height
   * range.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private levelTerrain(
    terrain: TerrainGenerator,
    clearX: number,
    clearBack: number,
    clearFront: number,
    blend: number,
  ) {
    const { heights, gridSize: grid, geometry, minY: base } = terrain
    if (!heights || !grid || !geometry || base === undefined) return
    const segments = grid - 1
    const size = terrain.parameters.size
    const half = size / 2
    const cellSize = size / segments

    for (let indexZ = 0; indexZ < grid; indexZ++) {
      const worldZ = (indexZ / segments) * size - half
      const outsideZ = Math.max(clearBack - worldZ, worldZ - clearFront)
      for (let indexX = 0; indexX < grid; indexX++) {
        const worldX = (indexX / segments) * size - half
        const outsideX = Math.abs(worldX) - clearX
        const ramp = Math.min(
          1,
          Math.max(0, Math.max(outsideX, outsideZ)) / blend,
        )
        const offset = indexZ * grid + indexX
        heights[offset] =
          (heights[offset] - base) * ramp * ramp * (3 - 2 * ramp)
      }
    }

    const position = geometry.getAttribute("position")
    const normal = geometry.getAttribute("normal")
    let lowest = Infinity
    let highest = -Infinity
    for (let indexZ = 0; indexZ < grid; indexZ++) {
      const back = Math.max(0, indexZ - 1)
      const front = Math.min(grid - 1, indexZ + 1)
      for (let indexX = 0; indexX < grid; indexX++) {
        const offset = indexZ * grid + indexX
        const height = heights[offset]
        position.setY(offset, height)
        const left = Math.max(0, indexX - 1)
        const right = Math.min(grid - 1, indexX + 1)
        const slopeX =
          (heights[indexZ * grid + left] - heights[indexZ * grid + right]) /
          ((right - left) * cellSize)
        const slopeZ =
          (heights[back * grid + indexX] - heights[front * grid + indexX]) /
          ((front - back) * cellSize)
        const length = Math.hypot(slopeX, 1, slopeZ)
        normal.setXYZ(offset, slopeX / length, 1 / length, slopeZ / length)
        if (height < lowest) lowest = height
        if (height > highest) highest = height
      }
    }
    position.needsUpdate = true
    normal.needsUpdate = true
    geometry.computeBoundingSphere()
    terrain.minY = lowest
    terrain.maxY = highest
    terrain.minHeight.value = lowest
    terrain.maxHeight.value = highest
  }

  // TODO: Validate
  /**
   * Make outdoor materials in the group ignore fog and emissive glow and light
   * them only by the sky and moon.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private dressOutdoors(group: THREE.Object3D) {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      for (const material of materials) {
        if (this.dressed.has(material)) continue
        this.dressed.add(material)
        const lit = material as THREE.MeshStandardMaterial & { fog: boolean }
        lit.fog = false
        lit.emissive?.setHex(0x000000)
        lit.lightsNode = lights([this.skyLight, this.moonLight])
      }
    })
  }

  // TODO: Validate
  /**
   * Set the brightness of the moon, sky, and pool light outside.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setOutdoorLights(level: number) {
    this.moonLight.intensity = level * 0.55
    this.skyLight.intensity = level * 0.5
    if (this.poolMaterial) this.poolMaterial.opacity = level * 0.25
  }

  // TODO: Validate
  setCheatCode(code: string) {
    this.parkingLot?.setCheatCode(code)
  }

  // TODO: Validate
  /**
   * Set how crooked cases and parked cars sit and reposition them.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setAskew(value: number) {
    this.askew = value / 50
    for (const mesh of [...this.mountedCases(), ...this.counterCases]) {
      const slot = mesh.userData.slot as THREE.Vector3 | undefined
      if (!slot) continue
      this.settleCase(mesh, {
        position: slot,
        facing: mesh.userData.facing as THREE.Vector3,
      })
    }
    for (const batches of this.runBatches.values()) {
      for (const { mesh } of batches) mesh.computeBoundingSphere()
    }
    this.parkingLot?.setAskew(this.askew)
  }

  // TODO: Validate
  /**
   * Turn wider spine-out cases on or off and rebuild the case geometry.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setWiderCases(enabled: boolean) {
    if (enabled === this.widerCases) return
    this.widerCases = enabled
    this.setFormat(this.format)
  }

  // TODO: Validate
  /**
   * Turn condensed spine-out shelving on or off, rebuild the case geometry, and
   * reposition the shelved cases.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setCondensed(enabled: boolean) {
    if (enabled === this.condensed) return
    this.condensed = enabled
    this.setFormat(this.format)
    for (const mesh of this.mountedCases()) {
      const slot = mesh.userData.slot as THREE.Vector3 | undefined
      if (!slot) continue
      this.settleCase(mesh, {
        position: slot,
        facing: mesh.userData.facing as THREE.Vector3,
      })
    }
    for (const batches of this.runBatches.values()) {
      for (const { mesh } of batches) mesh.computeBoundingSphere()
    }
  }

  // TODO: Validate
  /**
   * Show or hide the stats panel.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setFps(visible: boolean) {
    this.statsPanel.style.display = visible ? "flex" : "none"
  }

  // TODO: Validate
  /**
   * Turn full poster art on wall posters on or off and repaint them.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setFullPosters(full: boolean) {
    if (full === this.fullPosters) return
    this.fullPosters = full
    for (const poster of this.posters) poster.userData.painted = false
    this.updatePosters()
  }

  // TODO: Validate
  /**
   * Set how many point lights follow the camera between the ceiling lamps.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setLampCount(count: number) {
    const target = Math.min(count, this.lampAnchors.length)
    while (this.lampPool.length < target) {
      const bulb = new THREE.PointLight(0xfff3e0, 1.3, 11, 2)
      this.lampPool.push(bulb)
      this.scene.add(bulb)
    }
    for (const bulb of this.lampPool.splice(target)) {
      this.scene.remove(bulb)
      bulb.dispose()
    }
    this.moveLights()
  }

  // TODO: Validate
  /**
   * Set the indoor light level across the ambient light, lamps, glow,
   * diffusers, and ceiling.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setLights(level: number) {
    const strength = level
    this.lightLevel = strength
    this.indoorLight.intensity = 0.45 * Math.min(strength, 2)
    this.moveLights()
    if (this.glowMaterial) {
      this.glowMaterial.opacity = Math.min(strength, 1) * 0.16
    }
    this.diffuserMaterial?.color.setScalar(Math.min(strength, 1))
    this.ceilingMaterial?.emissive
      .setHex(0x6e6f76)
      .multiplyScalar(Math.min(strength, 1))
  }

  // TODO: Validate
  /**
   * Switch the case format, rebuilding the case geometry and scale for every
   * shelved case and repainting covers when the spine width changes.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setFormat(format: number) {
    this.format = format
    const scale = format === 2 ? 0.168 / 0.135 : 1
    const depth =
      format === 3
        ? 0.09
        : format === 1
          ? 0.028
          : this.condensed && this.widerCases
            ? 0.028 / scale
            : 0.015
    const replacement = buildCaseGeometry(
      format === 1 ? 0.105 : 0.135,
      0.19,
      depth,
    )
    const repaint = depth / 0.19 !== this.spineRatio
    this.spineRatio = depth / 0.19
    const previous = this.caseGeometry
    this.caseGeometry = replacement
    this.caseScale = scale
    const lift = 0.092 * (this.caseScale - 1)
    for (const mesh of this.mountedCases()) {
      mesh.geometry = replacement
      mesh.scale.setScalar(this.caseScale)
      const slot = mesh.userData.slot as THREE.Vector3 | undefined
      if (slot) {
        const base = slot.clone().setY(slot.y + lift)
        mesh.userData.basePosition = base
        mesh.position.copy(base)
        if (mesh === this.focused) {
          mesh.position.addScaledVector(
            mesh.userData.facing as THREE.Vector3,
            this.focusSlide(mesh),
          )
        }
      }
      mesh.updateMatrix()
      this.batchCase(mesh, mesh.visible)
    }
    for (const batches of this.runBatches.values()) {
      for (const { mesh } of batches) {
        mesh.geometry = replacement
        mesh.computeBoundingSphere()
      }
    }
    previous.dispose()
    if (repaint) this.repaintCovers()
  }

  // TODO: Validate
  /**
   * Show or hide the create and add channel buttons and make them clickable to
   * match.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setChannelButtons(enabled: boolean) {
    for (const button of this.channelButtons) {
      button.visible = enabled
      if (enabled) button.layers.enableAll()
      else button.layers.disableAll()
    }
  }

  // TODO: Validate
  /**
   * Replace the cases on the counter with the given titles, reusing any covers
   * already loaded for them.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setCounter(titles: StoreTitle[]) {
    if (this.counterStep === 0) return
    this.counterTitles = titles
    const loaded = new Map<string, THREE.Material>()
    for (const mesh of this.counterCases) {
      const material = mesh.userData.material as THREE.Material | undefined
      if (material) loaded.set((mesh.userData.title as StoreTitle).id, material)
      this.scene.remove(mesh)
    }
    this.counterCases = []
    for (const title of this.couchCaseTitle
      ? [...titles, this.couchCaseTitle]
      : titles) {
      const shelved = this.mountedCases().find(
        (mesh) => (mesh.userData.title as StoreTitle).id === title.id,
      )
      const existingMaterial =
        (shelved?.userData.material as THREE.Material | undefined) ??
        loaded.get(title.id)
      const mesh = new THREE.Mesh(
        this.caseGeometry,
        existingMaterial ?? this.placeholderMaterial(title),
      )
      mesh.matrixAutoUpdate = false
      mesh.scale.setScalar(this.caseScale)
      mesh.rotation.order = "YXZ"
      mesh.userData = {
        title,
        basePosition: new THREE.Vector3(),
        facing: new THREE.Vector3(0, 0, 1),
        spin: randomOffset(),
        drift: randomOffset(),
        material: existingMaterial,
      }
      this.scene.add(mesh)
      this.counterCases.push(mesh)
    }
    for (const [index, held] of this.counterCases.entries()) {
      if (index === titles.length && this.couchCaseSlot) {
        held.userData.lyingTurn = this.couchCaseTurn
        held.userData.coverAlwaysWanted = true
        this.settleCase(held, this.couchCaseSlot)
        continue
      }
      const row = Math.min(
        this.counterRows.length - 1,
        Math.floor(index / this.counterCapacity),
      )
      const anchor = this.counterRows[row]
      const within = index - row * this.counterCapacity
      this.settleCase(held, {
        position: anchor.clone().setX(anchor.x - this.counterStep * within),
        facing: new THREE.Vector3(0, 0, -1),
      })
    }
    this.applyLod()
  }

  // TODO: Validate
  /**
   * Return a tracked case material for a cover texture, unlit or lit to match
   * the current setting.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private caseMaterial(texture: THREE.Texture) {
    return this.trackCase(
      this.unlit
        ? new THREE.MeshBasicMaterial({
            map: texture,
            color: new THREE.Color().setScalar(this.unlitBrightness.value),
          })
        : new THREE.MeshStandardMaterial({
            map: texture,
            emissiveMap: texture,
            emissive: 0xffffff,
            emissiveIntensity: 0,
            roughness: 0.42,
            metalness: 0.06,
          }),
    )
  }

  // TODO: Validate
  /**
   * Switch case covers between unlit and lit materials.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setUnlit(enabled: boolean) {
    if (enabled === this.unlit) return
    this.unlit = enabled
    for (const mesh of this.mountedCases()) {
      const texture = mesh.userData.texture as THREE.Texture | undefined
      if (!texture) continue
      const previous = mesh.userData.material as
        | THREE.MeshStandardMaterial
        | THREE.MeshBasicMaterial
        | undefined
      if (previous) {
        this.caseMaterials.delete(previous)
        previous.dispose()
      }
      mesh.userData.material = this.caseMaterial(texture)
      if (mesh === this.focused) this.dressHighlight(mesh)
      else mesh.material = mesh.userData.material as THREE.Material
    }
    for (const batches of this.runBatches.values()) {
      for (const { mesh: batch, covers } of batches) {
        if (!covers) continue
        const previous = batch.material as
          | THREE.MeshStandardMaterial
          | THREE.MeshBasicMaterial
        this.caseMaterials.delete(previous)
        previous.dispose()
        batch.material = this.coverMaterial(covers)
      }
    }
  }

  // TODO: Validate
  /**
   * Set the brightness of unlit case covers as a percentage.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setUnlitBrightness(percent: number) {
    this.unlitBrightness.value = percent / 100
    for (const material of this.caseMaterials) {
      if (material instanceof THREE.MeshBasicMaterial && material.map) {
        material.color.setScalar(percent / 100)
      }
    }
  }

  // TODO: Validate
  /**
   * Turn case reflections on or off by restoring or flattening each case
   * material's roughness and metalness.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setReflections(enabled: boolean) {
    this.reflections = enabled
    for (const material of this.caseMaterials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      material.roughness = enabled ? (material.userData.roughness as number) : 1
      material.metalness = enabled ? (material.userData.metalness as number) : 0
      material.needsUpdate = true
    }
  }

  // TODO: Validate
  /**
   * Return the shared placeholder material for a title, colored by a hue bucket
   * derived from its id.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private placeholderMaterial(title: StoreTitle) {
    const bucket = Math.floor(genreHue(title.id) / 15)
    let material = this.placeholderMaterials.get(bucket)
    if (!material) {
      material = this.trackCase(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL((bucket * 15) / 360, 0.4, 0.26),
          roughness: 0.55,
          metalness: 0.04,
        }),
      )
      this.placeholderMaterials.set(bucket, material)
    }
    return material
  }

  // TODO: Validate
  /**
   * Return whether a mesh is within reach, faces the camera, and is in view, so
   * its cover is worth loading.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private coverWanted(mesh: THREE.Mesh, radius = 0.2, reach = 5) {
    if (mesh.userData.coverAlwaysWanted) return true
    const toCamera = this.toCamera.copy(this.camera.position).sub(mesh.position)
    const facing = mesh.userData.facing as THREE.Vector3 | undefined
    return (
      toCamera.length() <= reach &&
      (!facing || facing.dot(toCamera) > 0) &&
      this.viewFrustum.intersectsSphere(
        this.coverSphere.set(mesh.position, radius),
      )
    )
  }

  // TODO: Validate
  /**
   * Queue a case's cover image download if it has an image and is wanted,
   * painting it onto the case when it arrives.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private queueImage(mesh: THREE.Mesh) {
    const title = mesh.userData.title as StoreTitle
    const image = title.image
    if (!image || mesh.userData.imageQueued || !this.coverWanted(mesh)) return
    mesh.userData.imageQueued = true
    const generation = mesh.userData.generation as number
    this.coverDownloadQueue.enqueue(
      mesh,
      () =>
        Promise.all([
          loadStoreImage(image, "w154"),
          this.imageLogos ? loadStoreImage(title.logo, "w154") : null,
        ]),
      ([loaded, logo]) => {
        const current = mesh.userData.generation === generation
        if (this.disposed || !loaded || !current) return
        const texture = this.paintCover(mesh, title, loaded, logo)
        mesh.userData.texture = texture
        mesh.userData.material = this.caseMaterial(texture)
        for (const held of this.counterCases) {
          if ((held.userData.title as StoreTitle).id === title.id) {
            held.material = mesh.userData.material as THREE.Material
          }
        }
        if (mesh === this.focused) this.dressHighlight(mesh)
        else mesh.material = mesh.userData.material as THREE.Material
      },
    )
  }

  // TODO: Validate
  /**
   * Recompute the camera's view frustum used for visibility checks.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private updateViewFrustum() {
    this.camera.updateMatrixWorld()
    this.viewFrustum.setFromProjectionMatrix(
      this.viewProjection.multiplyMatrices(
        this.camera.projectionMatrix,
        this.camera.matrixWorldInverse,
      ),
    )
  }

  // TODO: Validate
  /**
   * Queue covers for nearby runs in view whose covers are loaded.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private loadVisibleCovers() {
    const position = this.camera.position
    for (const index of this.revealedRuns) {
      const box = this.runBoxes[index]
      if (
        !this.mountedRuns.has(index) ||
        box.distanceToPoint(position) > 5 ||
        !this.viewFrustum.intersectsBox(box)
      ) {
        continue
      }
      for (const mesh of this.runMeshes[index]) this.queueImage(mesh)
    }
    for (let concurrent = 0; concurrent < 32; concurrent++)
      this.coverDownloadQueue.nextImage()
  }

  // TODO: Validate
  private handleLock = () => {
    if (performance.now() >= this.viewHeldUntil) {
      this.heldView.copy(this.camera.quaternion)
    }
    this.viewHeldUntil = performance.now() + 300
    this.callbacks.onLockChange(true)
  }

  // TODO: Validate
  /**
   * Pause or resume movement, holding the camera's position and view while
   * paused.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setPaused(paused: boolean) {
    if (paused === this.paused) return
    this.paused = paused
    if (paused) {
      this.playerMovement.releaseKeys()
      this.playerMovement.setTouchMove(0, 0, false)
      this.heldPosition.copy(this.camera.position)
      this.heldView.copy(this.camera.quaternion)
      return
    }
    this.camera.position.copy(this.heldPosition)
    this.camera.quaternion.copy(this.heldView)
    this.viewHeldUntil = performance.now() + 300
  }

  // TODO: Validate
  private handleUnlock = () => {
    this.playerMovement.releaseKeys()
    this.callbacks.onLockChange(false)
  }

  // TODO: Validate
  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.controls.isLocked) return
    this.playerMovement.pressKey(event.code)
    if (event.code === "KeyE" && this.focused) {
      this.callbacks.onActivate(this.focused.userData.title as StoreTitle)
    }
  }

  // TODO: Validate
  private handleKeyUp = (event: KeyboardEvent) => {
    this.playerMovement.releaseKey(event.code)
  }

  // TODO: Validate
  private handleMouseDown = () => {
    if (
      this.controls.isLocked &&
      document.pointerLockElement &&
      performance.now() - this.lastExit > 400
    ) {
      this.activateFocused()
    }
  }

  // TODO: Validate
  private handleResize = () => {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (!width || !height) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.tvTrailerPlayer.resize(width, height)
  }

  // TODO: Validate
  /**
   * Focus whatever is under the crosshair when the camera has moved or turned
   * enough since the last check.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private updateFocus() {
    if (
      this.camera.position.distanceToSquared(this.lastFocusAt) < 0.0004 &&
      this.camera.quaternion.angleTo(this.lastFocusTurn) < 0.004
    ) {
      return
    }
    this.lastFocusAt.copy(this.camera.position)
    this.lastFocusTurn.copy(this.camera.quaternion)
    this.applyFocus(this.pick(0, 0, 3.2))
  }

  // TODO: Validate
  /**
   * Return the swatches, counter cases, buttons, posters, and shelved cases
   * close enough to be picked.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private pickTargets(far: number) {
    const reach = (far + 1.5) * (far + 1.5)
    const targets: THREE.Mesh[] = [...this.swatches, ...this.counterCases]
    // TODO: Validate
    /**
     * Return whether a mesh is visible and within picking reach of the camera.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const inReach = (mesh: THREE.Mesh) =>
      mesh.visible &&
      mesh
        .getWorldPosition(this.scratch)
        .distanceToSquared(this.camera.position) < reach
    for (const button of this.loaderButtons) {
      if (inReach(button)) targets.push(button)
    }
    for (const poster of this.posters) {
      if (inReach(poster)) targets.push(poster)
    }
    for (const index of this.mountedRuns) {
      if (
        !this.visibleRuns.has(index) ||
        this.runCenters[index].distanceToSquared(this.camera.position) >
          (far + 6) * (far + 6)
      ) {
        continue
      }
      for (const mesh of this.runMeshes[index]) {
        if (mesh.position.distanceToSquared(this.camera.position) < reach) {
          targets.push(mesh)
        }
      }
    }
    return targets
  }

  // TODO: Validate
  /**
   * Return the pickable mesh at the given screen point within the distance,
   * keeping the focused case if it is still hit and ignoring shelves.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private pick(x: number, y: number, far: number) {
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera)
    this.raycaster.far = far
    const hit = this.raycaster.intersectObjects(
      [
        ...this.pickTargets(far).filter(
          (mesh) => mesh !== this.focused || !mesh.userData.basePosition,
        ),
        ...this.shelves,
      ],
      false,
    )[0]
    const held = this.heldFocus(hit?.distance ?? Number.POSITIVE_INFINITY)
    if (held) return held
    if (!hit || this.shelves.includes(hit.object as THREE.InstancedMesh)) {
      return null
    }
    return hit.object as THREE.Mesh
  }

  // TODO: Validate
  /**
   * Return the focused case if the ray hits it at its resting position no
   * farther than the given distance, so a slid-out case does not lose focus.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private heldFocus(distance: number) {
    const mesh = this.focused
    if (!mesh?.userData.basePosition) return null
    const slid = mesh.position.clone()
    mesh.position.copy(mesh.userData.basePosition as THREE.Vector3)
    mesh.updateMatrix()
    mesh.updateMatrixWorld()
    const hit = this.raycaster.intersectObject(mesh, false)[0]
    mesh.position.copy(slid)
    mesh.updateMatrix()
    mesh.updateMatrixWorld()
    return hit && hit.distance <= distance ? mesh : null
  }

  // TODO: Validate
  /**
   * Put the highlight material on a case, carrying over its cover or
   * placeholder color.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private dressHighlight(mesh: THREE.Mesh) {
    const source = (mesh.userData.material ??
      this.placeholderMaterial(mesh.userData.title as StoreTitle)) as
      | THREE.MeshStandardMaterial
      | THREE.MeshBasicMaterial
      | undefined
    this.highlightMaterial.map = source?.map ?? null
    this.highlightMaterial.emissiveMap = source?.map ?? null
    this.highlightMaterial.emissiveIntensity =
      this.unlit && source?.map ? 1 : 0.3
    this.highlightMaterial.color.copy(
      source?.map
        ? new THREE.Color(0xffffff)
        : (source?.color ?? new THREE.Color()),
    )

    this.highlightMaterial.needsUpdate = true
    mesh.material = this.highlightMaterial
  }

  // TODO: Validate
  /**
   * Move focus to a mesh, returning the previous case to its slot and sliding
   * the new case out highlighted, and report the focused title.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private applyFocus(mesh: THREE.Mesh | null) {
    if (mesh === this.focused) return
    if (this.focused?.userData.basePosition) {
      const previous = this.focused
      previous.material = (previous.userData.material ??
        this.placeholderMaterial(
          previous.userData.title as StoreTitle,
        )) as THREE.Material
      previous.position.copy(previous.userData.basePosition as THREE.Vector3)
      previous.updateMatrix()
      this.batchCase(previous, false)
    }
    this.focused = mesh
    if (!mesh) {
      this.callbacks.onFocus(null)
      return
    }
    if (!mesh.userData.basePosition) {
      this.callbacks.onFocus(null)
      return
    }
    this.dressHighlight(mesh)
    mesh.position
      .copy(mesh.userData.basePosition as THREE.Vector3)
      .addScaledVector(
        mesh.userData.facing as THREE.Vector3,
        this.focusSlide(mesh),
      )
    mesh.updateMatrix()
    this.batchCase(mesh, true)
    this.callbacks.onFocus(mesh.userData.title as StoreTitle)
  }

  // TODO: Validate
  /**
   * Run the work and log a warning when it takes longer than two milliseconds.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private timed(label: string, work: () => void) {
    const started = performance.now()
    work()
    const spent = performance.now() - started
    if (spent > 2) console.warn(`[store] ${label} took ${spent.toFixed(1)} ms`)
  }

  // TODO: Validate
  private tick = () => {
    if (this.disposed) return
    this.animationHandle = requestAnimationFrame(this.tick)
    this.stats.update()
    const rawDelta = this.clock.getDelta()
    if (rawDelta > 0.03) {
      console.warn(`[store] frame gap ${(rawDelta * 1000).toFixed(1)} ms`)
    }
    const delta = Math.min(rawDelta, 0.1)
    if (
      !this.paused &&
      (this.touch ? this.touchActive : this.controls.isLocked)
    ) {
      this.playerMovement.move(delta)
      this.moveLights()
      this.lodCountdown -= 1
      if (this.lodCountdown <= 0) {
        this.lodCountdown = 4
        this.timed("updateLod", () => this.updateLod())
        this.timed("autoLoad", () => this.autoLoad())
        this.timed("loadVisibleCovers", () => this.loadVisibleCovers())
      }
      if (!this.touch) this.updateFocus()
    }
    this.rain?.fallRain(delta)
    this.parkingLot?.animateDeala(delta)
    for (const leaf of this.doorLeaves) {
      const target = leaf.open ? leaf.swing : 0
      const turn = leaf.group.rotation.y
      if (Math.abs(target - turn) > 0.001) {
        leaf.group.rotation.y = turn + (target - turn) * 0.16
      }
    }
    if (this.paused) this.camera.position.copy(this.heldPosition)
    if (this.paused || performance.now() < this.viewHeldUntil) {
      this.camera.quaternion.copy(this.heldView)
    }
    this.timed("mountQueued", () => this.mountQueued())
    this.timed("paintCovers", () => this.coverDownloadQueue.paintCovers())
    this.timed("flushCovers", () => this.flushCovers())
    this.renderer.info.reset()
    this.timed("render", () => this.renderer.render(this.scene, this.camera))
    this.tvTrailerPlayer.render(this.camera)
    const now = performance.now()
    if (now - this.drawCallsShownAt > 500) {
      this.drawCallsShownAt = now
      const drawCalls = this.renderer.info.render.drawCalls
      this.drawCallPeak = Math.max(this.drawCallPeak, drawCalls)
      this.drawCallPanel.update(drawCalls, Math.max(this.drawCallPeak * 1.2, 1))
      if (this.statsPanel.style.display !== "none") {
        this.distancePanel.textContent = this.pointedReadout() ?? "– m"
      }
    }
  }

  // TODO: Validate
  /**
   * Return the distance to whatever is under the crosshair within 20 meters as
   * text, or null when nothing is hit.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private pointedReadout() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    this.raycaster.far = 20
    const hit = this.raycaster.intersectObjects(
      [...this.pickTargets(20), ...this.shelves],
      false,
    )[0]
    if (!hit) return null
    if (this.shelves.includes(hit.object as THREE.InstancedMesh)) {
      return `${hit.distance.toFixed(2)} m`
    }
    const distance = hit.object
      .getWorldPosition(this.scratch)
      .distanceTo(this.camera.position)
    return `${distance.toFixed(2)} m`
  }

  // TODO: Validate
  /**
   * Set how many shelf runs stay mounted at once.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setLoadedRuns(count: number) {
    if (count === this.loadedRuns) return
    this.loadedRuns = count
    if (this.runs.length > 0) this.updateLod()
  }

  // TODO: Validate
  /**
   * Repaint the carpet in the hue of the given color.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setFloorColor(color: number) {
    if (!this.floorMaterial) return
    const hue = Math.round(
      new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace)
        .h * 360,
    )
    this.floorMaterial.map?.dispose()
    this.floorMaterial.map = createCarpetTexture(hue)
    this.floorMaterial.map.repeat.copy(this.carpetRepeat)
    this.floorMaterial.needsUpdate = true
    if (!this.tvRoomFloorMaterial) return
    this.tvRoomFloorMaterial.map?.dispose()
    this.tvRoomFloorMaterial.map = createCarpetTexture(hue)
    this.tvRoomFloorMaterial.map.repeat.copy(this.tvRoomCarpetRepeat)
    this.tvRoomFloorMaterial.needsUpdate = true
  }

  // TODO: Validate
  /**
   * Set the color of the walls and other room surfaces.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setRoomColor(color: number) {
    for (const material of this.roomMaterials) {
      material.color.set(color)
      material.needsUpdate = true
    }
  }

  // TODO: Validate
  /**
   * Set the color of the wood shelving and counter.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setWoodColor(color: number) {
    if (!this.woodMaterial) return
    this.woodMaterial.lightGrainColor.set(color)
    this.woodMaterial.darkGrainColor.set(color).multiplyScalar(0.85)
    this.woodFallback?.color.set(color)
    if (!this.tvRoomWoodMaterial) return
    this.tvRoomWoodMaterial.lightGrainColor.set(color)
    this.tvRoomWoodMaterial.darkGrainColor.set(color).multiplyScalar(0.85)
    this.tvRoomWoodFallback?.color.set(color)
  }

  // TODO: Validate
  /**
   * Repaint the filter board with the current filters and design settings.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setBoard(filters: string[], design: string[]) {
    if (!this.filterBoard) return
    const material = this.filterBoard.material as THREE.MeshBasicMaterial
    material.map?.dispose()
    material.map = createFilterBoardTexture(filters, design)
    material.needsUpdate = true
  }

  // TODO: Validate
  /**
   * Move the camera to the first spot that is not blocked, look at the target,
   * and refresh the visible runs and lights.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private teleport(spots: THREE.Vector3[], target: THREE.Vector3) {
    const spot =
      spots.find(
        (candidate) => !this.playerMovement.blocked(candidate.x, candidate.z),
      ) ?? spots[0]
    this.playerMovement.placeAt(spot.x, spot.z)
    this.camera.lookAt(target)
    this.lodCountdown = 0
    this.updateLod()
    this.moveLights()
  }

  // TODO: Validate
  /**
   * Teleport in front of the nearest shelf slot holding the title and return
   * whether it was found.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  teleportToTitle(title: StoreTitle) {
    let best: Slot | null = null
    let shortest = Number.POSITIVE_INFINITY
    for (const [index, titles] of this.runTitles.entries()) {
      for (const [offset, shelved] of titles.entries()) {
        if (shelved.id !== title.id) continue
        const slot = this.runs[index].fill[this.runSlots[index][offset]]
        const distance = slot.position.distanceToSquared(this.camera.position)
        if (distance < shortest) {
          shortest = distance
          best = slot
        }
      }
    }
    if (!best) return false
    this.faceSlot(best)
    return true
  }

  // TODO: Validate
  /**
   * Teleport to a spot in front of a shelf slot, looking at it.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private faceSlot({ position, facing }: Slot) {
    this.teleport(
      [1.1, 0.9, 1.3, 0.7].map((away) =>
        position.clone().addScaledVector(facing, away),
      ),
      position,
    )
  }

  // TODO: Validate
  /**
   * Return the genres that have a shelf section.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  genreLabels() {
    return [...new Set(this.genreStarts.map((entry) => entry.genre))]
  }

  // TODO: Validate
  /**
   * Teleport in front of the nearest start of the genre's shelf section and
   * return whether it was found.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  teleportToGenre(genre: string) {
    let best: Slot | null = null
    let shortest = Number.POSITIVE_INFINITY
    for (const entry of this.genreStarts) {
      if (entry.genre !== genre) continue
      const distance = entry.slot.position.distanceToSquared(
        this.camera.position,
      )
      if (distance < shortest) {
        shortest = distance
        best = entry.slot
      }
    }
    if (!best) return false
    this.faceSlot(best)
    return true
  }

  // TODO: Validate
  /**
   * Teleport in front of the counter, facing it.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  teleportToDesk() {
    const x = this.counterTop.x
    const front = this.storeDepth / 2
    this.teleport(
      [2.7, 2.85, 2.55, 3.2].map(
        (away) => new THREE.Vector3(x, 0, front - away),
      ),
      new THREE.Vector3(x, 1, front - 1.95),
    )
  }

  // TODO: Validate
  /**
   * Teleport to the back corner opposite the counter, looking across the store.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  teleportToBackCorner() {
    const side = this.counterTop.x < 0 ? 1 : -1
    const x = (side * this.storeWidth) / 2
    const z = -this.storeDepth / 2
    this.teleport(
      [1, 1.4, 1.8].map(
        (away) => new THREE.Vector3(x - side * away, 0, z + away),
      ),
      new THREE.Vector3(-x, this.playerMovement.eyeHeight - 0.2, -z),
    )
  }

  // TODO: Validate
  /**
   * Start controlling the camera, by pointer lock on desktop or by enabling
   * touch controls.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  lock() {
    if (!this.touch) {
      if (performance.now() - this.lastExit < 900) return
      this.controls.lock()
      return
    }
    this.touchActive = true
    this.callbacks.onLockChange(true)
  }

  // TODO: Validate
  /**
   * Stop controlling the camera, releasing pointer lock or disabling touch
   * controls.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  exit() {
    if (!this.touch) {
      this.lastExit = performance.now()
      this.controls.unlock()
      return
    }
    this.touchActive = false
    this.playerMovement.stopTouchMove()
    this.callbacks.onLockChange(false)
  }

  // TODO: Validate
  /**
   * Set the touch joystick direction and whether the player is running.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setMove(x: number, y: number, running: boolean) {
    this.playerMovement.setTouchMove(x, y, running)
  }

  // TODO: Validate
  /**
   * Set whether the touch player is crouching.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setCrouch(crouching: boolean) {
    this.playerMovement.setTouchCrouch(crouching)
  }

  // TODO: Validate
  /**
   * Turn the camera by a touch drag, clamping how far it can look up or down.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  look(deltaX: number, deltaY: number) {
    this.euler.setFromQuaternion(this.camera.quaternion)
    this.euler.y -= deltaX * 0.005
    this.euler.x = THREE.MathUtils.clamp(
      this.euler.x - deltaY * 0.005,
      -Math.PI / 2 + 0.05,
      Math.PI / 2 - 0.05,
    )
    this.camera.quaternion.setFromEuler(this.euler)
  }

  // TODO: Validate
  /**
   * Pick what is under a tapped screen point and either trigger the button or
   * focus and open the case.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  focusAt(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const mesh = this.pick(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
      4.5,
    )
    if (mesh && !mesh.userData.basePosition) {
      this.applyFocus(null)
      this.trigger(mesh)
      return
    }
    this.applyFocus(mesh)
    if (mesh) this.activateFocused()
  }

  // TODO: Validate
  /**
   * Trigger the focused button, or open the focused case's title and leave the
   * store controls.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  activateFocused() {
    if (!this.focused) return
    if (!this.focused.userData.basePosition) {
      const target = this.focused
      this.applyFocus(null)
      this.trigger(target)
      this.lastFocusAt.setScalar(Number.POSITIVE_INFINITY)
      return
    }
    const title = this.focused.userData.title as StoreTitle
    this.applyFocus(null)
    if (!this.touch) this.exit()
    this.callbacks.onActivate(title)
  }

  // TODO: Validate
  /**
   * Stop rendering, remove listeners, and dispose every geometry, material,
   * texture, and generator the store created.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  dispose() {
    this.disposed = true
    this.coverDownloadQueue.dispose()
    cancelAnimationFrame(this.animationHandle)
    this.resizeObserver.disconnect()
    this.controls.removeEventListener("lock", this.handleLock)
    this.controls.removeEventListener("unlock", this.handleUnlock)
    this.controls.disconnect()
    window.removeEventListener("keydown", this.handleKeyDown)
    window.removeEventListener("keyup", this.handleKeyUp)
    window.removeEventListener("mousedown", this.handleMouseDown)
    window.removeEventListener(
      "message",
      this.tvTrailerPlayer.handleTvVideoMessage,
    )
    for (const pool of this.batchPool.values()) {
      for (const batch of pool) batch.dispose()
    }
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      for (const entry of materials) {
        const material = entry as THREE.MeshStandardMaterial
        material.map?.dispose()
        material.dispose()
      }
    })
    this.parkingLot?.dispose()
    this.sidewalk?.dispose()
    this.trees?.dispose()
    this.forest?.dispose()
    this.terrain?.dispose()
    this.lamps?.dispose()
    for (const mesh of this.instanced) mesh.dispose()
    for (const mesh of this.casePool) {
      const material = mesh.userData.material as THREE.Material | undefined
      material?.dispose()
    }
    this.caseGeometry.dispose()
    this.tagGeometry.dispose()
    this.headerGeometry.dispose()
    this.tagArray?.dispose()
    for (const batches of this.runBatches.values()) {
      for (const { covers } of batches) covers?.dispose()
    }
    this.stripGeometry.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    for (const tvRoomLamp of this.tvRoomLamps) tvRoomLamp.dispose()
    this.tvTrailerPlayer.dispose()
    this.statsPanel.remove()
  }
}
