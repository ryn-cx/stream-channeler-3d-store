// TODO: Validate
import * as THREE from "three"
import {
  CSS3DObject,
  CSS3DRenderer,
} from "three/addons/renderers/CSS3DRenderer.js"
import { createLabelTexture, type StoreTitle } from "./caseTexture"
import { embedUrl } from "./TrailerPlayer"

// TODO: Validate
export class TvTrailerPlayer {
  private showCouchCase: (title: StoreTitle | null) => void
  private tvVideoIsVimeo = false
  private tvVideoSeconds = 0
  private tvVideoPaused = false
  readonly tvVideoControls: THREE.Mesh[] = []
  tvPauseButton: THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.MeshBasicMaterial
  > | null = null
  tvScreen: THREE.Mesh | null = null
  readonly tvBlackScreenMaterial = new THREE.MeshBasicMaterial({
    color: 0x050505,
  })
  private tvVideoHoleMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    blending: THREE.NoBlending,
  })
  private tvVideoRenderer = new CSS3DRenderer()
  private tvVideoScene = new THREE.Scene()
  private tvVideo: CSS3DObject | null = null
  private tvTrailers: Array<{ title: StoreTitle; url: string }> = []
  private tvTrailerIndex = 0
  readonly tvTrailerButtons: THREE.Mesh[] = []

  // TODO: Validate
  constructor(showCouchCase: (title: StoreTitle | null) => void) {
    this.showCouchCase = showCouchCase
  }

  // TODO: Validate
  mount(container: HTMLElement) {
    this.tvVideoRenderer.setSize(container.clientWidth, container.clientHeight)
    this.tvVideoRenderer.domElement.style.cssText =
      "position:absolute;left:0;top:0;pointer-events:none"
    container.appendChild(this.tvVideoRenderer.domElement)
  }

  // TODO: Validate
  resize(width: number, height: number) {
    this.tvVideoRenderer.setSize(width, height)
  }

  // TODO: Validate
  render(camera: THREE.Camera) {
    if (this.tvVideo) this.tvVideoRenderer.render(this.tvVideoScene, camera)
  }

  // TODO: Validate
  startTvVideo() {
    if (!this.tvVideo) this.playTvVideo()
  }

  // TODO: Validate
  toggleTvVideoPaused() {
    const paused = !this.tvVideoPaused
    if (this.tvVideoIsVimeo) this.sendTvVideoCommand(paused ? "pause" : "play")
    else this.sendTvVideoCommand(paused ? "pauseVideo" : "playVideo")
    this.showTvVideoPaused(paused)
  }

  // TODO: Validate
  shownTvTrailer() {
    return this.tvTrailers[this.tvTrailerIndex]
  }

  // TODO: Validate
  /**
   * Set the channel trailers the TV plays, one per title, keeping the trailer
   * being shown if its title is still listed, and show the table's trailer
   * buttons when there are any.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setTvTrailers(tvTrailers: Array<{ title: StoreTitle; url: string }>) {
    const shownTitleId = this.tvTrailers[this.tvTrailerIndex]?.title.id
    this.tvTrailers = tvTrailers
    this.tvTrailerIndex = Math.max(
      0,
      tvTrailers.findIndex((tvTrailer) => tvTrailer.title.id === shownTitleId),
    )
    for (const tvTrailerButton of this.tvTrailerButtons) {
      tvTrailerButton.visible = tvTrailers.length > 0
      if (tvTrailers.length > 0) tvTrailerButton.layers.enableAll()
      else tvTrailerButton.layers.disableAll()
    }
  }

  // TODO: Validate
  /**
   * Move through the channel trailers by the step, wrapping around, and play
   * the trailer reached.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  stepTvTrailer(step: number) {
    if (this.tvTrailers.length === 0) return
    this.tvTrailerIndex =
      (this.tvTrailerIndex + step + this.tvTrailers.length) %
      this.tvTrailers.length
    this.playTvVideo()
  }

  // TODO: Validate
  /**
   * Remove the TV's video and black out its screen.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  stopTvVideo() {
    if (!this.tvVideo) return
    this.tvVideoScene.remove(this.tvVideo)
    this.tvVideo.element.remove()
    this.tvVideo = null
    if (this.tvScreen) this.tvScreen.material = this.tvBlackScreenMaterial
    for (const tvVideoControl of this.tvVideoControls) {
      tvVideoControl.visible = false
      tvVideoControl.layers.disableAll()
    }
  }

  // TODO: Validate
  /**
   * Send a command to the TV's YouTube or Vimeo player, with the value as its
   * argument when given.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private sendTvVideoCommand(command: string, value?: number) {
    const tvVideoFrame = this.tvVideo?.element as HTMLIFrameElement | undefined
    if (!tvVideoFrame) return
    tvVideoFrame.contentWindow?.postMessage(
      JSON.stringify(
        this.tvVideoIsVimeo
          ? { method: command, value }
          : {
              event: "command",
              func: command,
              args: value === undefined ? [] : [value, true],
            },
      ),
      new URL(tvVideoFrame.src).origin,
    )
  }

  // TODO: Validate
  /**
   * Jump the TV's video forward or backward by the seconds from where the
   * player last reported it was.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  seekTvVideo(seconds: number) {
    this.tvVideoSeconds = Math.max(0, this.tvVideoSeconds + seconds)
    this.sendTvVideoCommand(
      this.tvVideoIsVimeo ? "setCurrentTime" : "seekTo",
      this.tvVideoSeconds,
    )
  }

  // TODO: Validate
  /**
   * Remember whether the TV's video is paused and label the pause button Play
   * or Pause to match.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private showTvVideoPaused(paused: boolean) {
    if (paused === this.tvVideoPaused || !this.tvPauseButton) return
    this.tvVideoPaused = paused
    const tvPauseButtonMaterial = this.tvPauseButton.material
    tvPauseButtonMaterial.map?.dispose()
    tvPauseButtonMaterial.map = createLabelTexture(paused ? "Play" : "Pause")
    tvPauseButtonMaterial.needsUpdate = true
  }

  // TODO: Validate
  /**
   * Play the current channel trailer, or the default video when there are no
   * trailers, on the TV's screen, subscribing to the player's events so the
   * end of the video can be detected.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  playTvVideo() {
    const tvScreen = this.tvScreen
    if (!tvScreen) return
    this.stopTvVideo()
    const tvVideoEmbedUrl = new URL(
      embedUrl(
        this.tvTrailers[this.tvTrailerIndex]?.url ??
          "https://www.youtube.com/watch?v=EmH3lHKBboo",
        true,
      ),
    )
    const isVimeo = tvVideoEmbedUrl.hostname.endsWith("vimeo.com")
    this.tvVideoIsVimeo = isVimeo
    this.tvVideoSeconds = 0
    this.showTvVideoPaused(false)
    if (!isVimeo) {
      tvVideoEmbedUrl.searchParams.set("enablejsapi", "1")
      tvVideoEmbedUrl.searchParams.set("origin", window.location.origin)
    }
    const tvVideoFrame = document.createElement("iframe")
    tvVideoFrame.src = tvVideoEmbedUrl.toString()
    tvVideoFrame.allow = "autoplay; encrypted-media"
    tvVideoFrame.referrerPolicy = "strict-origin-when-cross-origin"
    tvVideoFrame.style.cssText =
      "width:760px;height:460px;border:0;background:#000"
    tvVideoFrame.addEventListener("load", () => {
      for (const subscription of isVimeo
        ? [
            { method: "addEventListener", value: "ended" },
            { method: "addEventListener", value: "timeupdate" },
          ]
        : [{ event: "listening", id: 1, channel: "widget" }]) {
        tvVideoFrame.contentWindow?.postMessage(
          JSON.stringify(subscription),
          tvVideoEmbedUrl.origin,
        )
      }
    })
    const tvVideo = new CSS3DObject(tvVideoFrame)
    tvScreen.updateWorldMatrix(true, false)
    tvScreen.matrixWorld.decompose(
      tvVideo.position,
      tvVideo.quaternion,
      tvVideo.scale,
    )
    tvVideo.scale.setScalar(1.9 / 760)
    this.tvVideoScene.add(tvVideo)
    this.tvVideo = tvVideo
    tvScreen.material = this.tvVideoHoleMaterial
    for (const tvVideoControl of this.tvVideoControls) {
      tvVideoControl.visible = true
      tvVideoControl.layers.enableAll()
    }
    this.showCouchCase(this.tvTrailers[this.tvTrailerIndex]?.title ?? null)
  }

  // TODO: Validate
  readonly handleTvVideoMessage = (event: MessageEvent) => {
    const tvVideoFrame = this.tvVideo?.element as HTMLIFrameElement | undefined
    if (!tvVideoFrame || event.source !== tvVideoFrame.contentWindow) return
    if (typeof event.data !== "string") return
    const playerMessage = JSON.parse(event.data) as {
      event?: string
      info?: unknown
      data?: { seconds?: number }
    }
    if (playerMessage.event === "infoDelivery") {
      const playerInfo = playerMessage.info as {
        currentTime?: number
        playerState?: number
      }
      if (playerInfo.currentTime !== undefined) {
        this.tvVideoSeconds = playerInfo.currentTime
      }
      if (playerInfo.playerState === 1) this.showTvVideoPaused(false)
      if (playerInfo.playerState === 2) this.showTvVideoPaused(true)
    }
    if (
      playerMessage.event === "timeupdate" &&
      playerMessage.data?.seconds !== undefined
    ) {
      this.tvVideoSeconds = playerMessage.data.seconds
    }
    const ended =
      (playerMessage.event === "onStateChange" && playerMessage.info === 0) ||
      playerMessage.event === "ended"
    const failed =
      playerMessage.event === "onError" || playerMessage.event === "error"
    if ((!ended && !failed) || this.tvTrailers.length === 0) return
    if (ended && this.tvTrailerIndex === this.tvTrailers.length - 1) {
      this.stopTvVideo()
      this.showCouchCase(null)
      this.tvTrailerIndex = 0
      return
    }
    this.stepTvTrailer(1)
  }

  // TODO: Validate
  dispose() {
    this.tvVideoHoleMaterial.dispose()
    this.tvBlackScreenMaterial.dispose()
    this.tvVideoRenderer.domElement.remove()
  }
}
