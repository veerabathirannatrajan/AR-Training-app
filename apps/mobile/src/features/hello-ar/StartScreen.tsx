import type { XRCapabilities } from '@ar-training/shared';
import { API_BASE_URL } from '../../lib/api';
import type { ApiHealth } from '../../lib/useApiHealth';
import { XR_UI_PROPS } from '../../xr/useBlockXRSelectOnUI';
import { UNSUPPORTED_REASON_TEXT } from './messages';

type CheckState = 'ok' | 'fail' | 'warn' | 'pending';

function CheckRow({ label, state, detail }: { label: string; state: CheckState; detail: string }) {
  return (
    <li className="check-row">
      <span className={`dot dot-${state}`} aria-hidden />
      <span className="check-label">{label}</span>
      <span className="check-detail">{detail}</span>
    </li>
  );
}

function apiRow(api: ApiHealth): { state: CheckState; detail: string } {
  switch (api.status) {
    case 'checking':
      return { state: 'pending', detail: 'Checking…' };
    case 'online':
      return { state: 'ok', detail: `Online · v${api.health.version}` };
    case 'offline':
      return { state: 'warn', detail: `Not reachable at ${API_BASE_URL}` };
  }
}

interface StartScreenProps {
  capabilities: XRCapabilities | null;
  api: ApiHealth;
  arError: string | null;
  startingAR: boolean;
  onStartAR: () => void;
  onStart3D: () => void;
}

export function StartScreen({
  capabilities,
  api,
  arError,
  startingAR,
  onStartAR,
  onStart3D,
}: StartScreenProps) {
  const caps = capabilities;
  const pending = caps == null;
  const apiCheck = apiRow(api);

  return (
    <div className="start-screen">
      <section className="glass card" {...XR_UI_PROPS}>
        <header className="brand">
          <img src="/icon.svg" alt="" width={48} height={48} />
          <div>
            <h1>AR Mining Training</h1>
            <p className="muted">Phase 0 · Hello AR device test</p>
          </div>
        </header>

        <ul className="checklist">
          <CheckRow
            label="Secure context"
            state={pending ? 'pending' : caps.secureContext ? 'ok' : 'fail'}
            detail={pending ? 'Checking…' : caps.secureContext ? 'Yes' : 'No'}
          />
          <CheckRow
            label="WebXR API"
            state={pending ? 'pending' : caps.webxrAvailable ? 'ok' : 'fail'}
            detail={pending ? 'Checking…' : caps.webxrAvailable ? 'Available' : 'Missing'}
          />
          <CheckRow
            label="AR (immersive-ar)"
            state={pending ? 'pending' : caps.immersiveAr ? 'ok' : 'fail'}
            detail={pending ? 'Checking…' : caps.immersiveAr ? 'Supported' : '3D fallback'}
          />
          <CheckRow label="API server" state={apiCheck.state} detail={apiCheck.detail} />
        </ul>

        {caps?.unsupportedReason != null && (
          <p className="notice notice-warn">{UNSUPPORTED_REASON_TEXT[caps.unsupportedReason]}</p>
        )}
        {arError != null && <p className="notice notice-critical">{arError}</p>}

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={caps?.immersiveAr !== true || startingAR}
            onClick={onStartAR}
          >
            {startingAR ? 'Starting AR…' : 'Start AR'}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={onStart3D}>
            Open 3D mode
          </button>
        </div>
      </section>
    </div>
  );
}
