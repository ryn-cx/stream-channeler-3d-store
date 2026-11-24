// TODO: Validate
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode, useState } from "react"
import ReactDOM from "react-dom/client"
import { createTestBackend } from "../src/fakeData"
import { StoreScreen } from "../src/StoreScreen"
import type { StoreMetadata } from "../src/storeStock"
import "./index.css"

const searchParameters = new URLSearchParams(window.location.search)
const titleCount = Number(searchParameters.get("titles") ?? 2000)
const seed = Number(searchParameters.get("seed") ?? 1)
const responseDelayMilliseconds = Number(searchParameters.get("delay") ?? 200)

const { backend, fetchStock } = createTestBackend({
  titleCount,
  seed,
  responseDelayMilliseconds,
})

// TODO: Validate
/**
 * Render the video store stocked with made up titles, so the store can be
 * developed without a Stream Channeler server.
 *
 * The page reads three optional search parameters: `titles` is the number of
 * titles, `seed` picks which titles are made up, and `delay` is how many
 * milliseconds each fake download takes.
 *
 * TODO: Warning: This docstring was AI generated.
 */
function FakeStore() {
  const [metadata, setMetadata] = useState<StoreMetadata>("tmdb")

  return (
    <StoreScreen
      backend={backend}
      storeKey={`fake-store-${seed}-${titleCount}`}
      storeName="Fake Video Store"
      fetchStock={fetchStock}
      emptyMessage="The fake store has no titles. Set the titles search parameter above zero."
      metadata={metadata}
      onMetadata={setMetadata}
      back={null}
    />
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <FakeStore />
    </QueryClientProvider>
  </StrictMode>,
)
