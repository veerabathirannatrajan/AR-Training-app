import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { LowPolyCube } from '../../three/LowPolyCube';
import { PALETTE } from '../../three/palette';
import { SceneLights } from '../../three/SceneLights';

/** Backdrop for the start screen: a slowly spinning low-poly cube. */
export function HelloPreviewScene() {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(0, 1.6, 2.4);
    camera.lookAt(0, 1.6, 0);
  }, [camera]);

  return (
    <>
      <color attach="background" args={[PALETTE.previewBackground]} />
      <SceneLights />
      <LowPolyCube position={[0, 1.85, 0]} rotationY={0.6} popIn={false} spin scale={2.5} />
    </>
  );
}
