import type { RenderMode } from '@ar-training/shared';
import { ArrowDownToLine, Box, Compass, Hand, Move, ScanLine, ScanSearch } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackHandler, useNavigation } from '../app/navigation';
import { useSession } from '../app/session';
import { Button, ChipButton, Notice, Sheet } from '../design/components';
import { cx } from '../design/cx';
import { engine, useEngineStore } from '../engine/engineStore';
import { CrouchButton, CrouchMeter, Crosshair, HoldButton } from '../engine/hud/controls';
import { FeedbackToast, InstructionCard } from '../engine/hud/InstructionCard';
import { ResultPanel } from '../engine/hud/ResultPanel';
import { TopBar } from '../engine/hud/TopBar';
import { runner, useCurrentStep, useRunnerStore } from '../engine/runner/runnerStore';
import { classifyARStartError, type ARStartError } from '../engine/xr/capabilities';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { endXRSession, useXRSession } from '../engine/xr/useXRSession';
import { xrStore } from '../engine/xr/xrStore';
import { useLanguage } from '../i18n';
import { useLocalized } from '../i18n/localized';
import { findModule, type StepUi } from '../modules/registry';
import { narrationFromText, speak, stopSpeaking } from '../voice/narrator';
import { LanguageSheet } from './LanguageSheet';

const FEEDBACK_VISIBLE_MS = 2600;
const NO_STEP_UI: StepUi = {};

function PlacementHint({ surfaceFound }: { surfaceFound: boolean }) {
  const { t } = useTranslation('training');
  return (
    <div className={cx('glass placement-hint', surfaceFound && 'is-ready')} role="status">
      {surfaceFound ? <ScanLine size={22} /> : <ScanSearch size={22} className="pulse" />}
      <span className="t-strong">
        {surfaceFound ? t('placement.ready') : t('placement.searching')}
      </span>
    </div>
  );
}

