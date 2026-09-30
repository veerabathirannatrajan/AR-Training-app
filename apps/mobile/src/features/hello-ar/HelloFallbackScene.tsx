import { OrbitControls } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect } from 'react';
import { BackSide } from 'three';
import { PALETTE } from '../../three/palette';
import { SceneLights } from '../../three/SceneLights';
import { FrameTelemetrySampler } from './FrameTelemetrySampler';
import { PlacedCubes } from './PlacedCubes';
import { usePlacementStore } from './placementStore';

const ROOM_SIZE = 8;
const ROOM_HEIGHT = 3;
const ROOM_SINK = 0.5;
/** A drag longer than this many pixels is a camera orbit, not a tap. */
const TAP_MAX_DRAG_PX = 8;

/** 3D fallback for phones without WebXR AR: same placement, inside a simple low-poly room. */
export function HelloFallbackScene() {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(0, 1.6, 2.4);
    camera.lookAt(0, 0.3, 0);
  }, [camera]);

  useEffect(() => () => usePlacementStore.getState().clear(), []);

  const onFloorTap = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > TAP_MAX_DRAG_PX) return;
    event.stopPropagation();
    const { x, y, z } = event.point;
    const faceCamera = Math.atan2(camera.position.x - x, camera.position.z - z);
    usePlacementStore.getState().placeCube([x, y, z], faceCamera);
  };

  return (
    <>
      <color attach="background" args={[PALETTE.skyFallback]} />
      <SceneLights />
      <OrbitControls
        target={[0, 0.3, 0]}
        enablePan={false}
        minDistance={1.2}
        maxDistance={5}
        maxPolarAngle={Math.PI * 0.47}
        makeDefault
      />

      {/* polygonOffset pushes the floor back in depth so the grid lines never z-fight with it. */}
      <mesh rotation-x={-Math.PI / 2} onClick={onFloorTap}>
        <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
        <meshStandardMaterial
          color={PALETTE.floor}
          flatShading
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <gridHelper args={[ROOM_SIZE, ROOM_SIZE * 2, PALETTE.gridMajor, PALETTE.gridMinor]} />
      {/* Room shell sunk below the floor so its bottom face is hidden, not coplanar with the floor. */}
      <mesh position-y={ROOM_HEIGHT / 2 - ROOM_SINK}>
        <boxGeometry args={[ROOM_SIZE, ROOM_HEIGHT, ROOM_SIZE]} />
        <meshStandardMaterial color={PALETTE.wall} side={BackSide} flatShading />
      </mesh>

      <PlacedCubes />
      <FrameTelemetrySampler />
    </>
  );
}
