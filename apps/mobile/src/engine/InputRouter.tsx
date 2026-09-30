import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { useEffect, useState } from 'react';
import { Quaternion, Ray, Vector2 } from 'three';
import { engine, useEngineStore } from './engineStore';
import { InputController } from './input/InputController';
import { useInteractionRegistry } from './interaction';
import { useSceneRoot } from './sceneRootContext';
import { xrStore } from './xr/xrStore';

const ndc = new Vector2();
const quaternion = new Quaternion();

/**
 * Feeds touches into the InputController:
 * - AR: WebXR "screen" input sources (select start/end plus a target-ray pose every frame),
 * - 3D mode: pointer events on the canvas, cast from the camera.
 * Taps on UI panels never arrive here (see useBlockXRSelectOnUI and the overlay's pointer-events).
 */
export function InputRouter() {
  const registry = useInteractionRegistry();
  const sceneRootRef = useSceneRoot();
  const get = useThree((state) => state.get);
  const gl = useThree((state) => state.gl);
  const session = useXR((state) => state.session);
  const mode = useEngineStore((state) => state.mode);
  const [controller] = useState(() => new InputController(registry, sceneRootRef));

  // ---- 3D mode: canvas pointer events ----
  useEffect(() => {
    if (mode !== 'fallback3d') return;
    const element = gl.domElement;
    const toRay = (event: PointerEvent) => {
      const { camera } = get();
      const rect = element.getBoundingClientRect();
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new Ray();
      ray.origin.setFromMatrixPosition(camera.matrixWorld);
      ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(ray.origin).normalize();
      return ray;
    };
    const orbitControls = () => get().controls as { enabled: boolean } | null;

    // Capture phase, so starting a drag can disable OrbitControls before it sees the event.
    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      const kind = controller.down(event.pointerId, toRay(event), event.timeStamp);
      if (kind === 'drag') {
        const orbit = orbitControls();
        if (orbit != null) orbit.enabled = false;
        element.setPointerCapture(event.pointerId);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (controller.has(event.pointerId)) controller.move(event.pointerId, toRay(event));
    };
    const onUp = (event: PointerEvent) => {
      if (!controller.has(event.pointerId)) return;
      const wasDrag = controller.kindOf(event.pointerId) === 'drag';
      controller.up(event.pointerId, event.timeStamp);
      const orbit = orbitControls();
      if (wasDrag && orbit != null && !engine().gyroEnabled) orbit.enabled = true;
    };

    element.addEventListener('pointerdown', onDown, { capture: true });
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    return () => {
      element.removeEventListener('pointerdown', onDown, { capture: true });
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      controller.cancelAll();
    };
  }, [controller, gl, get, mode]);

  // ---- AR: WebXR screen input ----
  useEffect(() => {
    if (session == null) return;
    const onSelectStart = (event: XRInputSourceEvent) => {
      if (event.inputSource.targetRayMode !== 'screen') return;
      const ray = rayFromPose(event.frame, event.inputSource, gl.xr.getReferenceSpace());
      if (ray != null) controller.down(event.inputSource, ray, performance.now());
    };
    const onSelectEnd = (event: XRInputSourceEvent) => {
      if (!controller.has(event.inputSource)) return;
      const ray = rayFromPose(event.frame, event.inputSource, gl.xr.getReferenceSpace());
      if (ray != null) controller.move(event.inputSource, ray);
      controller.up(event.inputSource, performance.now());
    };
    session.addEventListener('selectstart', onSelectStart);
    session.addEventListener('selectend', onSelectEnd);
    return () => {
      session.removeEventListener('selectstart', onSelectStart);
      session.removeEventListener('selectend', onSelectEnd);
      controller.cancelAll();
    };
  }, [controller, session, gl]);

  // AR touches only report their pose inside XR frames, so poll them every frame.
  useFrame((_state, _delta, frame: XRFrame | undefined) => {
    if (frame == null || controller.activeCount === 0) return;
    const referenceSpace = gl.xr.getReferenceSpace();
    for (const inputSource of controller.xrKeys()) {
      const ray = rayFromPose(frame, inputSource, referenceSpace);
      if (ray != null) controller.move(inputSource, ray);
      else controller.markMoved(inputSource);
    }
    controller.applyTwist();
  });

  return null;
}

/** World-space ray of an XR input source (reference space → world via the XR origin). */
function rayFromPose(
  frame: XRFrame,
  inputSource: XRInputSource,
  referenceSpace: XRReferenceSpace | null,
): Ray | null {
  if (referenceSpace == null) return null;
  const pose = frame.getPose(inputSource.targetRaySpace, referenceSpace);
  if (pose == null) return null;
  const { position, orientation } = pose.transform;
  const ray = new Ray();
  ray.origin.set(position.x, position.y, position.z);
  quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
  ray.direction.set(0, 0, -1).applyQuaternion(quaternion);
  const origin = xrStore.getState().origin;
  if (origin != null) ray.applyMatrix4(origin.matrixWorld);
  return ray;
}
