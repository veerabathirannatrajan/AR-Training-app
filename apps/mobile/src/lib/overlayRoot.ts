function resolveOverlayRoot(): HTMLElement {
  const element = document.getElementById('xr-overlay');
  if (element == null) {
    throw new Error('#xr-overlay element is missing from index.html');
  }
  return element;
}

/**
 * Container for every UI panel. It sits above the canvas in 3D mode and is handed to
 * WebXR as the dom-overlay root, so the same React UI floats over the camera in AR.
 */
export const overlayRoot = resolveOverlayRoot();
