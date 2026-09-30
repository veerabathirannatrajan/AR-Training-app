import { useFrame, useThree } from '@react-three/fiber';
import { useXRHitTest } from '@react-three/xr';
import { useEffect, useRef } from 'react';
import { Matrix4, Quaternion, Vector3, type Group } from 'three';
import { engine, useEngineStore } from './engineStore';
import { Reticle } from './primitives/Reticle';
import { useSceneRoot } from './sceneRootContext';

/** Surfaces within 25° of level count as floor. */
const MIN_UP_DOT = Math.cos((25 * Math.PI) / 180);
const APPEAR_SECONDS = 0.35;

const hitMatrix = new Matrix4();
const hitPosition = new Vector3();
const hitRotation = new Quaternion();
const hitScale = new Vector3();
const normal = new Vector3();
const cameraPosition = new Vector3();

/**
 * AR placement: floor reticle from centre-screen hit tests, tap to place the training area
 * facing the worker, then keep it on an ARCore anchor so it stays put as tracking improves.
 * "Move area" (requestReposition) brings the reticle back.
 */
export function ARPlacement() {
  const rootRef = useSceneRoot();
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const reticleRef = useRef<Group>(null);
  const surfaceFound = useRef(false);
  const anchor = useRef<XRAnchor | null>(null);
  const baseYaw = useRef(0);
  const appearAge = useRef(APPEAR_SECONDS);

  const dropAnchor = () => {
    anchor.current?.delete();
    anchor.current = null;
  };

  useXRHitTest(
    (results, getWorldMatrix) => {
      const reticle = reticleRef.current;
      const group = rootRef.current;
      if (reticle == null || group == null) return;
      const state = engine();
      if (state.placement === 'placed') {
        reticle.visible = false;
        return;
      }

      let found: XRHitTestResult | null = null;
      for (const result of results) {
        if (!getWorldMatrix(hitMatrix, result)) continue;
        hitMatrix.decompose(hitPosition, hitRotation, hitScale);
        normal.set(0, 1, 0).applyQuaternion(hitRotation);
        if (normal.y < MIN_UP_DOT) continue;
        found = result;
        break;
      }

      reticle.visible = found != null;
      if (found != null) reticle.position.copy(hitPosition);
      if ((found != null) !== surfaceFound.current) {
        surfaceFound.current = found != null;
        state.setSurfaceFound(found != null);
      }

      // Anchors can only be created from a hit result inside its own XR frame, so a tap just
      // raises placeRequested and the placement happens here.
      if (found != null && state.placeRequested) {
        camera.getWorldPosition(cameraPosition);
        baseYaw.current = Math.atan2(
          cameraPosition.x - hitPosition.x,
          cameraPosition.z - hitPosition.z,
        );
        group.position.copy(hitPosition);
        appearAge.current = 0;
        dropAnchor();
        const request = found.createAnchor?.();
        request
          ?.then((created) => {
            if (engine().placement === 'placed' && anchor.current == null) anchor.current = created;
            else created.delete();
          })
          .catch((error: unknown) =>
            console.info('[ar] anchor unavailable, using static placement', error),
          );
        surfaceFound.current = false;
        state.confirmPlaced();
      }
    },
    'viewer',
    'plane',
  );

  // Leaving the placed state (Move area) releases the anchor.
  useEffect(
    () =>
      useEngineStore.subscribe((state, previous) => {
        if (previous.placement === 'placed' && state.placement !== 'placed') dropAnchor();
      }),
    [],
  );
  useEffect(() => dropAnchor, []);

  useFrame((_state, delta, frame: XRFrame | undefined) => {
    const group = rootRef.current;
    if (group == null) return;
    group.rotation.y = baseYaw.current + engine().sceneYaw;

    const tracked = anchor.current;
    const referenceSpace = gl.xr.getReferenceSpace();
    if (
      frame != null &&
      tracked != null &&
      referenceSpace != null &&
      frame.trackedAnchors?.has(tracked)
    ) {
      const pose = frame.getPose(tracked.anchorSpace, referenceSpace);
      if (pose != null) {
        const { x, y, z } = pose.transform.position;
        group.position.set(x, y, z);
      }
    }

    if (appearAge.current < APPEAR_SECONDS) {
      appearAge.current = Math.min(APPEAR_SECONDS, appearAge.current + delta);
      const t = appearAge.current / APPEAR_SECONDS;
      group.scale.setScalar(0.85 + 0.15 * (1 - (1 - t) ** 3));
    }
  });

  return <Reticle ref={reticleRef} />;
}
