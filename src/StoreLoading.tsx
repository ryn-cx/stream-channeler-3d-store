// TODO: Validate
import { Check, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { StoreProgress } from "./videoStore"

// TODO: Validate
/**
 * Return the loading step text for building the store and starting the
 * renderer.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const storeStep = (progress: StoreProgress) => {
  if (progress.stage === "building") return "Building the store…"
  if (progress.stage === "starting") return "Starting the renderer…"
  return "Store built"
}

// TODO: Validate
/**
 * Return the loading step text for preparing the store's objects to draw, with
 * the count compiled so far.
 *
 * TODO: Warning: This docstring was AI generated.
 */
const shaderStep = (progress: StoreProgress) => {
  if (progress.stage !== "compiling") return "Objects ready to draw"
  if (progress.total === 0) return "Preparing objects to draw…"
  return `Preparing objects to draw · ${progress.compiled} / ${progress.total} objects`
}

// TODO: Validate
/**
 * Render one loading step with a check mark when done or a spinner while
 * running.
 *
 * TODO: Warning: This docstring was AI generated.
 */
function LoadingStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <Check className="size-4 text-emerald-300" />
      ) : (
        <Loader2 className="size-4 animate-spin text-white/60" />
      )}
      <span className={done ? "text-white/80" : "text-white/60"}>{label}</span>
    </div>
  )
}

// TODO: Validate
/**
 * Render the video store loading screen with the catalogue, build, and draw
 * preparation steps and the seconds elapsed.
 *
 * TODO: Warning: This docstring was AI generated.
 */
export function StoreLoading({
  storeName,
  titleCount,
  progress,
}: {
  storeName: string
  titleCount: number | null
  progress: StoreProgress
}) {
  const [startedAt] = useState(() => performance.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const handle = setInterval(
      () => setElapsed(Math.floor((performance.now() - startedAt) / 1000)),
      1000,
    )
    return () => clearInterval(handle)
  }, [startedAt])

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white ${progress.stage === "compiling" || progress.stage === "ready" ? "bg-black/60" : "bg-black"}`}
    >
      <span className="text-3xl font-bold tracking-tight">{storeName}</span>
      <div className="flex flex-col gap-1.5 rounded-lg bg-black/60 px-4 py-3 text-left text-sm backdrop-blur">
        <LoadingStep
          done={titleCount !== null}
          label={
            titleCount === null
              ? "Fetching the catalogue…"
              : `${titleCount.toLocaleString()} ${titleCount === 1 ? "title" : "titles"} in stock`
          }
        />
        <LoadingStep
          done={progress.stage === "compiling" || progress.stage === "ready"}
          label={storeStep(progress)}
        />
        {(progress.stage === "compiling" || progress.stage === "ready") && (
          <LoadingStep
            done={progress.stage === "ready"}
            label={shaderStep(progress)}
          />
        )}
        {progress.stage === "compiling" && (
          <div className="flex flex-col gap-0.5 pl-6 text-xs">
            {progress.groups.map((group) => (
              <div
                key={group.label}
                className={`flex justify-between gap-6 ${group.compiled === group.total ? "text-white/40" : "text-white/70"}`}
              >
                <span>{group.label}</span>
                <span className="tabular-nums">
                  {group.compiled} / {group.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <span className="text-[11px] text-white/40">{elapsed}s</span>
    </div>
  )
}
