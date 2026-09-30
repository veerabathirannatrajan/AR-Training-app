import { ArrowLeft, Check, Clock, Play, Volume2 } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { Button, Chip, IconButton } from '../design/components';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { useLanguage } from '../i18n';
import { useLocalized } from '../i18n/localized';
import { findModule } from '../modules/registry';
import { narrationFromText, speak, stopSpeaking } from '../voice/narrator';

/** Module briefing: what the worker will learn, narrated aloud. */
export function ModuleIntroScreen({ moduleId }: { moduleId: string }) {
  const { t } = useTranslation(['training', 'common', 'home']);
  const lang = useLanguage();
  const localize = useLocalized();
  const definition = findModule(moduleId);

  useEffect(() => {
    if (definition == null) return;
    const { content } = definition;
    speak(narrationFromText(`${content.id}.briefing`, content.briefing), lang);
    return stopSpeaking;
  }, [definition, lang]);

  if (definition == null) return null;
  const { content, icon: Icon, accent } = definition;
  const title = localize(content.title);
  const briefing = localize(content.briefing);
  const replay = () => speak(narrationFromText(`${content.id}.briefing`, content.briefing), lang);

  return (
    <main className="screen">
      <LowPolyBackdrop />
      <div className="screen-scroll">
        <div className="row-between">
          <IconButton
            label={t('common:actions.back')}
            onClick={() => useNavigation.getState().back()}
          >
            <ArrowLeft size={22} />
          </IconButton>
          <IconButton label={t('common:actions.listen')} onClick={replay}>
            <Volume2 size={22} />
          </IconButton>
        </div>

        <section className="glass card-lg stack-2">
          <div className="row">
            <span className="module-icon module-icon-lg" style={{ background: accent }}>
              <Icon size={34} color="#fff" />
            </span>
            <div className="grow stack-1">
              <h1 className="t-title" lang={title.lang}>
                {title.text}
              </h1>
              <div className="row wrap">
                <Chip tone="accent">{t(`home:kind.${content.kind}`)}</Chip>
                <Chip icon={<Clock size={16} />}>
                  {t('intro.duration', { count: content.estimatedMinutes })}
                </Chip>
              </div>
            </div>
          </div>
          <p className="t-body" lang={briefing.lang}>
            {briefing.text}
          </p>
        </section>

        <section className="glass card-lg stack-1">
          <h2 className="t-heading">{t('intro.objectives')}</h2>
          <ul className="stack-1">
            {content.objectives.map((objective, index) => {
              const text = localize(objective);
              return (
                <li key={index} className="row objective">
                  <Check size={20} className="icon-ok" />
                  <span lang={text.lang}>{text.text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <footer className="screen-footer">
        <Button
          size="lg"
          block
          icon={<Play size={22} />}
          onClick={() => useNavigation.getState().navigate({ name: 'device-check', moduleId })}
        >
          {t('intro.start')}
        </Button>
      </footer>
    </main>
  );
}
