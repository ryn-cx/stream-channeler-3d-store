// TODO: Validate
import * as THREE from "three"
import { CarGenerator } from "three/addons/generators/city/CarGenerator.js"
import dealaGifUrl from "./assets/deala.gif?url"

export type ParkedCar = {
  x: number
  z: number
  turn: number
  spin: THREE.Vector3
  drift: THREE.Vector3
  color: number
  lit: boolean
}

// TODO: Validate
export class ParkingLot {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private parked: ParkedCar[]
  private askew: number
  private dressOutdoors: (group: THREE.Object3D) => void
  private disposed = false
  private cars: CarGenerator | null = null
  private litCars: CarGenerator | null = null
  private carFleet: THREE.Group | null = null
  private litFleet: THREE.Group | null = null
  private cheatCode = ""
  private dealaFleet: THREE.Group | null = null
  private dealaFrames: Array<{ image: ImageBitmap; duration: number }> = []
  private dealaLoading = false
  private dealaMaterials: THREE.MeshBasicMaterial[] = []
  private dealaGeometry: THREE.PlaneGeometry | null = null

  // TODO: Validate
  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    parked: ParkedCar[],
    askew: number,
    dressOutdoors: (group: THREE.Object3D) => void,
  ) {
    this.scene = scene
    this.camera = camera
    this.parked = parked
    this.askew = askew
    this.dressOutdoors = dressOutdoors
    if (this.parked.length > 0) {
      this.cars = new CarGenerator()
      this.litCars = new CarGenerator()
      this.parkCars()
    }
  }

  // TODO: Validate
  setAskew(askew: number) {
    this.askew = askew
    this.parkCars()
  }

  // TODO: Validate
  labelFleetsAsCars() {
    for (const fleet of [this.carFleet, this.litFleet, this.dealaFleet]) {
      fleet?.traverse((object) => {
        object.userData.category ??= "Cars"
      })
    }
  }

  // TODO: Validate
  /**
   * Turn off fog on every mesh material in the group.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private unfog(group: THREE.Object3D) {
    group.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      for (const material of materials) {
        ;(material as THREE.Material & { fog: boolean }).fog = false
      }
    })
  }

  // TODO: Validate
  /**
   * Rebuild the parked cars, with their positions nudged by the askew setting,
   * or animated Deala cutouts in their places when that cheat code is active.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private parkCars() {
    if (!this.cars || !this.litCars || this.parked.length === 0) return
    if (this.carFleet) this.scene.remove(this.carFleet)
    if (this.litFleet) this.scene.remove(this.litFleet)
    if (this.dealaFleet) this.scene.remove(this.dealaFleet)
    const strength = this.askew * this.askew
    // TODO: Validate
    /**
     * Return a parked car's color and placement matrix with its tilt and nudge
     * scaled by the askew setting.
     *
     * TODO: Warning: This docstring was AI generated.
     */
    const place = (car: (typeof this.parked)[number]) => ({
      color: car.color,
      matrix: new THREE.Matrix4()
        .makeRotationY(car.turn + car.spin.y * 0.5 * strength)
        .setPosition(
          car.x + car.drift.x * 1.6 * strength,
          -0.1,
          car.z + car.drift.z * 1.6 * strength,
        ),
    })

    this.carFleet = this.cars.build(
      this.parked.filter((car) => !car.lit).map(place),
    )
    for (const paint of this.cars.materials.values()) {
      ;(paint as { emissiveNode: unknown }).emissiveNode = null
    }
    this.dressOutdoors(this.carFleet)
    this.scene.add(this.carFleet)

    this.litFleet = this.litCars.build(
      this.parked.filter((car) => car.lit).map(place),
    )
    this.unfog(this.litFleet)
    this.scene.add(this.litFleet)

    const geometry = this.cheatCode === "DEALA" ? this.dealaGeometry : null
    this.carFleet.visible = !geometry
    this.litFleet.visible = !geometry
    this.dealaFleet = null
    if (!geometry) return
    this.dealaFleet = new THREE.Group()
    for (const car of this.parked) {
      const cutout = new THREE.Mesh(geometry, this.dealaMaterials[0])
      cutout.userData.yaw = car.turn + car.spin.y * 0.5 * strength
      cutout.userData.frame = 0
      cutout.userData.elapsed = -Math.random() * 5
      cutout.position.set(
        car.x + car.drift.x * 1.6 * strength,
        -0.1,
        car.z + car.drift.z * 1.6 * strength,
      )
      this.dealaFleet.add(cutout)
    }
    this.scene.add(this.dealaFleet)
    this.faceDeala()
  }

  // TODO: Validate
  /**
   * Turn each Deala cutout to the diagonal view nearest the camera, mirroring
   * it to match.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private faceDeala() {
    if (!this.dealaFleet) return
    for (const cutout of this.dealaFleet.children) {
      const yaw = cutout.userData.yaw as number
      const around =
        Math.atan2(
          this.camera.position.x - cutout.position.x,
          this.camera.position.z - cutout.position.z,
        ) - yaw
      const offset =
        Math.PI / 4 +
        (Math.PI / 2) * Math.round((around - Math.PI / 4) / (Math.PI / 2))
      cutout.rotation.y = yaw + offset
      cutout.scale.x = Math.sin(offset) > 0 ? -1 : 1
    }
  }

  // TODO: Validate
  /**
   * Apply a cheat code, loading the Deala animation the first time DEALA is
   * entered and reparking the cars.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setCheatCode(code: string) {
    const cheatCode = code.trim().toUpperCase()
    if (cheatCode === this.cheatCode) return
    this.cheatCode = cheatCode
    if (this.cheatCode === "DEALA" && this.dealaFrames.length === 0) {
      this.loadDeala()
      return
    }
    this.parkCars()
  }

  // TODO: Validate
  /**
   * Download and decode the Deala GIF into per-frame materials and a cutout
   * geometry, then repark the cars.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private async loadDeala() {
    if (this.dealaLoading) return
    this.dealaLoading = true
    const response = await fetch(dealaGifUrl)
    const decoder = new ImageDecoder({
      data: response.body as ReadableStream<Uint8Array>,
      type: "image/gif",
    })
    await decoder.tracks.ready
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 1
    const frames: typeof this.dealaFrames = []
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const { image } = await decoder.decode({ frameIndex })
      frames.push({
        image: await createImageBitmap(image),
        duration: Math.max(20000, image.duration ?? 100000) / 1000000,
      })
      image.close()
    }
    decoder.close()
    if (this.disposed) {
      for (const frame of frames) frame.image.close()
      return
    }
    this.dealaMaterials = frames.map((frame) => {
      const canvas = document.createElement("canvas")
      canvas.width = frame.image.width
      canvas.height = frame.image.height
      canvas.getContext("2d")?.drawImage(frame.image, 0, 0)
      const frameTexture = new THREE.CanvasTexture(canvas)
      frameTexture.colorSpace = THREE.SRGBColorSpace
      return new THREE.MeshBasicMaterial({
        map: frameTexture,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        fog: false,
      })
    })
    const height = (4.2 * frames[0].image.height) / frames[0].image.width
    this.dealaGeometry = new THREE.PlaneGeometry(4.2, height).translate(
      0,
      height * (0.5 - 0.13),
      0,
    )
    this.dealaFrames = frames
    this.parkCars()
  }

  // TODO: Validate
  /**
   * Advance each Deala cutout's GIF frame by the elapsed time and keep it
   * facing the camera.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  animateDeala(delta: number) {
    if (!this.dealaFleet) return
    this.faceDeala()
    for (const cutout of this.dealaFleet.children as THREE.Mesh[]) {
      let frame = cutout.userData.frame as number
      let elapsed = (cutout.userData.elapsed as number) + delta
      while (elapsed >= this.dealaFrames[frame].duration) {
        elapsed -= this.dealaFrames[frame].duration
        frame = (frame + 1) % this.dealaFrames.length
      }
      cutout.userData.elapsed = elapsed
      if (frame === cutout.userData.frame) continue
      cutout.userData.frame = frame
      cutout.material = this.dealaMaterials[frame]
    }
  }

  // TODO: Validate
  dispose() {
    this.disposed = true
    this.cars?.dispose()
    this.litCars?.dispose()
    for (const material of this.dealaMaterials) {
      material.map?.dispose()
      material.dispose()
    }
    this.dealaGeometry?.dispose()
    for (const frame of this.dealaFrames) frame.image.close()
  }
}
