// TODO: Validate
import type { StoreImage } from "../storeTypes"

// TODO: Validate
/**
 * Return the text with the characters that have a meaning in XML replaced by
 * their entities.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

// TODO: Validate
/**
 * Return the words grouped into lines that each hold at most the given number
 * of characters, unless a single word is longer than that.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const wrapWords = (text: string, charactersPerLine: number) => {
  const lines: string[] = []
  for (const word of text.split(" ")) {
    const lastLine: string | undefined = lines[lines.length - 1]
    if (
      lastLine !== undefined &&
      lastLine.length + 1 + word.length <= charactersPerLine
    ) {
      lines[lines.length - 1] = `${lastLine} ${word}`
    } else {
      lines.push(word)
    }
  }
  return lines
}

// TODO: Validate
/**
 * Return a store image whose URL at every size is the SVG itself as a data URL,
 * so the fake images load without any network request.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const svgStoreImage = (
  imageId: string,
  kind: StoreImage["kind"],
  width: number,
  height: number,
  svgBody: string,
): StoreImage => {
  const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgBody}</svg>`,
  )}`
  return {
    id: imageId,
    kind,
    width,
    height,
    urls: {
      w154: svgDataUrl,
      w300: svgDataUrl,
      w780: svgDataUrl,
      w1280: svgDataUrl,
      original: svgDataUrl,
    },
    store_urls: null,
  }
}

// TODO: Validate
/**
 * Return a fake portrait poster that shows the title's name and year over a
 * gradient in the given hue.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createFakePoster = (
  titleId: string,
  name: string,
  year: number | null,
  hue: number,
) => {
  const nameLines = wrapWords(name, 12).slice(0, 5)
  const nameText = nameLines
    .map(
      (line, lineIndex) =>
        `<text x="150" y="${150 + lineIndex * 44}" font-family="Georgia, serif" font-size="38" font-weight="bold" fill="white" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("")
  const yearText =
    year === null
      ? ""
      : `<text x="150" y="420" font-family="Arial, sans-serif" font-size="22" fill="white" fill-opacity="0.75" text-anchor="middle">${year}</text>`
  return svgStoreImage(
    `${titleId}-poster`,
    "poster",
    300,
    450,
    `<defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue}, 65%, 42%)"/><stop offset="1" stop-color="hsl(${(hue + 70) % 360}, 70%, 14%)"/></linearGradient></defs><rect width="300" height="450" fill="url(#background)"/><circle cx="${40 + (hue % 220)}" cy="330" r="120" fill="hsl(${(hue + 150) % 360}, 80%, 60%)" fill-opacity="0.25"/><rect x="14" y="14" width="272" height="422" fill="none" stroke="white" stroke-opacity="0.35" stroke-width="2"/>${nameText}${yearText}`,
  )
}

// TODO: Validate
/**
 * Return a fake landscape backdrop that shows the title's name over a gradient
 * in the given hue.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createFakeBackdrop = (
  titleId: string,
  name: string,
  hue: number,
) =>
  svgStoreImage(
    `${titleId}-backdrop`,
    "backdrop",
    780,
    439,
    `<defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${(hue + 30) % 360}, 60%, 30%)"/><stop offset="1" stop-color="hsl(${(hue + 200) % 360}, 65%, 12%)"/></linearGradient></defs><rect width="780" height="439" fill="url(#background)"/><circle cx="${120 + hue}" cy="170" r="150" fill="hsl(${(hue + 120) % 360}, 85%, 65%)" fill-opacity="0.3"/><polygon points="0,439 ${200 + hue},230 520,439" fill="black" fill-opacity="0.35"/><polygon points="300,439 610,260 780,439" fill="black" fill-opacity="0.5"/><text x="390" y="400" font-family="Arial, sans-serif" font-size="30" fill="white" fill-opacity="0.8" text-anchor="middle">${escapeXml(name.slice(0, 40))}</text>`,
  )

// TODO: Validate
/**
 * Return a fake logo that shows the title's name in white on a transparent
 * background.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createFakeLogo = (titleId: string, name: string) => {
  const logoName = name.slice(0, 24)
  const logoWidth = Math.max(160, logoName.length * 30)
  return svgStoreImage(
    `${titleId}-logo`,
    "logo",
    logoWidth,
    80,
    `<text x="${logoWidth / 2}" y="58" font-family="Impact, Arial Black, sans-serif" font-size="52" fill="white" stroke="black" stroke-width="1.5" text-anchor="middle" textLength="${logoWidth - 16}" lengthAdjust="spacingAndGlyphs">${escapeXml(logoName.toUpperCase())}</text>`,
  )
}
