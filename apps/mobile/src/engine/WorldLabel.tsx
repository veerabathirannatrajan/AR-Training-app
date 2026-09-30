import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type Group } from 'three';
import { overlayRoot } from '../lib/overlayRoot';

export type WorldLabelVariant = 'tag' | 'danger' | 'ok' | 'info';

const projected = new Vector3();
const LAYER_CLASS = 'world-labels';

function labelLayer(): HTMLElement {
  let layer = overlayRoot.querySelector<HTMLElement>(`.${LAYER_CLASS}`);
  if (layer == null) {
    layer = document.createElement('div');
    layer.className = LAYER_CLASS;
    overlayRoot.prepend(layer);
  }
  return layer;
}

/**
 * A crisp DOM label pinned to a point in the 3D scene (e.g. "CO₂ · Tap to pick up"). It lives
 * in the dom-overlay, so it also shows over the camera in AR, and renders every script with the
 * bundled fonts. Positioned each frame without React re-renders; hidden when behind the camera.
 */
export function WorldLabel({
  position = [0, 0, 0],
  title,
  subtitle,
  variant = 'tag',
  visible = true,
}: {
  position?: readonly [number, number, number];
  title: string;
  subtitle?: string | undefined;
  variant?: WorldLabelVariant;
  visible?: boolean;
}) {
  const anchorRef = useRef<Group>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  /** Half the label's width, measured after its text changes (keeps it on screen). */
  const halfWidthRef = useRef(0);

  useEffect(() => {
    const element = document.createElement('div');
    element.className = 'world-label';
    labelLayer().append(element);
    elementRef.current = element;
    return () => {
      element.remove();
      elementRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (element == null) return;
    element.className = `world-label world-label-${variant}`;
    element.replaceChildren();
    const titleNode = document.createElement('strong');
    titleNode.textContent = title;
    element.append(titleNode);
    if (subtitle != null) {
      const subtitleNode = document.createElement('span');
      subtitleNode.textContent = subtitle;
      element.append(subtitleNode);
    }
    halfWidthRef.current = element.offsetWidth / 2;
  }, [title, subtitle, variant]);

  useFrame(({ camera, size }) => {
    const anchor = anchorRef.current;
    const element = elementRef.current;
    if (anchor == null || element == null) return;
    let shown = visible;
    for (let node: typeof anchor.parent = anchor; shown && node != null; node = node.parent) {
      if (!node.visible) shown = false;
    }
    if (shown) {
      projected.setFromMatrixPosition(anchor.matrixWorld).project(camera);
      shown = projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
    }
    if (!shown) {
      element.style.visibility = 'hidden';
      return;
    }
    const margin = 8;
    const halfWidth = halfWidthRef.current || element.offsetWidth / 2;
    halfWidthRef.current = halfWidth;
    const rawX = ((projected.x + 1) / 2) * size.width;
    const x = Math.min(size.width - margin - halfWidth, Math.max(margin + halfWidth, rawX));
    const y = ((1 - projected.y) / 2) * size.height;
    element.style.visibility = 'visible';
    element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  });

  return <group ref={anchorRef} position={[position[0], position[1], position[2]]} />;
}
