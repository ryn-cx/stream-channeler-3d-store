// TODO: Validate
export type SeededRandom = {
  fraction: () => number
  integerBetween: (lowest: number, highest: number) => number
  chance: (probability: number) => boolean
  pick: <Item>(items: readonly Item[]) => Item
  pickSeveral: <Item>(items: readonly Item[], count: number) => Item[]
}

// TODO: Validate
/**
 * Return a random number generator that produces the same sequence every time
 * it is created with the same seed. It uses the mulberry32 algorithm.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export const createSeededRandom = (seed: number): SeededRandom => {
  let state = seed >>> 0

  // TODO: Validate
  const fraction = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }

  // TODO: Validate
  const integerBetween = (lowest: number, highest: number) =>
    lowest + Math.floor(fraction() * (highest - lowest + 1))

  // TODO: Validate
  const chance = (probability: number) => fraction() < probability

  // TODO: Validate
  const pick = <Item>(items: readonly Item[]) =>
    items[Math.floor(fraction() * items.length)]

  // TODO: Validate
  const pickSeveral = <Item>(items: readonly Item[], count: number) => {
    const remainingItems = [...items]
    const pickedItems: Item[] = []
    while (pickedItems.length < count && remainingItems.length > 0) {
      const pickedIndex = Math.floor(fraction() * remainingItems.length)
      pickedItems.push(...remainingItems.splice(pickedIndex, 1))
    }
    return pickedItems
  }

  return { fraction, integerBetween, chance, pick, pickSeveral }
}
