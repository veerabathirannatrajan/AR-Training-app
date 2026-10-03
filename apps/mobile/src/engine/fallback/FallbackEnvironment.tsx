import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { BackSide, Quaternion, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { engine, useEngineStore } from '../engineStore';
import { angleDelta } from '../gestures';
import { flatMaterial } from '../materials';
import { PALETTE } from '../palette';
import { deviceQuaternion, screenAngle } from './gyro';
import { DEFAULT_FALLBACK_VIEW, fallbackFov, type FallbackView } from './view';

const CROUCH_DROP = 0.65;
/** In look mode the orbit centre sits this far in front of the eye, so dragging turns the view. */
const LOOK_RADIUS = 0.05;
/** Orbit distance when returning from look mode (within the orbit min/max distance). */
const ORBIT_RADIUS = 2;
const ROOM_SIZE = 8;
const ROOM_HEIGHT = 3.2;
const ROOM_SINK = 0.5;

const latestDevice = new Quaternion();
const relative = new Quaternion();
const lookDirection = new Vector3();

/**
 * 3D mode for phones without WebXR AR: the same training area in a simple low-poly room.
 * - Touch: drag orbits the area, pinch zooms.
 * - While the crosshair is in use (aim steps) dragging turns the view in place instead, so
 *   the centre of the screen can be pointed at things just like the phone in AR.
 * - Gyro: turn the phone to look around. Crouch button: lowers the eye height.
 */
export function FallbackEnvironment({ view = DEFAULT_FALLBACK_VIEW }: { view?: FallbackView }) {
  // The camera is read through get() so effects and frames mutate it outside React's render data.
  const get = useThree((state) => state.get);
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const gyroEnabled = useEngineStore((state) => state.gyroEnabled);
  const aimActive = useEngineStore((state) => state.aimActive);
  const cameraDirected = useEngineStore((state) => state.cameraDirected);
  const crouchOffset = useRef(0);
  const hasDeviceOrientation = useRef(false);
  const gyroBase = useRef<{ inverseDevice: Quaternion; camera: Quaternion } | null>(null);

  useEffect(() => {
    get().camera.position.set(...view.position);
    controlsRef.current?.target.set(...view.target);
    controlsRef.current?.update();
  }, [get, view]);

  // Wider than the AR camera, and wider still on portrait screens, which otherwise see only a
  // narrow slice of the training area.
  useEffect(() => {
    const camera = get().camera;
    if (!('fov' in camera)) return undefined;
    const previousFov = camera.fov;
    camera.fov = fallbackFov(aspect);
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = previousFov;
      camera.updateProjectionMatrix();
    };
  }, [get, aspect]);

  // Switch between orbiting the area and looking around from where the camera stands.
  // (Skipped on mount, where the orbit centre is the middle of the training area.)
  const lookModeApplied = useRef(false);
  useEffect(() => {
    const orbit = controlsRef.current;
    if (orbit == null || aimActive === lookModeApplied.current) return;
    lookModeApplied.current = aimActive;
    const { camera } = get();
    // Either way the orbit centre stays on the current line of sight, so the view never jumps.
    camera.getWorldDirection(lookDirection);
    orbit.target
      .copy(camera.position)
      .addScaledVector(lookDirection, aimActive ? LOOK_RADIUS : ORBIT_RADIUS);
    orbit.update();
  }, [aimActive, get]);

  // Orbit turning counts towards "look around the area" steps.
  useEffect(() => {
    const orbit = controlsRef.current;
    if (orbit == null) return;
    let previous = orbit.getAzimuthalAngle();
    const onChange = () => {
      const azimuth = orbit.getAzimuthalAngle();
      const delta = angleDelta(previous, azimuth);
      previous = azimuth;
      if (delta !== 0) engine().addTurn(delta);
    };
    orbit.addEventListener('change', onChange);
    return () => orbit.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha == null || event.beta == null || event.gamma == null) return;
      deviceQuaternion(event.alpha, event.beta, event.gamma, screenAngle(), latestDevice);
      hasDeviceOrientation.current = true;
      if (!engine().gyroAvailable) engine().setGyroAvailable(true);
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, []);

  useEffect(() => {
    gyroBase.current = null;
    // Leaving gyro: re-aim the orbit from where the camera now looks, so the view does not jump.
    const orbit = controlsRef.current;
    if (!gyroEnabled && engine().aimActive && orbit != null) {
      const { camera } = get();
      camera.getWorldDirection(lookDirection);
      orbit.target.copy(camera.position).addScaledVector(lookDirection, LOOK_RADIUS);
      orbit.update();
    }
  }, [gyroEnabled, get]);

  useFrame(({ camera }, delta) => {
    // A module steering the camera handles crouching itself.
    if (engine().cameraDirected) return;
    // Crouch: ease the eye (and orbit centre) down while the button is held.
    const goal = engine().crouchHeld ? -CROUCH_DROP : 0;
    const next = crouchOffset.current + (goal - crouchOffset.current) * Math.min(1, delta * 8);
    const shift = next - crouchOffset.current;
    crouchOffset.current = next;
    if (Math.abs(shift) > 1e-5) {
      camera.position.y += shift;
      const orbit = controlsRef.current;
      orbit?.target.setY(orbit.target.y + shift);
    }

    // Gyro look: apply the phone's rotation since Gyro was switched on to the camera.
    if (gyroEnabled && hasDeviceOrientation.current) {
      if (gyroBase.current == null) {
        gyroBase.current = {
          inverseDevice: latestDevice.clone().invert(),
          camera: camera.quaternion.clone(),
        };
      }
      relative.copy(gyroBase.current.inverseDevice).multiply(latestDevice);
      camera.quaternion.copy(gyroBase.current.camera).multiply(relative);
    }
  });

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!gyroEnabled && !cameraDirected}
        enablePan={false}
        // No coasting while aiming: the view must stop exactly where the finger lifts.
        enableDamping={!aimActive}
        enableZoom={!aimActive}
        minDistance={aimActive ? LOOK_RADIUS * 0.5 : 1.2}
        maxDistance={aimActive ? LOOK_RADIUS * 2 : 4.5}
        minPolarAngle={aimActive ? Math.PI * 0.15 : 0}
        maxPolarAngle={aimActive ? Math.PI * 0.85 : Math.PI * 0.49}
        rotateSpeed={aimActive ? -0.35 : 0.7}
      />
      {/* polygonOffset pushes the floor back so the grid never z-fights with it. */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
        <meshLambertMaterial
          color={PALETTE.floor}
          flatShading
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <gridHelper args={[ROOM_SIZE, ROOM_SIZE * 2, PALETTE.gridMajor, PALETTE.gridMinor]} />
      {/* Room shell sunk below the floor so its bottom face is hidden, not coplanar with it. */}
      <mesh
        position-y={ROOM_HEIGHT / 2 - ROOM_SINK}
        material={flatMaterial(PALETTE.wall, { side: BackSide })}
      >
        <boxGeometry args={[ROOM_SIZE, ROOM_HEIGHT, ROOM_SIZE]} />
      </mesh>
    </>
  );
}
