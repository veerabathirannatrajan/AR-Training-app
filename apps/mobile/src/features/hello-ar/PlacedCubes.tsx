import { LowPolyCube } from '../../three/LowPolyCube';
import { usePlacementStore } from './placementStore';

export function PlacedCubes() {
  const cubes = usePlacementStore((state) => state.cubes);
  return (
    <>
      {cubes.map((cube) => (
        <LowPolyCube key={cube.id} position={cube.position} rotationY={cube.rotationY} />
      ))}
    </>
  );
}
