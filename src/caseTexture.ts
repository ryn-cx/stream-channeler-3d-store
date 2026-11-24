// TODO: Validate
import * as THREE from "three"
import type { StoreImage } from "./storeTypes"

export type StoreTitle = {
  id: string
  name: string
  year: number | null
  tmdbScore: number | null
  tmdbPopularity: number | null
  imdbId: string | null
  imdbScore: number | null
  imdbPopularityRank: number | null
  mediaType: string | null
  originalLanguage: string | null
  languages: string[]
  subtitleLanguages: string[]
  image: StoreImage | null
  logo?: StoreImage | null
  isPoster: boolean
  genres: string[]
  episodeCount: number
  seasonCount: number
  releaseDate: string | null
  trailerUrl?: string | null
}

// TODO: Validate
/**
 * Return a stable hue from 0 to 359 derived from the string, so the same title
 * or genre always gets the same color.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const hashHue = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360
  }
  return hash
}

// TODO: Validate
/**
 * Return the stable hue used to color the genre.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const genreHue = (genre: string) => hashHue(genre)

// TODO: Validate
/**
 * Return whether the genre is a fallback shelf, marked by a leading underscore,
 * rather than a real genre.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const isFallbackGenre = (genre: string) => genre.startsWith("_")

// TODO: Validate
/**
 * Compare two genres alphabetically, placing fallback genres after real ones.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const compareGenres = (left: string, right: string) =>
  isFallbackGenre(left) === isFallbackGenre(right)
    ? left.localeCompare(right)
    : Number(isFallbackGenre(left)) - Number(isFallbackGenre(right))

// TODO: Validate
/**
 * Return the title's distinct genres in shelf order, limited to the allowed
 * genres when given.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const shelfGenres = (
  title: StoreTitle,
  allowed?: Set<string> | null,
) => {
  const named = [...new Set(title.genres)].sort(compareGenres)
  return allowed ? named.filter((genre) => allowed.has(genre)) : named
}

// TODO: Validate
/**
 * Return whether the title is a movie.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const isMovie = (title: StoreTitle) => title.mediaType === "Movie"

// TODO: Validate
/**
 * Return the short facts shown for a title, Movie for movies and otherwise its
 * season and episode counts.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const titleFacts = (title: StoreTitle) => {
  if (isMovie(title)) return ["Movie"]
  const seasons =
    title.seasonCount === 1 ? "1 season" : `${title.seasonCount} seasons`
  const episodes =
    title.episodeCount === 1 ? "1 episode" : `${title.episodeCount} episodes`
  return title.seasonCount > 0 ? [seasons, episodes] : [episodes]
}

// TODO: Validate
/**
 * Return the text wrapped into lines that fit the width, ending the last
 * allowed line with an ellipsis when the text does not fit.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const wrapLines = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) => {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || context.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && current) lines.push(current)
  const overflowed =
    lines.length === maxLines && current !== lines[maxLines - 1]
  if (overflowed) {
    let last = lines[maxLines - 1]
    while (
      last.length > 1 &&
      context.measureText(`${last}…`).width > maxWidth
    ) {
      last = last.slice(0, -1)
    }
    lines[maxLines - 1] = `${last}…`
  }
  return lines
}

// TODO: Validate
/**
 * Draw the image to fill the case front, or a gradient in the title's hue when
 * there is no image.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const drawCover = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  hue: number,
) => {
  if (!image?.naturalWidth || !image.naturalHeight) {
    const gradient = context.createLinearGradient(0, 0, 168, 224)
    gradient.addColorStop(0, `hsl(${hue}, 48%, 34%)`)
    gradient.addColorStop(1, `hsl(${(hue + 40) % 360}, 52%, 12%)`)
    context.fillStyle = gradient
    context.fillRect(0, 0, 168, 224)
    return
  }
  const scale = Math.max(168 / image.naturalWidth, 224 / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  context.drawImage(image, (168 - width) / 2, (224 - height) / 2, width, height)
}

// TODO: Validate
/**
 * Draw a blurred, mirrored copy of a column of the canvas at another position,
 * used to extend the cover art onto the spine.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const mirrorColumn = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sourceX: number,
  width: number,
  destinationX: number,
  scale: number,
) => {
  context.save()
  context.filter = "blur(7px)"
  context.translate(destinationX + width, 0)
  context.scale(-1, 1)
  context.drawImage(
    canvas,
    sourceX * scale,
    0,
    width * scale,
    224 * scale,
    0,
    0,
    width,
    224,
  )
  context.restore()
}

// TODO: Validate
/**
 * Return the bounding box of the logo's visible pixels and their average color,
 * or the whole image in light grey when it cannot be read.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const measureLogo = (logo: HTMLImageElement) => {
  const full = {
    x: 0,
    y: 0,
    width: logo.naturalWidth,
    height: logo.naturalHeight,
    color: "#f2f2f5",
  }
  const canvas = document.createElement("canvas")
  canvas.width = logo.naturalWidth
  canvas.height = logo.naturalHeight
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return full
  context.drawImage(logo, 0, 0)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  let left = canvas.width
  let top = canvas.height
  let right = -1
  let bottom = -1
  let red = 0
  let green = 0
  let blue = 0
  let weight = 0
  for (let row = 0; row < canvas.height; row++) {
    for (let column = 0; column < canvas.width; column++) {
      const index = (row * canvas.width + column) * 4
      const alpha = data[index + 3]
      if (alpha <= 8) continue
      left = Math.min(left, column)
      right = Math.max(right, column)
      top = Math.min(top, row)
      bottom = Math.max(bottom, row)
      red += data[index] * alpha
      green += data[index + 1] * alpha
      blue += data[index + 2] * alpha
      weight += alpha
    }
  }
  if (right < 0) return full
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    color: `rgb(${Math.round(red / weight)}, ${Math.round(green / weight)}, ${Math.round(blue / weight)})`,
  }
}

// TODO: Validate
/**
 * Return the image's average color as a CSS rgb string, or null when it cannot
 * be read.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const averageColor = (image: HTMLImageElement) => {
  const canvas = document.createElement("canvas")
  canvas.width = 16
  canvas.height = 16
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0, 16, 16)
  const { data } = context.getImageData(0, 0, 16, 16)
  let red = 0
  let green = 0
  let blue = 0
  for (let index = 0; index < data.length; index += 4) {
    red += data[index]
    green += data[index + 1]
    blue += data[index + 2]
  }
  const pixels = data.length / 4
  return `rgb(${Math.round(red / pixels)}, ${Math.round(green / pixels)}, ${Math.round(blue / pixels)})`
}

// TODO: Validate
/**
 * Return the spine's width on the case canvas for the case's depth ratio,
 * clamped between 24 and 80 pixels.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const spineSpan = (spineRatio: number) =>
  Math.min(80, Math.max(24, 224 * spineRatio))

// TODO: Validate
/**
 * Draw a title's case artwork onto a canvas, with the cover, name, and facts on
 * the front and the logo or name on the spine, or only the front when asked.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createCaseCanvas = (
  title: StoreTitle,
  image: HTMLImageElement | null,
  scale = 1,
  frontOnly = false,
  logo: HTMLImageElement | null = null,
  spineRatio = 0.015 / 0.19,
) => {
  const canvas = document.createElement("canvas")
  canvas.width = Math.round((frontOnly ? 168 : 256) * scale)
  canvas.height = Math.round((frontOnly ? 224 : 256) * scale)
  const context = canvas.getContext("2d")
  if (!context) return canvas
  context.scale(scale, scale)
  const hue = hashHue(title.id)

  context.fillStyle = "#0a0a0c"
  context.fillRect(0, 0, 256, 256)

  const posterOnly = title.isPoster && Boolean(image?.naturalWidth)

  context.save()
  context.beginPath()
  context.rect(0, 0, 168, 224)
  context.clip()
  drawCover(context, image, hue)

  if (posterOnly) {
    context.restore()
  } else {
    const shade = context.createLinearGradient(0, 96, 0, 224)
    shade.addColorStop(0, "rgba(0, 0, 0, 0)")
    shade.addColorStop(0.55, "rgba(0, 0, 0, 0.72)")
    shade.addColorStop(1, "rgba(0, 0, 0, 0.95)")
    context.fillStyle = shade
    context.fillRect(0, 96, 168, 128)
    context.restore()

    context.textAlign = "center"
    context.font = "bold 17px 'Trebuchet MS', sans-serif"
    const lines = wrapLines(context, title.name, 148, 3)
    let textY = 206 - (lines.length - 1) * 19
    context.fillStyle = "#f4f4f5"
    context.shadowColor = "rgba(0, 0, 0, 0.9)"
    context.shadowBlur = 4
    for (const line of lines) {
      context.fillText(line, 84, textY)
      textY += 19
    }
    context.shadowBlur = 0

    context.font = "10px 'Trebuchet MS', sans-serif"
    context.fillStyle = "rgba(230, 230, 235, 0.65)"
    const summary = isMovie(title)
      ? "MOVIE"
      : title.episodeCount === 1
        ? "1 EPISODE"
        : `${title.episodeCount} EPISODES`
    context.fillText(
      title.year ? `${title.year} · ${summary}` : summary,
      84,
      219,
    )
  }
  if (frontOnly) return canvas

  const span = spineSpan(spineRatio)
  const spineColor = image?.naturalWidth ? averageColor(image) : null
  if (spineColor) {
    context.fillStyle = spineColor
    context.fillRect(168, 0, span, 224)
  } else {
    mirrorColumn(context, canvas, 0, span, 168, scale)
    context.fillStyle = "rgba(0, 0, 0, 0.3)"
    context.fillRect(168, 0, span, 224)
  }
  const thickness = 224 * spineRatio
  const logoHeight = thickness * 0.75
  context.save()
  context.translate(168 + span / 2, 112)
  context.rotate(Math.PI / 2)
  context.scale(1, span / thickness)
  context.shadowColor = "rgba(0, 0, 0, 0.95)"
  context.shadowBlur = 5
  context.textAlign = "center"
  context.textBaseline = "middle"
  const bounds =
    logo?.naturalWidth && logo.naturalHeight ? measureLogo(logo) : null
  context.fillStyle = bounds?.color ?? "#ffffff"
  context.strokeStyle = "#000000"
  context.lineWidth = 3
  context.lineJoin = "round"
  const fullFit = bounds
    ? Math.min(196 / bounds.width, logoHeight / bounds.height)
    : 0
  const smallLogo =
    bounds !== null &&
    bounds.width * bounds.height * fullFit * fullFit < (196 * logoHeight) / 2
  let textStart = -98
  if (logo && bounds) {
    const boxWidth = smallLogo ? 98 : 196
    const fit = Math.min(boxWidth / bounds.width, logoHeight / bounds.height)
    const width = bounds.width * fit
    const height = bounds.height * fit
    const left = smallLogo ? -98 : -width / 2
    context.drawImage(
      logo,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      left,
      -height / 2,
      width,
      height,
    )
    textStart = left + width + 6
    if (smallLogo) {
      context.fillRect(left + width + 4, -thickness * 0.35, 2, thickness * 0.7)
      textStart = left + width + 10
    }
  }
  if (!bounds || smallLogo) {
    const textWidth = 98 - textStart
    const center = textStart + textWidth / 2
    const fullName = title.name.split(/\s+/).filter(Boolean).join(" ")
    const available = thickness * 0.85
    let size = Math.max(13, Math.floor(available / 1.15))
    let spineLines: string[] = []
    while (true) {
      context.font = `bold ${size}px 'Trebuchet MS', sans-serif`
      const count = Math.max(1, Math.floor(available / (size * 1.15)))
      spineLines = wrapLines(context, title.name, textWidth, count)
      const fits =
        spineLines.join(" ") === fullName &&
        spineLines.every((text) => context.measureText(text).width <= textWidth)
      if (fits || size <= 13) break
      size = Math.max(13, size - 1)
    }
    if (!bounds) context.shadowBlur = 0
    context.lineWidth = size * 0.22
    const spacing = size * 1.15
    for (const [line, text] of spineLines.entries()) {
      const lineY = (line - (spineLines.length - 1) / 2) * spacing
      if (!bounds) context.strokeText(text, center, lineY)
      context.fillText(text, center, lineY)
    }
  }
  context.shadowBlur = 0
  context.restore()

  context.fillStyle = "#33333a"
  context.fillRect(168 + span, 0, 88 - span, 224)

  context.fillStyle = "#3a3a42"
  context.fillRect(0, 224, 168, 16)

  context.fillStyle = "#2c2c33"
  context.fillRect(0, 240, 168, 16)

  return canvas
}

// TODO: Validate
export type CaseDetail = {
  description: string | null
  originalLanguage: string | null
  languages: string[]
  subtitleLanguages: string[]
  runtime: number | null
  imdbRank: number | null
  watchSites: string[]
}

// TODO: Validate
/**
 * Return a runtime in seconds as hours and minutes, or only minutes when under
 * an hour.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const formatRuntime = (seconds: number) => {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

// TODO: Validate
/**
 * Draw the back of a title's case onto a canvas, with its backdrop, name,
 * facts, scores, genres, languages, watch sites, and description.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createBackCanvas = (
  title: StoreTitle,
  detail: CaseDetail,
  image: HTMLImageElement | null,
  cover: HTMLImageElement | null,
) => {
  const canvas = document.createElement("canvas")
  canvas.width = 672
  canvas.height = 896
  const context = canvas.getContext("2d")
  if (!context) return canvas
  const hue = hashHue(title.id)

  if (cover?.naturalWidth && cover.naturalHeight) {
    const scale = Math.max(672 / cover.naturalWidth, 896 / cover.naturalHeight)
    const width = cover.naturalWidth * scale
    const height = cover.naturalHeight * scale
    context.drawImage(
      cover,
      (672 - width) / 2,
      (896 - height) / 2,
      width,
      height,
    )
    context.fillStyle = "rgba(6, 6, 10, 0.86)"
    context.fillRect(0, 0, 672, 896)
  } else {
    const backdrop = context.createLinearGradient(0, 0, 0, 896)
    backdrop.addColorStop(0, `hsl(${hue}, 32%, 16%)`)
    backdrop.addColorStop(1, "#0b0b10")
    context.fillStyle = backdrop
    context.fillRect(0, 0, 672, 896)
  }

  context.save()
  context.beginPath()
  context.rect(36, 36, 600, 338)
  context.clip()
  if (image?.naturalWidth && image.naturalHeight) {
    const scale = Math.max(600 / image.naturalWidth, 338 / image.naturalHeight)
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale
    context.drawImage(
      image,
      36 + (600 - width) / 2,
      36 + (338 - height) / 2,
      width,
      height,
    )
  } else {
    context.fillStyle = `hsl(${hue}, 40%, 24%)`
    context.fillRect(36, 36, 600, 338)
  }
  context.restore()
  context.strokeStyle = "rgba(255, 255, 255, 0.18)"
  context.lineWidth = 2
  context.strokeRect(36, 36, 600, 338)

  context.textAlign = "left"
  context.textBaseline = "alphabetic"
  context.fillStyle = "#f4f4f5"
  context.font = "bold 44px 'Trebuchet MS', sans-serif"
  const nameLines = wrapLines(context, title.name, 600, 2)
  let textY = 448
  for (const line of nameLines) {
    context.fillText(line, 36, textY)
    textY += 50
  }

  context.font = "24px 'Trebuchet MS', sans-serif"
  context.fillStyle = `hsl(${hue}, 58%, 68%)`
  const runtime = detail.runtime ? formatRuntime(detail.runtime) : null
  const facts = [
    title.year ? `${title.year}` : null,
    !isMovie(title) && title.mediaType !== "Series" ? title.mediaType : null,
    ...titleFacts(title),
    runtime && !isMovie(title) ? `${runtime} / episode` : runtime,
  ].filter(Boolean)
  context.fillText(
    wrapLines(context, facts.join("  \u00b7  "), 600, 1)[0] ?? "",
    36,
    textY + 8,
  )
  textY += 40

  const scores = [
    title.tmdbScore === null
      ? null
      : `TMDB Score ${title.tmdbScore.toFixed(1)}`,
    title.tmdbPopularity === null
      ? null
      : `TMDB Popularity ${title.tmdbPopularity.toFixed(1)}`,
    title.imdbScore === null
      ? null
      : `IMDb Score ${title.imdbScore.toFixed(1)}`,
    detail.imdbRank === null
      ? null
      : `IMDb Popularity #${detail.imdbRank.toLocaleString()}`,
  ].filter(Boolean)
  if (scores.length > 0) {
    context.font = "21px 'Trebuchet MS', sans-serif"
    context.fillStyle = "rgba(245, 214, 120, 0.85)"
    for (const line of wrapLines(context, scores.join("  \u00b7  "), 600, 2)) {
      context.fillText(line, 36, textY + 8)
      textY += 29
    }
  }
  textY += 12

  const shelved = shelfGenres(title)
  if (shelved.length > 0) {
    context.font = "22px 'Trebuchet MS', sans-serif"
    context.fillStyle = "rgba(235, 235, 240, 0.7)"
    for (const line of wrapLines(context, shelved.join(" / "), 600, 2)) {
      context.fillText(line, 36, textY + 8)
      textY += 30
    }
  }

  const spoken = detail.languages.filter(
    (language) => language !== detail.originalLanguage,
  )
  if (detail.originalLanguage || spoken.length > 0) {
    context.fillStyle = "rgba(235, 235, 240, 0.75)"
    let languageX = 36
    if (detail.originalLanguage) {
      context.font = "bold 22px 'Trebuchet MS', sans-serif"
      context.fillText(detail.originalLanguage, languageX, textY + 8)
      languageX += context.measureText(detail.originalLanguage).width
    }
    if (spoken.length > 0) {
      context.font = "22px 'Trebuchet MS', sans-serif"
      context.fillStyle = "rgba(235, 235, 240, 0.55)"
      const rest = detail.originalLanguage
        ? `, ${spoken.join(", ")}`
        : spoken.join(", ")
      context.fillText(
        wrapLines(context, rest, 636 - languageX, 1)[0] ?? "",
        languageX,
        textY + 8,
      )
    }
    textY += 32
  }

  if (detail.subtitleLanguages.length > 0) {
    context.font = "22px 'Trebuchet MS', sans-serif"
    context.fillStyle = "rgba(235, 235, 240, 0.55)"
    context.fillText(
      wrapLines(
        context,
        `Subtitles: ${detail.subtitleLanguages.join(", ")}`,
        600,
        1,
      )[0] ?? "",
      36,
      textY + 8,
    )
    textY += 32
  }

  const watchSites = [...new Set(detail.watchSites)]
  context.font = "22px 'Trebuchet MS', sans-serif"
  context.fillStyle = "rgba(235, 235, 240, 0.75)"
  context.fillText(
    wrapLines(
      context,
      watchSites.length > 0
        ? `Watch on ${watchSites.join(", ")}`
        : "Not Available to Stream",
      600,
      1,
    )[0] ?? "",
    36,
    textY + 8,
  )
  textY += 32

  const descriptionLines = Math.floor((896 - 36 - (textY + 26)) / 32) + 1
  if (detail.description && descriptionLines > 0) {
    context.font = "23px 'Trebuchet MS', sans-serif"
    context.fillStyle = "rgba(226, 226, 233, 0.82)"
    textY += 26
    for (const line of wrapLines(
      context,
      detail.description,
      600,
      descriptionLines,
    )) {
      context.fillText(line, 36, textY)
      textY += 32
    }
  }

  return canvas
}

// TODO: Validate
/**
 * Return a texture of the back of a title's case.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createBackTexture = (
  title: StoreTitle,
  detail: CaseDetail,
  image: HTMLImageElement | null,
  cover: HTMLImageElement | null,
) => {
  const texture = new THREE.CanvasTexture(
    createBackCanvas(title, detail, image, cover),
  )
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Return a double resolution texture of a title's case front and spine.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createCaseTexture = (
  title: StoreTitle,
  image: HTMLImageElement | null,
  logo: HTMLImageElement | null,
  spineRatio: number,
) => {
  const texture = new THREE.CanvasTexture(
    createCaseCanvas(title, image, 2, false, logo, spineRatio),
  )
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Draw one side of an aisle sign, listing its genres as colored labels in
 * columns of up to six, or a blank panel when there are none.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const drawSignHalf = (
  context: CanvasRenderingContext2D,
  genres: string[],
  x: number,
) => {
  if (genres.length === 0) {
    context.fillStyle = "rgba(255, 255, 255, 0.06)"
    context.fillRect(x + 24, 40, 440, 176)
    return
  }
  context.fillStyle = "rgba(255, 255, 255, 0.04)"
  context.fillRect(x + 24, 40, 440, 176)

  const columns = Math.ceil(genres.length / 6)
  const rows = Math.ceil(genres.length / columns)
  const columnWidth = 440 / columns
  const height = Math.min(52, Math.floor(176 / rows))
  const top = 40 + (176 - height * rows) / 2

  for (const [index, genre] of genres.entries()) {
    const column = Math.floor(index / rows)
    const left = x + 24 + column * columnWidth
    const rowTop = top + (index % rows) * height
    const hue = hashHue(genre)
    context.fillStyle = `hsl(${hue}, 44%, 18%)`
    context.fillRect(left + 2, rowTop + 2, columnWidth - 6, height - 4)
    context.fillStyle = `hsl(${hue}, 66%, 55%)`
    context.fillRect(left + 2, rowTop + 2, 8, height - 4)
    context.textAlign = "left"
    context.textBaseline = "middle"
    context.fillStyle = "#f6f6f8"
    let fontSize = Math.min(40, height - 12)
    const label = genre.toUpperCase()
    context.font = `bold ${fontSize}px 'Trebuchet MS', sans-serif`
    while (
      context.measureText(label).width > columnWidth - 28 &&
      fontSize > 12
    ) {
      fontSize -= 2
      context.font = `bold ${fontSize}px 'Trebuchet MS', sans-serif`
    }
    context.fillText(label, left + 18, rowTop + height / 2)
  }
}

// TODO: Validate
/**
 * Draw an aisle sign onto a canvas listing the genres on its left and right
 * shelves.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createAisleSignCanvas = (left: string[], right: string[]) => {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 256
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#0b0b10"
    context.fillRect(0, 0, 1024, 256)
    context.strokeStyle = "rgba(255, 255, 255, 0.16)"
    context.lineWidth = 6
    context.strokeRect(3, 3, 1018, 250)
    drawSignHalf(context, left, 0)
    drawSignHalf(context, right, 512)
    context.fillStyle = "rgba(255, 255, 255, 0.12)"
    context.fillRect(510, 40, 4, 176)
  }
  return canvas
}

// TODO: Validate
/**
 * Return a texture of an aisle sign listing the genres on its left and right
 * shelves.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createAisleSignTexture = (left: string[], right: string[]) => {
  const texture = new THREE.CanvasTexture(createAisleSignCanvas(left, right))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Draw a headed column of lines on the filter board, with the first line in
 * bold.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const drawBoardColumn = (
  context: CanvasRenderingContext2D,
  heading: string,
  lines: string[],
  x: number,
  width: number,
) => {
  context.textAlign = "left"
  context.textBaseline = "alphabetic"
  context.fillStyle = "#7de9dc"
  context.font = "bold 26px 'Trebuchet MS', sans-serif"
  context.fillText(heading, x, 40)
  context.fillStyle = "rgba(125, 233, 220, 0.3)"
  context.fillRect(x, 50, width, 3)

  let textY = 86
  for (const [index, line] of lines.entries()) {
    context.fillStyle = index === 0 ? "#f4f4f5" : "rgba(226, 226, 233, 0.78)"
    context.font =
      index === 0
        ? "bold 25px 'Trebuchet MS', sans-serif"
        : "22px 'Trebuchet MS', sans-serif"
    context.fillText(line, x, textY)
    textY += index === 0 ? 34 : 28
  }
}

// TODO: Validate
/**
 * Return a texture of the board showing the current filter summary and store
 * design summary.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createFilterBoardTexture = (
  filters: string[],
  design: string[],
) => {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 276
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#0b0d14"
    context.fillRect(0, 0, 1024, 276)
    context.strokeStyle = "rgba(45, 212, 191, 0.5)"
    context.lineWidth = 5
    context.strokeRect(3, 3, 1018, 270)

    drawBoardColumn(context, "NOW SHOWING", filters, 26, 590)
    context.fillStyle = "rgba(255, 255, 255, 0.12)"
    context.fillRect(652, 26, 3, 224)
    drawBoardColumn(context, "STYLE", design, 684, 314)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Return a texture of the glowing store sign showing the store's name, shrunk
 * to fit.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createStoreSignTexture = (name: string) => {
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 256
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#0d1220"
    context.fillRect(0, 0, 1024, 256)
    context.strokeStyle = "#2dd4bf"
    context.lineWidth = 8
    context.strokeRect(14, 14, 996, 228)
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#e9fdf9"
    context.shadowColor = "#2dd4bf"
    context.shadowBlur = 26
    let fontSize = 104
    const label = name.toUpperCase()
    context.font = `bold ${fontSize}px 'Trebuchet MS', sans-serif`
    while (context.measureText(label).width > 900 && fontSize > 28) {
      fontSize -= 4
      context.font = `bold ${fontSize}px 'Trebuchet MS', sans-serif`
    }
    context.fillText(label, 512, 132)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Draw a sign onto a canvas showing the label above the words this side of the
 * aisle.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createLoaderCanvas = (label: string) => {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 160
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#0d1220"
    context.fillRect(0, 0, 512, 160)
    context.strokeStyle = "#2dd4bf"
    context.lineWidth = 6
    context.strokeRect(3, 3, 506, 154)
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#e9fdf9"
    context.shadowColor = "#2dd4bf"
    context.shadowBlur = 18
    context.font = "bold 54px 'Trebuchet MS', sans-serif"
    context.fillText(label, 256, 66)
    context.shadowBlur = 0
    context.font = "26px 'Trebuchet MS', sans-serif"
    context.fillStyle = "rgba(233, 253, 249, 0.62)"
    context.fillText("this side of the aisle", 256, 116)
  }
  return canvas
}

// TODO: Validate
/**
 * Return a texture of the aisle loader sign showing the label.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createLoaderTexture = (label: string) => {
  const texture = new THREE.CanvasTexture(createLoaderCanvas(label))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Return a texture showing the label in bold capitals on a dark background.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createLabelTexture = (label: string) => {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "rgba(10, 10, 14, 0.85)"
    context.fillRect(0, 0, 512, 128)
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#f4f4f5"
    context.font = "bold 58px 'Trebuchet MS', sans-serif"
    context.fillText(label.toUpperCase(), 256, 68, 480)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Draw a genre tag onto a canvas in the genre's hue with its name shrunk to
 * fit.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createTagCanvas = (genre: string) => {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext("2d")
  if (context) {
    const hue = hashHue(genre)
    context.fillStyle = new THREE.Color()
      .setHSL(hue / 360, 0.62, 0.46)
      .getStyle()
    context.fillRect(0, 0, 512, 128)
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#000000"
    let fontSize = 72
    const label = genre.toUpperCase()
    context.font = `bold ${fontSize}px 'Trebuchet MS', sans-serif`
    while (context.measureText(label).width > 460 && fontSize > 18) {
      fontSize -= 3
      context.font = `bold ${fontSize}px 'Trebuchet MS', sans-serif`
    }
    context.fillText(label, 256, 68)
  }
  return canvas
}

// TODO: Validate
/**
 * Return a texture of a ceiling light diffuser with two glowing tubes.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createDiffuserTexture = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 256
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#efe7d2"
    context.fillRect(0, 0, 64, 256)

    for (const center of [20, 44]) {
      const tube = context.createLinearGradient(center - 12, 0, center + 12, 0)
      tube.addColorStop(0, "rgba(255, 249, 232, 0)")
      tube.addColorStop(0.5, "rgba(255, 253, 244, 0.95)")
      tube.addColorStop(1, "rgba(255, 249, 232, 0)")
      context.fillStyle = tube
      context.fillRect(center - 12, 6, 24, 244)
    }

    const ends = context.createLinearGradient(0, 0, 0, 256)
    ends.addColorStop(0, "rgba(64, 62, 54, 0.85)")
    ends.addColorStop(0.08, "rgba(120, 116, 104, 0)")
    ends.addColorStop(0.92, "rgba(120, 116, 104, 0)")
    ends.addColorStop(1, "rgba(64, 62, 54, 0.85)")
    context.fillStyle = ends
    context.fillRect(0, 0, 64, 256)

    context.strokeStyle = "rgba(90, 88, 80, 0.25)"
    context.lineWidth = 1
    for (let line = 8; line < 256; line += 16) {
      context.beginPath()
      context.moveTo(0, line)
      context.lineTo(64, line)
      context.stroke()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// TODO: Validate
/**
 * Return a texture of a soft radial glow for light halos.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createGlowTexture = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext("2d")
  if (context) {
    const glow = context.createRadialGradient(64, 64, 4, 64, 64, 64)
    glow.addColorStop(0, "rgba(255, 244, 222, 0.22)")
    glow.addColorStop(0.5, "rgba(255, 238, 205, 0.09)")
    glow.addColorStop(1, "rgba(255, 236, 200, 0)")
    context.fillStyle = glow
    context.fillRect(0, 0, 128, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// TODO: Validate
/**
 * Return a repeating texture of a speckled ceiling tile with a bordered edge.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createCeilingTexture = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 256
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#e8e4d8"
    context.fillRect(0, 0, 128, 256)
    context.fillStyle = "rgba(122, 118, 106, 0.16)"
    for (let speck = 0; speck < 2800; speck++) {
      context.fillRect(Math.random() * 128, Math.random() * 256, 1, 1)
    }
    context.strokeStyle = "#b9b5a6"
    context.lineWidth = 6
    context.strokeRect(3, 3, 122, 250)
    context.strokeStyle = "rgba(255, 255, 255, 0.5)"
    context.lineWidth = 1.5
    context.strokeRect(6.5, 6.5, 115, 243)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Return a repeating texture of speckled parking lot asphalt with a painted
 * line along one edge.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createLotTexture = (horizontal: boolean) => {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#17171c"
    context.fillRect(0, 0, 128, 128)
    context.fillStyle = "rgba(255, 255, 255, 0.05)"
    for (let speck = 0; speck < 900; speck++) {
      context.fillRect(Math.random() * 128, Math.random() * 128, 1, 1)
    }
    context.fillStyle = "#cdc7a6"
    if (horizontal) context.fillRect(0, 0, 128, 5)
    else context.fillRect(0, 0, 5, 128)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Return a repeating texture of dark grass blades.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createGrassTexture = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = "#1c2a1c"
    context.fillRect(0, 0, 128, 128)
    for (let blade = 0; blade < 2600; blade++) {
      const shade = 18 + Math.floor(Math.random() * 26)
      context.fillStyle = `rgb(${shade}, ${shade + 16}, ${shade})`
      context.fillRect(Math.random() * 128, Math.random() * 128, 1, 2)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

// TODO: Validate
/**
 * Return a texture of a single ring for rain ripples on the ground.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createRippleTexture = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext("2d")
  if (context) {
    const ring = context.createRadialGradient(32, 32, 16, 32, 32, 32)
    ring.addColorStop(0, "rgba(198, 222, 255, 0)")
    ring.addColorStop(0.72, "rgba(214, 234, 255, 0.55)")
    ring.addColorStop(0.9, "rgba(226, 240, 255, 0.22)")
    ring.addColorStop(1, "rgba(198, 222, 255, 0)")
    context.fillStyle = ring
    context.fillRect(0, 0, 64, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// TODO: Validate
/**
 * Return a repeating texture of woven carpet in the hue.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createCarpetTexture = (hue = 214) => {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext("2d")
  if (context) {
    context.fillStyle = `hsl(${hue}, 88%, 25%)`
    context.fillRect(0, 0, 256, 256)

    const weave = context.getImageData(0, 0, 256, 256)
    const pixels = weave.data
    for (let row = 0; row < 256; row++) {
      for (let column = 0; column < 256; column++) {
        const index = (row * 256 + column) * 4
        const tuft = ((row >> 1) + (column >> 1)) % 2 === 0 ? 1.06 : 0.94
        const fibre = tuft * (0.86 + Math.random() * 0.28)
        pixels[index] *= fibre
        pixels[index + 1] *= fibre
        pixels[index + 2] *= fibre
      }
    }
    context.putImageData(weave, 0, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 16
  return texture
}
