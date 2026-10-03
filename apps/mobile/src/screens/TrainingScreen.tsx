import { groupIndexOf, stepGroups, type RenderMode } from '@ar-training/shared';
import { Box, Compass, Move, ScanLine, ScanSearch } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackHandler, useNavigation } from '../app/navigation';
import { useSession } from '../app/session';
import { Button } from '../design/components';
import { cx } from '../design/cx';
import { engine, useEngineStore } from '../engine/engineStore';
import {
  CrouchButton,
  CrouchMeter,
  Crosshair,
  HoldButton,
  MoveButton,
  SubStepIndicator,
} from '../engine/hud/controls';
import { FeedbackToast, InstructionCard } from '../engine/hud/InstructionCard';
import { CriticalModal, HudSheet, OptionPanel, PauseMenu } from '../engine/hud/panels';
import { QuizPanel } from '../engine/hud/QuizPanel';
import { ResultPanel } from '../engine/hud/ResultPanel';
import { TopBar } from '../engine/hud/TopBar';
import { runner, useCurrentStep, useRunnerStore } from '../engine/runner/runnerStore';
import { classifyARStartError, type ARStartError } from '../engine/xr/capabilities';
import { endXRSession, useXRSession } from '../engine/xr/useXRSession';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
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
    <div className={cx('hud-glass placement-hint', surfaceFound && 'is-ready')} role="status">
      {surfaceFound ? <ScanLine size={22} /> : <ScanSearch size={22} className="pulse" />}
      <span>{surfaceFound ? t('placement.ready') : t('placement.searching')}</span>
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
  const score = useRunnerStore((state) => state.score);
  const startedAt = useRunnerStore((state) => state.startedAt);
  const stepProgress = useRunnerStore((state) => state.stepProgress);
  const feedback = useRunnerStore((state) => state.feedback);
  const result = useRunnerStore((state) => state.result);
  const criticalAlert = useRunnerStore((state) => state.criticalAlert);
  const triedOptions = useRunnerStore((state) => state.triedOptions);
  const outcomes = useRunnerStore((state) => state.outcomes);
  const quizIndex = useRunnerStore((state) => state.quizIndex);
  const quizAnswers = useRunnerStore((state) => state.quizAnswers);
  const placement = useEngineStore((state) => state.placement);
  const gyroEnabled = useEngineStore((state) => state.gyroEnabled);
  const gyroAvailable = useEngineStore((state) => state.gyroAvailable);
  const standingHeight = useEngineStore((state) => state.standingHeight);

  const [sheet, setSheet] = useState<'pause' | 'language' | null>(null);
  const [hiddenFeedbackId, setHiddenFeedbackId] = useState<number | null>(null);
  const [resumeError, setResumeError] = useState<ARStartError | null>(null);

  const startAttempt = useCallback(
    (focusStepIds?: string[]) => {
      if (definition == null || worker == null) return;
      void runner().start({
        module: definition.content,
        workerId: worker.workerId,
        mode,
        ...(focusStepIds != null ? { focusStepIds } : {}),
        ...(definition.defaultFacts != null ? { defaultFacts: definition.defaultFacts } : {}),
      });
    },
    // `mode` is read once per attempt; switching AR → 3D mid-attempt goes through setMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definition, worker],
  );

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

  // In AR the scenario starts once the training area is placed.
  const waitingForPlacement =
    mode === 'ar' && placement !== 'placed' && step?.interaction !== 'place';

  // Speak each instruction when its step starts (after any confirmation still playing).
  const stepId = step?.id;
  useEffect(() => {
    if (status !== 'running' || step == null || waitingForPlacement) return;
    const useFallbackText = mode === 'fallback3d' && step.fallbackInstruction != null;
    const text =
      useFallbackText && step.fallbackInstruction ? step.fallbackInstruction : step.instruction;
    speak(narrationFromText(`${moduleId}.${step.id}${useFallbackText ? '.3d' : ''}`, text), lang, {
      queue: true,
    });
    // Re-speak only when the step, mode, language or placement changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, stepId, mode, lang, moduleId, waitingForPlacement]);

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
    setSheet((current) => (current == null ? 'pause' : null));
    return true;
  }, []);
  useBackHandler(onBack);

  const groups = useMemo(
    () => (definition != null ? stepGroups(definition.content) : []),
    [definition],
  );

  if (definition == null || worker == null) return null;
  const { content } = definition;
  const ui = (step != null ? definition.stepUi[step.id] : undefined) ?? NO_STEP_UI;
  const running = status === 'running';
  const inFallback = mode === 'fallback3d';
  const arStopped = mode === 'ar' && xrSession == null && (running || status === 'quiz');
  const calibratingCrouch = ui.crouch === true && mode === 'ar' && standingHeight == null;
  const visibleFeedback = feedback != null && feedback.id !== hiddenFeedbackId ? feedback : null;
  const completedIds = outcomes.map((outcome) => outcome.stepId);
  const groupIndex = step != null ? groupIndexOf(content, step.id) : 0;
  const groupsDone = groups.filter((group) =>
    group.every((id) => completedIds.includes(id)),
  ).length;
  const quizQuestion = content.quiz?.[quizIndex];

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

  const restart = () => {
    setSheet(null);
    engine().reset(mode);
    void runner()
      .abandon()
      .then(() => startAttempt());
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

  const goHome = () => {
    endXRSession();
    runner().reset();
    useNavigation.getState().reset({ name: 'home' });
  };

  const again = (focusStepIds?: string[]) => {
    engine().reset(mode);
    startAttempt(focusStepIds);
  };

  // What the bottom of the screen shows for this step.
  const showModuleTray = running && ui.moduleTray === true && definition.Tray != null;
  const showOptions = running && step?.options != null && ui.options !== 'scene' && !showModuleTray;
  const trayChips = [
    mode === 'ar' && placement === 'placed' && (
      <button
        key="move"
        type="button"
        className="hud-chip-button"
        onClick={() => engine().requestReposition()}
      >
        <Move size={18} />
        {t('placement.reposition')}
      </button>
    ),
    inFallback && (
      <button
        key="gyro"
        type="button"
        className={cx('hud-chip-button', gyroEnabled && 'is-active')}
        aria-pressed={gyroEnabled}
        disabled={!gyroAvailable}
        title={gyroAvailable ? undefined : t('controls.gyroUnavailable')}
        onClick={() => engine().setGyroEnabled(!gyroEnabled)}
      >
        <Compass size={18} />
        {t('controls.gyro')}
      </button>
    ),
  ].filter(Boolean);
  const showHold = running && ui.hold === true;
  const showMove = running && ui.move === true;
  const showCrouchButton = running && ui.crouch === true && inFallback;
  const Tray = definition.Tray;
  const Overlay = definition.Overlay;

  return (
    <div className="hud">
      <TopBar
        icon={definition.icon}
        title={localize(content.title).text}
        groupCurrent={Math.min(groupIndex + 1, groups.length)}
        groupTotal={groups.length}
        progress={groups.length === 0 ? 0 : groupsDone / groups.length}
        startedAt={startedAt}
        finished={status === 'finished'}
        score={score}
        onVoice={replayInstruction}
        onPause={() => setSheet('pause')}
      >
        {running && step != null && !waitingForPlacement ? (
          <InstructionCard
            step={step}
            inFallback={inFallback}
            progress={stepProgress}
            showProgress={ui.progress === true && !calibratingCrouch}
          />
        ) : (
          <span className="grow" />
        )}
      </TopBar>

      {visibleFeedback != null && <FeedbackToast feedback={visibleFeedback} />}
      {running && ui.crosshair === true && <Crosshair />}
      {running && mode === 'ar' && xrSession != null && placement !== 'placed' && (
        <PlacementHint surfaceFound={placement === 'surface-found'} />
      )}

      <div className="hud-bottom">
        <div className="hud-bottom-row">
          {running && step != null && (
            <SubStepIndicator module={content} step={step} completedIds={completedIds} />
          )}
          {running && Overlay != null && <Overlay />}
        </div>
        {running && ui.crouch === true && mode === 'ar' && <CrouchMeter />}

        {showModuleTray && Tray != null ? (
          <Tray />
        ) : showOptions && step != null ? (
          <OptionPanel
            step={step}
            tried={triedOptions[step.id] ?? []}
            onChoose={(optionId) => runner().chooseOption(step.id, optionId)}
          />
        ) : (
          (trayChips.length > 0 || showHold || showMove || showCrouchButton) && (
            <div className="hud-tray" {...XR_UI_PROPS}>
              <div className="hud-tray-chips">{trayChips}</div>
              {showCrouchButton && <CrouchButton />}
              {showMove && <MoveButton />}
              {showHold && <HoldButton label={ui.holdLabel ?? 'hold'} />}
            </div>
          )
        )}
      </div>

      {status === 'quiz' && quizQuestion != null && (
        <QuizPanel
          moduleId={content.id}
          question={quizQuestion}
          index={quizIndex}
          total={content.quiz?.length ?? 0}
          answer={quizAnswers.find((answer) => answer.questionId === quizQuestion.id)}
          illustrations={definition.illustrations}
          onAnswer={(optionId) => runner().answerQuiz(quizQuestion.id, optionId)}
          onNext={() => runner().nextQuestion()}
        />
      )}

      {status === 'finished' && result != null && (
        <ResultPanel
          module={content}
          result={result}
          onHome={goHome}
          onAgain={() => again()}
          onRetrain={(stepIds) => again(stepIds)}
          onCertificate={(certificateId) => {
            goHome();
            useNavigation.getState().navigate({ name: 'certificate', certificateId });
          }}
        />
      )}

      {criticalAlert != null && (
        <CriticalModal
          module={content}
          alert={criticalAlert}
          onAcknowledge={() => runner().acknowledgeCritical()}
        />
      )}

      {arStopped && sheet == null && criticalAlert == null && (
        <HudSheet title={t('arStopped.title')}>
          <p className="t-muted">{t('arStopped.body')}</p>
          {resumeError != null && (
            <p className="hud-warning">{t(`deviceCheck.errors.${resumeError}`)}</p>
          )}
          <div className="sheet-actions">
            <Button block icon={<ScanLine size={20} />} onClick={() => void resumeAR()}>
              {t('arStopped.resume')}
            </Button>
            <Button variant="secondary" block icon={<Box size={20} />} onClick={switchTo3D}>
              {t('arStopped.switch3d')}
            </Button>
          </div>
        </HudSheet>
      )}

      {sheet === 'pause' && (
        <PauseMenu
          onResume={() => setSheet(null)}
          onRestart={restart}
          onLanguage={() => setSheet('language')}
          onLeave={leave}
        />
      )}
      {sheet === 'language' && <LanguageSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
