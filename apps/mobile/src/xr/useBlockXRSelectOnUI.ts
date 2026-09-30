import { useEffect } from 'react';

/** Marks an element as interactive UI: taps on it must not reach the AR scene. */
export const XR_UI_ATTRIBUTE = 'data-xr-ui';

/** Spread onto interactive panels: `<div {...XR_UI_PROPS}>`. */
export const XR_UI_PROPS = { [XR_UI_ATTRIBUTE]: '' } as const;

/**
 * In a WebXR dom-overlay session every screen tap also becomes an XR "select" event,
 * so tapping a button would place an object behind it. Chrome fires `beforexrselect`
 * on the tapped DOM element first; cancelling it suppresses the XR input for that tap.
 */
export function useBlockXRSelectOnUI(root: HTMLElement): void {
  useEffect(() => {
    const onBeforeXRSelect = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(`[${XR_UI_ATTRIBUTE}]`)) {
        event.preventDefault();
      }
    };
    root.addEventListener('beforexrselect', onBeforeXRSelect);
    return () => root.removeEventListener('beforexrselect', onBeforeXRSelect);
  }, [root]);
}
