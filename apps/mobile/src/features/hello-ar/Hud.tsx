import type { ReactNode } from 'react';
import { XR_UI_PROPS } from '../../xr/useBlockXRSelectOnUI';
import { MAX_CUBES, usePlacementStore } from './placementStore';

function TelemetryChip({ showHeight }: { showHeight: boolean }) {
  const { fps, heightAboveFloor, referenceSpaceY } = usePlacementStore((state) => state.telemetry);
  return (
    <div className="glass chip telemetry">
      <strong>{fps} fps</strong>
      {showHeight && (
        <>
          <span>
            {heightAboveFloor == null
              ? 'Place a cube to measure height'
              : `Phone ${heightAboveFloor.toFixed(2)} m above floor`}
          </span>
          <span className="muted small">ref. space y {referenceSpaceY.toFixed(2)} m</span>
        </>
      )}
    </div>
  );
}

interface HudProps {
  hint: string;
  hintState: 'ok' | 'warn';
  banner?: ReactNode;
  showHeight: boolean;
  exitLabel: string;
  onExit: () => void;
}

function Hud({ hint, hintState, banner, showHeight, exitLabel, onExit }: HudProps) {
  const cubeCount = usePlacementStore((state) => state.cubes.length);
  const clear = usePlacementStore((state) => state.clear);

  return (
    <div className="hud">
      <div className="hud-top">
        {banner}
        <div className="glass pill">
          <span className={`dot dot-${hintState}`} aria-hidden />
          {hint}
        </div>
        <TelemetryChip showHeight={showHeight} />
      </div>

      <div className="tray" {...XR_UI_PROPS}>
        <span className="tray-count">
          {cubeCount}/{MAX_CUBES}
          <span className="muted small"> cubes</span>
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={cubeCount === 0}
          onClick={clear}
        >
          Clear
        </button>
        <button type="button" className="btn btn-primary" onClick={onExit}>
          {exitLabel}
        </button>
      </div>
    </div>
  );
}

export function ARHud({ onExit }: { onExit: () => void }) {
  const surfaceFound = usePlacementStore((state) => state.surfaceFound);
  const cubeCount = usePlacementStore((state) => state.cubes.length);

  const hint = !surfaceFound
    ? 'Move your phone slowly and point it at the floor'
    : cubeCount === 0
      ? 'Tap anywhere to place a cube'
      : 'Tap to place another cube';

  return (
    <Hud
      hint={hint}
      hintState={surfaceFound ? 'ok' : 'warn'}
      showHeight
      exitLabel="Exit AR"
      onExit={onExit}
    />
  );
}

export function FallbackHud({ reason, onExit }: { reason: string | null; onExit: () => void }) {
  return (
    <Hud
      hint="Tap the floor to place a cube · drag to look around"
      hintState="ok"
      banner={
        <div className="glass pill banner-warn">
          <strong>3D mode</strong>
          {reason != null && <span className="small">{reason}</span>}
        </div>
      }
      showHeight={false}
      exitLabel="Back"
      onExit={onExit}
    />
  );
}
