// TODO: Validate
export type StoreDesign = {
  floor: number
  room: number
  wood: number
  shine: boolean
  unlit: boolean
  condensed: boolean
  format: number
  lights: number
  lamps: number
  fullPosters: boolean
  outdoor: number
  askew: number
  rainDrops: number
  rainSpeed: number
  rain: boolean
  fps: boolean
  autoplayTrailers: boolean
  autoLoadImages: boolean
  imageLogos: boolean
  pullOut: number
  condensedPullOut: number
  widerCases: boolean
  unlitBrightness: number
  loadedRuns: number
}

export const PALETTE = [
  { name: "Blue", color: 0x1f3a8a },
  { name: "Red", color: 0x8a1f2f },
  { name: "Green", color: 0x1f6b3a },
  { name: "Purple", color: 0x5b2f7a },
  { name: "Yellow", color: 0xd8b13a },
  { name: "Slate", color: 0x2b2f3a },
]

export const WOOD_PALETTE = [
  { name: "Maple", color: 0xbc9d7d },
  { name: "Pine", color: 0xd19d61 },
  { name: "Red Oak", color: 0xe0a27a },
  { name: "Cherry", color: 0xb45837 },
  { name: "Teak", color: 0x926c50 },
  { name: "Walnut", color: 0x523424 },
]

export const FORMATS = ["DVD", "VHS", "Large DVD", "DVD Boxset"]

export const defaultDesign: StoreDesign = {
  floor: 0x1f3a8a,
  room: 0xd8b13a,
  wood: 0xbc9d7d,
  shine: true,
  unlit: true,
  condensed: false,
  format: 0,
  lights: 2,
  lamps: 24,
  fullPosters: false,
  outdoor: 2,
  askew: 20,
  rainDrops: 12000,
  rainSpeed: 8,
  rain: true,
  fps: false,
  autoplayTrailers: false,
  autoLoadImages: false,
  imageLogos: true,
  pullOut: 4,
  condensedPullOut: 15,
  widerCases: true,
  unlitBrightness: 50,
  loadedRuns: 25,
}

// TODO: Validate
/**
 * Return the palette name of the color, or Custom when the palette does not
 * hold it.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const colorName = (color: number, palette = PALETTE) =>
  palette.find((entry) => entry.color === color)?.name ?? "Custom"

// TODO: Validate
/**
 * Return one line per main store design setting describing its current value.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const designSummary = (design: StoreDesign) => [
  `Cases: ${FORMATS[design.format] ?? FORMATS[0]}`,
  `Floor: ${colorName(design.floor)}`,
  `Walls: ${colorName(design.room)}`,
  `Wood: ${colorName(design.wood, WOOD_PALETTE)}`,
  `Indoor lights: ${design.lights.toFixed(1)}`,
  `Lit lamps: ${design.lamps}`,
  `Outdoor lights: ${design.outdoor.toFixed(1)}`,
  `Askew: ${design.askew}`,
  `Rain: ${design.rain ? `${design.rainDrops.toLocaleString()} drops` : "off"}`,
  `Posters: ${design.fullPosters ? "full size" : "thumbnail"}`,
  `Shine: ${design.shine ? "on" : "off"}`,
  `Unlit cases: ${design.unlit ? "on" : "off"}`,
  `Condensed: ${design.condensed ? "on" : "off"}`,
]
