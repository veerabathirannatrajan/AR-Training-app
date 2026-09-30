import { PALETTE } from './palette';

/** Cheap, shadow-free lighting that reads well on flat-shaded low-poly geometry. */
export function SceneLights() {
  return (
    <>
      <hemisphereLight args={[PALETTE.hemiSky, PALETTE.hemiGround, 1.4]} />
      <directionalLight position={[2, 4, 1.5]} intensity={1.8} />
    </>
  );
}
