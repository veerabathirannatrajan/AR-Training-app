import type { RenderMode, XRCapabilities } from '@ar-training/shared';
import { ArrowLeft, Box, Camera, Info, LoaderCircle, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { Button, IconButton, Notice } from '../design/components';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { engine } from '../engine/engineStore';
import { useStageStatus } from '../engine/stageStatus';
import {
  classifyARStartError,
  detectXRCapabilities,
  type ARStartError,
} from '../engine/xr/capabilities';
import { xrStore } from '../engine/xr/xrStore';

/** Decides AR vs 3D mode for this phone, then starts the training scene. */
export function DeviceCheckScreen({ moduleId }: { moduleId: string }) {
  const { t } = useTranslation(['training', 'common']);
  const [capabilities, setCapabilities] = useState<XRCapabilities | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ARStartError | null>(null);
  // AR can only start once the 3D stage (canvas + WebXR) is mounted; it loads at app start.
  const stageReady = useStageStatus((state) => state.ready);

  useEffect(() => {
    let cancelled = false;
    void detectXRCapabilities().then((detected) => {
      if (!cancelled) setCapabilities(detected);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (mode: RenderMode) => {
    engine().reset(mode);
    useNavigation.getState().replace({ name: 'training', moduleId, mode });
  };

  const startAR = async () => {
    setStarting(true);
    setError(null);
    try {
      // The canvas and <XR> are always mounted, so the session can start from this tap.
      engine().reset('ar');
      await xrStore.enterAR();
      open('ar');
    } catch (failure) {
      console.error('[xr] enterAR failed', failure);
      setError(classifyARStartError(failure));
    } finally {
      setStarting(false);
    }
  };

  const arReady = capabilities?.immersiveAr === true;

  return (
    <main className="screen">
      <LowPolyBackdrop />
      <div className="screen-scroll">
        <div className="row">
          <IconButton
            label={t('common:actions.back')}
            onClick={() => useNavigation.getState().back()}
          >
            <ArrowLeft size={22} />
          </IconButton>
          <h1 className="t-title">{t('deviceCheck.title')}</h1>
        </div>

        {capabilities == null || !stageReady ? (
          <p className="row t-muted" role="status">
            <LoaderCircle size={18} className="spin" />
            {t('deviceCheck.checking')}
          </p>
        ) : arReady ? (
          <Notice tone="ok" icon={<ScanLine size={18} />}>
            {t('deviceCheck.arReady')}
          </Notice>
        ) : (
          <Notice tone="warn" icon={<Box size={18} />}>
            <p>{t('deviceCheck.arUnavailable')}</p>
            {capabilities.unsupportedReason != null && (
              <p className="t-small">
                {t(`deviceCheck.reasons.${capabilities.unsupportedReason}`)}
              </p>
            )}
          </Notice>
        )}

        {/* Floor space only matters when the scene is placed in the room. */}
        {arReady && (
          <Notice tone="info" icon={<Info size={18} />}>
            {t('deviceCheck.space')}
          </Notice>
        )}

        {error != null && (
          <Notice tone="critical" icon={<Camera size={18} />}>
            {t(`deviceCheck.errors.${error}`)}
          </Notice>
        )}
      </div>

      <footer className="screen-footer">
        {arReady && stageReady && (
          <Button
            size="lg"
            block
            icon={starting ? <LoaderCircle size={22} className="spin" /> : <ScanLine size={22} />}
            disabled={starting}
            onClick={() => void startAR()}
          >
            {starting ? t('deviceCheck.starting') : t('deviceCheck.startAr')}
          </Button>
        )}
        <Button
          size={arReady ? 'md' : 'lg'}
          variant={arReady ? 'secondary' : 'primary'}
          block
          icon={<Box size={20} />}
          disabled={capabilities == null || !stageReady || starting}
          onClick={() => open('fallback3d')}
        >
          {t('deviceCheck.use3d')}
        </Button>
      </footer>
    </main>
  );
}
