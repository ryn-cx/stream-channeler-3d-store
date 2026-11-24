// TODO: Validate
import type * as THREE from "three"

// TODO: Validate
export class CoverDownloadQueue {
  private camera: THREE.PerspectiveCamera
  private coverWanted: (mesh: THREE.Mesh) => boolean
  private onCovers: (pending: number) => void
  private disposed = false
  private pendingImages: Array<{ mesh: THREE.Mesh; run: () => void }> = []
  private activeImages = 0
  private reportedCovers = 0
  private paintQueue: Array<() => void> = []
  private paintAllowance = 10
  private paintCheckedAt = performance.now()

  // TODO: Validate
  constructor(
    camera: THREE.PerspectiveCamera,
    coverWanted: (mesh: THREE.Mesh) => boolean,
    onCovers: (pending: number) => void,
  ) {
    this.camera = camera
    this.coverWanted = coverWanted
    this.onCovers = onCovers
  }

  // TODO: Validate
  enqueue<Downloaded>(
    mesh: THREE.Mesh,
    download: () => Promise<Downloaded>,
    paint: (downloaded: Downloaded) => void,
  ) {
    // TODO: Validate
    const run = () => {
      this.activeImages++
      // TODO: Validate
      const finish = (downloaded: Downloaded) => {
        this.activeImages--
        this.paintQueue.push(() => paint(downloaded))
        this.nextImage()
        this.reportCovers()
      }
      void download().then(finish)
    }
    this.pendingImages.push({ mesh, run })
    this.reportCovers()
  }

  // TODO: Validate
  remove(mesh: THREE.Mesh) {
    this.pendingImages = this.pendingImages.filter(
      (entry) => entry.mesh !== mesh,
    )
    this.reportCovers()
  }

  // TODO: Validate
  /**
   * Run queued cover paints within a refilling allowance and a four millisecond
   * budget per frame.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  paintCovers() {
    const started = performance.now()
    this.paintAllowance = Math.min(
      10,
      this.paintAllowance + (started - this.paintCheckedAt) * 0.1,
    )
    this.paintCheckedAt = started
    if (this.paintQueue.length === 0) return
    while (
      this.paintQueue.length > 0 &&
      this.paintAllowance >= 1 &&
      performance.now() - started < 4
    ) {
      this.paintAllowance--
      this.paintQueue.shift()?.()
    }
    this.reportCovers()
  }

  // TODO: Validate
  /**
   * Report the number of covers still queued, downloading, or waiting to paint
   * when it changes.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private reportCovers() {
    const pending =
      this.pendingImages.length + this.activeImages + this.paintQueue.length
    if (this.disposed || pending === this.reportedCovers) return
    this.reportedCovers = pending
    this.onCovers(pending)
  }

  // TODO: Validate
  /**
   * Start queued cover downloads nearest the camera first, up to 32 at once,
   * dropping ones no longer wanted.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  nextImage() {
    while (
      !this.disposed &&
      this.activeImages < 32 &&
      this.pendingImages.length > 0
    ) {
      let nearest = 0
      let shortest = Number.POSITIVE_INFINITY
      for (let index = 0; index < this.pendingImages.length; index++) {
        const distance = this.pendingImages[
          index
        ].mesh.position.distanceToSquared(this.camera.position)
        if (distance < shortest) {
          shortest = distance
          nearest = index
        }
      }
      const [entry] = this.pendingImages.splice(nearest, 1)
      if (this.coverWanted(entry.mesh)) entry.run()
      else delete entry.mesh.userData.imageQueued
    }
    this.reportCovers()
  }

  // TODO: Validate
  dispose() {
    this.disposed = true
  }
}
