import { Vector3, type Object3D, type Ray } from 'three';
import { engine } from '../engineStore';
import {
  angleBetween,
  dragRotateDelta,
  intersectHorizontalPlane,
  TAP_MAX_ANGLE_RAD,
  TAP_MAX_MS,
  twistDelta,
  type Vec3Like,
} from '../gestures';
import type { InteractableConfig, InteractionRegistry } from '../interaction';

export type PointerKey = number | XRInputSource;

export type PointerKind =
  /** AR, before the area is placed: a tap places it. */
  | 'place'
  /** Pressed on a tappable object; becomes a tap if released without moving. */
  | 'tap'
  /** Dragging a draggable object along a horizontal plane. */
  | 'drag'
  /** Pressed on empty space; in AR it becomes a rotate once it moves. */
  | 'empty'
  | 'rotate'
  /** One of two fingers twisting the area (AR). */
  | 'twist';

interface PointerState {
  kind: PointerKind;
  ray: Ray;
  startDirection: Vector3;
  previousDirection: Vector3;
  startTime: number;
  moved: boolean;
  config: InteractableConfig | null;
  dragPlaneY: number;
  floorPoint: Vec3Like | null;
}

const worldPoint = new Vector3();

/**
 * Turns pointer rays into engine interactions. Both AR screen touches and 3D-mode pointer
 * events are fed in as world-space rays, so the behaviour is identical in the two modes:
 * - press on a draggable → drag it along a horizontal plane,
 * - press + release on a tappable without moving → tap,
 * - AR before placement → tap places the area,
 * - AR after placement, drag on empty space → rotate the area; two fingers → twist.
 */
export class InputController {
  private readonly pointers = new Map<PointerKey, PointerState>();

  constructor(
    private readonly registry: InteractionRegistry,
    /** Ref to the training area root (drags and twists are measured relative to it). */
    private readonly sceneRootRef: { readonly current: Object3D | null },
  ) {}

  has(key: PointerKey): boolean {
    return this.pointers.has(key);
  }

  get activeCount(): number {
    return this.pointers.size;
  }

  kindOf(key: PointerKey): PointerKind | undefined {
    return this.pointers.get(key)?.kind;
  }

  xrKeys(): XRInputSource[] {
    return [...this.pointers.keys()].filter((key): key is XRInputSource => typeof key !== 'number');
  }

  down(key: PointerKey, ray: Ray, now: number): PointerKind {
    const state = engine();
    const pointer: PointerState = {
      kind: 'empty',
      ray: ray.clone(),
      startDirection: ray.direction.clone(),
      previousDirection: ray.direction.clone(),
      startTime: now,
      moved: false,
      config: null,
      dragPlaneY: 0,
      floorPoint: null,
    };

    if (state.mode === 'ar' && state.placement !== 'placed') {
      pointer.kind = 'place';
    } else {
      const hit = this.registry.pick(ray);
      if (hit?.config.drag != null) {
        pointer.kind = 'drag';
        pointer.config = hit.config;
        pointer.dragPlaneY = hit.object.getWorldPosition(worldPoint).y;
        hit.config.drag.onStart?.();
        state.setDragging(hit.config.id);
      } else if (hit?.config.onTap != null) {
        pointer.kind = 'tap';
        pointer.config = hit.config;
      }
    }
    this.pointers.set(key, pointer);
    return pointer.kind;
  }

  move(key: PointerKey, ray: Ray): void {
    const pointer = this.pointers.get(key);
    if (pointer == null) return;
    pointer.ray.copy(ray);
    const direction = ray.direction;
    if (!pointer.moved && angleBetween(pointer.startDirection, direction) > TAP_MAX_ANGLE_RAD) {
      pointer.moved = true;
    }

    const state = engine();
    const canRotate = state.mode === 'ar' && state.placement === 'placed';
    if ((pointer.kind === 'tap' || pointer.kind === 'empty') && pointer.moved && canRotate) {
      pointer.kind = 'rotate';
    }

    if (pointer.kind === 'drag') {
      const local = this.dragPointLocal(pointer);
      if (local != null) pointer.config?.drag?.onMove(local);
    } else if (pointer.kind === 'rotate' && this.pointers.size === 1) {
      const delta = dragRotateDelta(pointer.previousDirection, direction);
      state.rotateScene(delta);
      state.addTurn(delta);
    }
    pointer.previousDirection.copy(direction);
  }

  /** The pointer lost its pose (AR tracking hiccup): treat it as moved so it cannot tap. */
  markMoved(key: PointerKey): void {
    const pointer = this.pointers.get(key);
    if (pointer != null) pointer.moved = true;
  }

  up(key: PointerKey, now: number): void {
    const pointer = this.pointers.get(key);
    if (pointer == null) return;
    this.pointers.delete(key);
    const state = engine();

    if (pointer.kind === 'place') {
      if (!pointer.moved && state.placement === 'surface-found') state.requestPlace();
    } else if (pointer.kind === 'tap') {
      if (!pointer.moved && now - pointer.startTime <= TAP_MAX_MS) pointer.config?.onTap?.();
    } else if (pointer.kind === 'drag') {
      const local = this.dragPointLocal(pointer);
      if (local != null) pointer.config?.drag?.onEnd(local);
      state.setDragging(null);
    }
    // A finger left over from a twist should not jump into a one-finger rotate.
    for (const other of this.pointers.values()) {
      if (other.kind === 'twist') other.kind = 'empty';
    }
  }

  /** AR two-finger twist; call once per frame after the pointer rays were updated. */
  applyTwist(): void {
    const state = engine();
    const root = this.sceneRootRef.current;
    if (state.mode !== 'ar' || state.placement !== 'placed' || root == null) return;
    if (this.pointers.size !== 2) return;
    const [a, b] = [...this.pointers.values()] as [PointerState, PointerState];
    const twistable = (pointer: PointerState) =>
      pointer.kind === 'empty' || pointer.kind === 'rotate' || pointer.kind === 'twist';
    if (!twistable(a) || !twistable(b)) return;

    const floorY = root.getWorldPosition(worldPoint).y;
    const floorA = intersectHorizontalPlane(a.ray.origin, a.ray.direction, floorY);
    const floorB = intersectHorizontalPlane(b.ray.origin, b.ray.direction, floorY);
    if (floorA == null || floorB == null) return;
    if (a.kind === 'twist' && b.kind === 'twist' && a.floorPoint != null && b.floorPoint != null) {
      const delta = twistDelta(a.floorPoint, b.floorPoint, floorA, floorB);
      state.rotateScene(delta);
      state.addTurn(delta);
    }
    a.kind = 'twist';
    b.kind = 'twist';
    a.floorPoint = floorA;
    b.floorPoint = floorB;
  }

  /** Releases everything, finishing any drag where it is (e.g. the session ended). */
  cancelAll(): void {
    for (const pointer of this.pointers.values()) {
      if (pointer.kind !== 'drag') continue;
      const local = this.dragPointLocal(pointer);
      if (local != null) pointer.config?.drag?.onEnd(local);
    }
    this.pointers.clear();
    engine().setDragging(null);
  }

  private dragPointLocal(pointer: PointerState): Vector3 | null {
    const hit = intersectHorizontalPlane(
      pointer.ray.origin,
      pointer.ray.direction,
      pointer.dragPlaneY,
    );
    const root = this.sceneRootRef.current;
    if (hit == null || root == null) return null;
    return root.worldToLocal(new Vector3(hit.x, hit.y, hit.z));
  }
}
