import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { Raycaster, type Object3D, type Ray, type Vector3 } from 'three';

export interface DragHandlers {
  onStart?: () => void;
  /** Point on the drag plane, in the training area's local coordinates. */
  onMove: (localPoint: Vector3) => void;
  onEnd: (localPoint: Vector3) => void;
}

export interface InteractableConfig {
  id: string;
  enabled: boolean;
  onTap?: () => void;
  drag?: DragHandlers;
}

export interface AimTargetConfig {
  id: string;
  enabled: boolean;
  /** Radius around the object's origin that counts as "on target", metres. */
  radius: number;
}

interface InteractableEntry {
  object: Object3D;
  config: MutableRefObject<InteractableConfig>;
}

interface AimTargetEntry {
  object: Object3D;
  config: MutableRefObject<AimTargetConfig>;
}

export interface PickResult {
  object: Object3D;
  config: InteractableConfig;
  point: Vector3;
}

/** Everything a module scene can interact with. Owned by <InteractionProvider>. */
export class InteractionRegistry {
  private readonly interactables = new Map<Object3D, InteractableEntry>();
  readonly aimTargets = new Set<AimTargetEntry>();
  private readonly raycaster = new Raycaster();

  addInteractable(entry: InteractableEntry): () => void {
    this.interactables.set(entry.object, entry);
    return () => this.interactables.delete(entry.object);
  }

  addAimTarget(entry: AimTargetEntry): () => void {
    this.aimTargets.add(entry);
    return () => this.aimTargets.delete(entry);
  }

  /** Nearest enabled interactable hit by the ray. */
  pick(ray: Ray): PickResult | null {
    const roots: Object3D[] = [];
    for (const entry of this.interactables.values()) {
      if (entry.config.current.enabled && entry.object.visible) roots.push(entry.object);
    }
    if (roots.length === 0) return null;

    this.raycaster.ray.copy(ray);
    for (const hit of this.raycaster.intersectObjects(roots, true)) {
      // Walk up from the mesh that was hit to the registered root.
      let node: Object3D | null = hit.object;
      while (node != null && !this.interactables.has(node)) node = node.parent;
      if (node == null) continue;
      const entry = this.interactables.get(node);
      if (entry == null) continue;
      return { object: entry.object, config: entry.config.current, point: hit.point.clone() };
    }
    return null;
  }
}

export const RegistryContext = createContext<InteractionRegistry | null>(null);

export function useInteractionRegistry(): InteractionRegistry {
  const registry = useContext(RegistryContext);
  if (registry == null)
    throw new Error('useInteractionRegistry must be used inside <InteractionProvider>');
  return registry;
}

/**
 * Makes an object tappable and/or draggable. The config is read at event time, so handlers
 * can change every render without re-registering.
 */
export function useInteractable(ref: RefObject<Object3D | null>, config: InteractableConfig): void {
  const registry = useInteractionRegistry();
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });
  useEffect(() => {
    const object = ref.current;
    if (object == null) return;
    return registry.addInteractable({ object, config: configRef });
  }, [registry, ref]);
}

/** Registers an object the crosshair can aim at (see AimSystem). */
export function useAimTarget(ref: RefObject<Object3D | null>, config: AimTargetConfig): void {
  const registry = useInteractionRegistry();
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });
  useEffect(() => {
    const object = ref.current;
    if (object == null) return;
    return registry.addAimTarget({ object, config: configRef });
  }, [registry, ref]);
}