/** HUD for a running module: sits in the DOM overlay above the 3D scene (or the camera in AR). */
export function TrainingScreen({ moduleId, mode }: { moduleId: string; mode: RenderMode }) {
  const { t } = useTranslation('training');
  const lang = useLanguage();
  const localize = useLocalized();
  const definition = findModule(moduleId);
  const worker = useSession((state) => state.worker);
  const xrSession = useXRSession();

  const status = useRunnerStore((state) => state.status);
  const step = useCurrentStep();
  const stepIndex = useRunnerStore((state) => state.stepIndex);
  const score = useRunnerStore((state) => state.score);
  const startedAt = useRunnerStore((state) => state.startedAt);
  const stepProgress = useRunnerStore((state) => state.stepProgress);
  const feedback = useRunnerStore((state) => state.feedback);
  const result = useRunnerStore((state) => state.result);
  const placement = useEngineStore((state) => state.placement);
  const gyroEnabled = useEngineStore((state) => state.gyroEnabled);
  const gyroAvailable = useEngineStore((state) => state.gyroAvailable);
  const standingHeight = useEngineStore((state) => state.standingHeight);

  const [sheet, setSheet] = useState<'exit' | 'language' | null>(null);
  const [hiddenFeedbackId, setHiddenFeedbackId] = useState<number | null>(null);
  const [resumeError, setResumeError] = useState<ARStartError | null>(null);

  const startAttempt = useCallback(() => {
    if (definition == null || worker == null) return;
    void runner().start({ module: definition.content, workerId: worker.workerId, mode });
    // `mode` is read once per attempt; switching AR → 3D mid-attempt goes through setMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition, worker]);

  // Start the attempt after mount. Deferring it means React StrictMode's mount → unmount →
  // mount in development starts exactly one session.
  useEffect(() => {
    let started = false;
    const timer = setTimeout(() => {
      started = true;
      startAttempt();
    }, 0);
    return () => {
      clearTimeout(timer);
      stopSpeaking();
      if (started) {
        void runner().abandon();
        endXRSession();
      }
    };
  }, [startAttempt]);

  useEffect(() => {
    runner().setMode(mode);
  }, [mode]);

  // Speak each instruction when its step starts (after any confirmation that is still playing).
  const stepId = step?.id;
  useEffect(() => {
    if (status !== 'running' || step == null) return;
    const useFallbackText = mode === 'fallback3d' && step.fallbackInstruction != null;
    const text =
      useFallbackText && step.fallbackInstruction ? step.fallbackInstruction : step.instruction;
    speak(narrationFromText(`${moduleId}.${step.id}${useFallbackText ? '.3d' : ''}`, text), lang, {
      queue: true,
    });
    // Re-speak only when the step, mode or language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stepId, mode, lang, moduleId]);

  // Speak feedback (confirmation, mistake, hint) and hide its toast after a moment.
  useEffect(() => {
    if (feedback == null) return;
    speak(narrationFromText(feedback.narrationId, feedback.text), lang);
    const timer = setTimeout(() => setHiddenFeedbackId(feedback.id), FEEDBACK_VISIBLE_MS);
    return () => clearTimeout(timer);
    // Keyed on the feedback id so the same message can repeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback?.id]);

  const onBack = useCallback(() => {
    setSheet((current) => (current == null ? 'exit' : null));
    return true;
  }, []);
  useBackHandler(onBack);

  if (definition == null || worker == null) return null;
  const { content } = definition;
  const ui = (step != null ? definition.stepUi[step.id] : undefined) ?? NO_STEP_UI;
  const running = status === 'running';
  const inFallback = mode === 'fallback3d';
  const arStopped = mode === 'ar' && xrSession == null && running;
  const waitingForPlacement = mode === 'ar' && xrSession != null && placement !== 'placed';
  const calibratingCrouch = ui.crouch === true && mode === 'ar' && standingHeight == null;
  const visibleFeedback = feedback != null && feedback.id !== hiddenFeedbackId ? feedback : null;

  const replayInstruction = () => {
    if (step == null) return;
    const text =
      inFallback && step.fallbackInstruction ? step.fallbackInstruction : step.instruction;
    const suffix = inFallback && step.fallbackInstruction ? '.3d' : '';
    speak(narrationFromText(`${moduleId}.${step.id}${suffix}`, text), lang);
  };

  const leave = () => {
    setSheet(null);
    void runner().abandon();
    endXRSession();
    useNavigation.getState().back();
  };

  const resumeAR = async () => {
    setResumeError(null);
    try {
      engine().reset('ar');
      await xrStore.enterAR();
    } catch (error) {
      console.error('[xr] resume failed', error);
      setResumeError(classifyARStartError(error));
    }
  };

  const switchTo3D = () => {
    engine().reset('fallback3d');
    useNavigation.getState().replace({ name: 'training', moduleId, mode: 'fallback3d' });
  };

  const practiceAgain = () => {
    engine().reset(mode);
    startAttempt();
  };

  const goHome = () => {
    endXRSession();
    runner().reset();
    useNavigation.getState().reset({ name: 'home' });
  };

  const trayItems = [
    mode === 'ar' && placement === 'placed' && (
      <ChipButton
        key="move"
        className="glass"
        icon={<Move size={18} />}
        onClick={() => engine().requestReposition()}
      >
        {t('placement.reposition')}
      </ChipButton>
    ),
    inFallback && (
      <ChipButton
        key="gyro"
        className={cx('glass', gyroEnabled && 'chip-accent')}
        icon={<Compass size={18} />}
        aria-pressed={gyroEnabled}
        disabled={!gyroAvailable}
        title={gyroAvailable ? undefined : t('controls.gyroUnavailable')}
        onClick={() => engine().setGyroEnabled(!gyroEnabled)}
      >
        {t('controls.gyro')}
      </ChipButton>
    ),
  ].filter(Boolean);
  const showHold = running && ui.hold === true;
  const showCrouchButton = running && ui.crouch === true && inFallback;

  return (
    <div className="hud">
      <TopBar
        title={localize(content.title).text}
        stepCurrent={Math.min(stepIndex + 1, content.steps.length)}
        stepTotal={content.steps.length}
        startedAt={startedAt}
        finished={status === 'finished'}
        score={score}
        onExit={() => setSheet('exit')}
        onVoice={replayInstruction}
        onLanguage={() => setSheet('language')}
      />

      {running && step != null && (
        <InstructionCard
          step={step}
          inFallback={inFallback}
          progress={stepProgress}
          showProgress={ui.progress === true && !calibratingCrouch}
        />
      )}
      {visibleFeedback != null && <FeedbackToast feedback={visibleFeedback} />}

      {running && ui.crosshair === true && <Crosshair />}
      {waitingForPlacement && running && (
        <PlacementHint surfaceFound={placement === 'surface-found'} />
      )}

      <div className="hud-bottom">
        {running && ui.crouch === true && mode === 'ar' && <CrouchMeter />}
        {(trayItems.length > 0 || showHold || showCrouchButton) && (
          <div className="clay tray hud-tray" {...XR_UI_PROPS}>
            <div className="row wrap grow">{trayItems}</div>
            {showHold && <HoldButton icon={<Hand size={26} />} />}
            {showCrouchButton && <CrouchButton icon={<ArrowDownToLine size={26} />} />}
          </div>
        )}
      </div>

      {status === 'finished' && result != null && (
        <ResultPanel module={content} result={result} onHome={goHome} onAgain={practiceAgain} />
      )}

      {arStopped && sheet == null && (
        <Sheet title={t('arStopped.title')} onClose={() => undefined}>
          <p>{t('arStopped.body')}</p>
          {resumeError != null && (
            <Notice tone="critical">{t(`deviceCheck.errors.${resumeError}`)}</Notice>
          )}
          <div className="sheet-actions">
            <Button block icon={<ScanLine size={20} />} onClick={() => void resumeAR()}>
              {t('arStopped.resume')}
            </Button>
            <Button variant="secondary" block icon={<Box size={20} />} onClick={switchTo3D}>
              {t('arStopped.switch3d')}
            </Button>
          </div>
        </Sheet>
      )}

      {sheet === 'exit' && (
        <Sheet title={t('exit.title')} onClose={() => setSheet(null)}>
          <p>{t('exit.body')}</p>
          <div className="sheet-actions">
            <Button variant="danger" block onClick={leave}>
              {t('exit.leave')}
            </Button>
            <Button variant="secondary" block onClick={() => setSheet(null)}>
              {t('exit.stay')}
            </Button>
          </div>
        </Sheet>
      )}
      {sheet === 'language' && <LanguageSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
