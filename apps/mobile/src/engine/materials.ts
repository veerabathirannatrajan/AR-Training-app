import { MeshLambertMaterial, type Side } from 'three';

const cache = new Map<string, MeshLambertMaterial>();

/**
 * Shared flat-shaded material per colour. Lambert is cheaper than Standard on mobile GPUs and,
 * with flatShading, gives the faceted low-poly look. Sharing keeps GPU state changes minimal.
 */
export function flatMaterial(
  color: string,
  options: { transparent?: boolean; opacity?: number; side?: Side } = {},
): MeshLambertMaterial {
  const key = `${color}|${options.opacity ?? 1}|${options.side ?? 0}`;
  let material = cache.get(key);
  if (material == null) {
    material = new MeshLambertMaterial({ color, flatShading: true });
    if (options.opacity != null && options.opacity < 1) {
      material.transparent = true;
      material.opacity = options.opacity;
      material.depthWrite = false;
    }
    if (options.side != null) material.side = options.side;
    cache.set(key, material);
  }
  return material;
}
