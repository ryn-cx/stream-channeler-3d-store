// TODO: Validate
import * as THREE from "three"
import { createRippleTexture } from "./caseTexture"

// TODO: Validate
export class Rain {
  private rain: THREE.LineSegments | null = null
  private splashes: THREE.InstancedMesh | null = null
  private ripples: Array<{ x: number; y: number; z: number; age: number }> = []
  private rippleCursor = 0
  private rainSpeed = 8
  private rainSpanX: number
  private rainSpanZ: number
  private rainCenterZ: number
  private rainRoofX: number
  private rainRoofZ: number
  readonly tvRoomRainRoof = new THREE.Box2()
  private rainDropPoint = new THREE.Vector2()

  // TODO: Validate
  constructor(
    scene: THREE.Scene,
    rainSpanX: number,
    rainSpanZ: number,
    rainCenterZ: number,
    rainRoofX: number,
    rainRoofZ: number,
  ) {
    this.rainSpanX = rainSpanX
    this.rainSpanZ = rainSpanZ
    this.rainCenterZ = rainCenterZ
    this.rainRoofX = rainRoofX
    this.rainRoofZ = rainRoofZ
    const streaks = new Float32Array(20000 * 6)
    for (let drop = 0; drop < 20000; drop++) {
      this.seedDrop(streaks, drop * 6, Math.random() * 26)
    }
    const rainGeometry = new THREE.BufferGeometry()
    rainGeometry.setAttribute("position", new THREE.BufferAttribute(streaks, 3))
    rainGeometry.setDrawRange(0, 0)
    this.rain = new THREE.LineSegments(
      rainGeometry,
      new THREE.LineBasicMaterial({
        color: 0xc4dcff,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        fog: false,
      }),
    )
    this.rain.frustumCulled = false
    scene.add(this.rain)

    for (let ripple = 0; ripple < 500; ripple++) {
      this.ripples.push({ x: 0, y: 0, z: 0, age: 1 })
    }
    this.splashes = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: createRippleTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
      500,
    )
    const resting = new THREE.Matrix4()
    const unlit = new THREE.Color(0, 0, 0)
    for (let ripple = 0; ripple < 500; ripple++) {
      this.splashes.setMatrixAt(ripple, resting)
      this.splashes.setColorAt(ripple, unlit)
    }
    this.splashes.frustumCulled = false
    this.splashes.count = 0
    scene.add(this.splashes)
  }

  // TODO: Validate
  /**
   * Place a rain streak at a random spot over the lot starting at the given
   * height.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private seedDrop(streaks: Float32Array, offset: number, top: number) {
    const x = (Math.random() - 0.5) * this.rainSpanX
    const z = (Math.random() - 0.5) * this.rainSpanZ + this.rainCenterZ
    streaks[offset] = x
    streaks[offset + 1] = top
    streaks[offset + 2] = z
    streaks[offset + 3] = x
    streaks[offset + 4] = top - 0.7
    streaks[offset + 5] = z
  }

  // TODO: Validate
  /**
   * Set how many rain streaks fall and how fast.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  setRain(drops: number, speed: number) {
    this.rainSpeed = speed
    this.rain?.geometry.setDrawRange(0, Math.round(drops) * 2)
  }

  // TODO: Validate
  /**
   * Move rain streaks down, splashing and respawning the ones that reach the
   * ground or the roof, and grow the splash ripples.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  fallRain(delta: number) {
    if (!this.rain) return
    const falling = this.rain.geometry.drawRange.count / 2
    this.rain.visible = falling > 0
    if (!this.rain.visible) return

    const attribute = this.rain.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute
    const streaks = attribute.array as Float32Array
    const drop = this.rainSpeed * delta
    for (let index = 0; index < falling; index++) {
      const offset = index * 6
      streaks[offset + 1] -= drop
      streaks[offset + 4] -= drop
      const sheltered =
        (Math.abs(streaks[offset]) < this.rainRoofX &&
          streaks[offset + 2] < this.rainRoofZ) ||
        this.tvRoomRainRoof.containsPoint(
          this.rainDropPoint.set(streaks[offset], streaks[offset + 2]),
        )
      if (streaks[offset + 4] > (sheltered ? 3.3 : 0)) continue
      this.splash(streaks[offset], sheltered ? 3.3 : 0, streaks[offset + 2])
      this.seedDrop(streaks, offset, 26)
    }
    attribute.needsUpdate = true
    this.spreadSplashes(delta)
  }

  // TODO: Validate
  /**
   * Start a ripple at the given point, reusing the oldest ripple slot.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private splash(x: number, y: number, z: number) {
    const ripple = this.ripples[this.rippleCursor]
    this.rippleCursor = (this.rippleCursor + 1) % this.ripples.length
    ripple.x = x
    ripple.y = y
    ripple.z = z
    ripple.age = 0
  }

  // TODO: Validate
  /**
   * Age the active ripples, widening and fading them, and draw them as splash
   * instances.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  private spreadSplashes(delta: number) {
    if (!this.splashes) return
    const placement = new THREE.Matrix4()
    const fade = new THREE.Color()
    let shown = 0
    for (const ripple of this.ripples) {
      if (ripple.age >= 1) continue
      ripple.age = Math.min(1, ripple.age + delta * 2.6)
      const spread = 0.12 + ripple.age * 0.75
      placement.makeScale(spread, 1, spread)
      placement.setPosition(ripple.x, ripple.y + 0.02, ripple.z)
      this.splashes.setMatrixAt(shown, placement)
      fade.setScalar((1 - ripple.age) * 0.7)
      this.splashes.setColorAt(shown, fade)
      shown++
    }
    this.splashes.count = shown
    this.splashes.instanceMatrix.needsUpdate = true
    if (this.splashes.instanceColor) {
      this.splashes.instanceColor.needsUpdate = true
    }
  }
}
