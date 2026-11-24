// TODO: Validate
import * as THREE from "three"

// TODO: Validate
export class PlayerMovement {
  private camera: THREE.PerspectiveCamera
  private touch: boolean
  private colliders: THREE.Box3[]
  private doorLeaves: Array<{ open: boolean; collider: THREE.Box3 }>
  private couchStandingPosition: THREE.Vector3
  private pressed = new Set<string>()
  private velocity = new THREE.Vector3()
  eyeHeight = 1.65
  private sittingOnCouch = false
  private touchMove = new THREE.Vector2()
  private touchRun = false
  private touchCrouch = false

  // TODO: Validate
  constructor(
    camera: THREE.PerspectiveCamera,
    touch: boolean,
    colliders: THREE.Box3[],
    doorLeaves: Array<{ open: boolean; collider: THREE.Box3 }>,
    couchStandingPosition: THREE.Vector3,
  ) {
    this.camera = camera
    this.touch = touch
    this.colliders = colliders
    this.doorLeaves = doorLeaves
    this.couchStandingPosition = couchStandingPosition
  }

  // TODO: Validate
  pressKey(code: string) {
    this.pressed.add(code)
  }

  // TODO: Validate
  releaseKey(code: string) {
    this.pressed.delete(code)
  }

  // TODO: Validate
  releaseKeys() {
    this.pressed.clear()
    this.velocity.set(0, 0, 0)
  }

  // TODO: Validate
  setTouchMove(joystickX: number, joystickY: number, running: boolean) {
    this.touchMove.set(joystickX, joystickY)
    this.touchRun = running
  }

  // TODO: Validate
  setTouchCrouch(crouching: boolean) {
    this.touchCrouch = crouching
  }

  // TODO: Validate
  stopTouchMove() {
    this.touchMove.set(0, 0)
    this.velocity.set(0, 0, 0)
  }

  // TODO: Validate
  sitOnCouch() {
    this.velocity.set(0, 0, 0)
    this.sittingOnCouch = true
  }

  // TODO: Validate
  placeAt(spotX: number, spotZ: number) {
    this.velocity.set(0, 0, 0)
    this.sittingOnCouch = false
    this.camera.position.set(spotX, this.eyeHeight, spotZ)
  }

  // TODO: Validate
  /**
   * Return whether a point is inside a box widened by the player's radius.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  overlaps(box: THREE.Box3, x: number, z: number) {
    return (
      x > box.min.x - 0.32 &&
      x < box.max.x + 0.32 &&
      z > box.min.z - 0.32 &&
      z < box.max.z + 0.32
    )
  }

  // TODO: Validate
  /**
   * Return whether a point collides with a wall, fixture, or closed door.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  blocked(x: number, z: number) {
    for (const box of this.colliders) {
      if (this.overlaps(box, x, z)) return true
    }
    for (const leaf of this.doorLeaves) {
      if (!leaf.open && this.overlaps(leaf.collider, x, z)) return true
    }
    return false
  }

  // TODO: Validate
  /**
   * Move the camera from keyboard or touch input with walking, running, and
   * crouching speeds, sliding along colliders and bobbing while moving.
   *
   * TODO: Warning: This docstring was AI generated.
   */
  move(delta: number) {
    const forward = new THREE.Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    const right = new THREE.Vector3().crossVectors(
      forward,
      new THREE.Vector3(0, 1, 0),
    )

    const direction = new THREE.Vector3()
    if (this.touch) {
      direction.addScaledVector(forward, this.touchMove.y)
      direction.addScaledVector(right, this.touchMove.x)
    }
    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) {
      direction.add(forward)
    }
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) {
      direction.sub(forward)
    }
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) {
      direction.add(right)
    }
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) {
      direction.sub(right)
    }

    const position = this.camera.position
    if (this.sittingOnCouch) {
      if (direction.lengthSq() === 0) return
      this.sittingOnCouch = false
      position.copy(this.couchStandingPosition)
    }

    const crouching = this.pressed.has("KeyC") || this.touchCrouch
    const running =
      !crouching &&
      (this.pressed.has("ShiftLeft") ||
        this.pressed.has("ShiftRight") ||
        this.touchRun)
    const speed = crouching ? 1.15 : running ? 5.4 : 2.6
    if (direction.lengthSq() > 0) direction.normalize().multiplyScalar(speed)
    this.velocity.lerp(direction, Math.min(1, delta * 12))

    const nextX = position.x + this.velocity.x * delta
    if (!this.blocked(nextX, position.z)) position.x = nextX
    const nextZ = position.z + this.velocity.z * delta
    if (!this.blocked(position.x, nextZ)) position.z = nextZ

    this.eyeHeight = THREE.MathUtils.damp(
      this.eyeHeight,
      crouching ? 0.78 : 1.65,
      11,
      delta,
    )
    const moving = this.velocity.length() > 0.4
    const bob = crouching ? 0.009 : 0.02
    position.y =
      this.eyeHeight + (moving ? Math.sin(performance.now() / 145) * bob : 0)
  }
}
