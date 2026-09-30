import { LANGUAGE_CODES, LANGUAGES, type LanguageCode } from '@ar-training/shared';
import { Check, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Sheet } from '../design/components';
import { cx } from '../design/cx';
import { setLanguage, useLanguage } from '../i18n';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { useNarratorStore } from '../voice/narrator';

/** Quick language switch (and voice on/off), available from the home screen and in training. */
export function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const current = useLanguage();
  const muted = useNarratorStore((state) => state.muted);
  const setMuted = useNarratorStore((state) => state.setMuted);

  const choose = (lang: LanguageCode) => {
    void setLanguage(lang);
    onClose();
  };

  return (
    <Sheet title={t('language.change')} onClose={onClose}>
      <div className="stack-1">
        {LANGUAGE_CODES.map((lang) => (
          <button
            key={lang}
            type="button"
            className={cx('lang-option', lang === current && 'is-selected')}
            onClick={() => choose(lang)}
            {...XR_UI_PROPS}
          >
            <span className="lang-option-native" lang={LANGUAGES[lang].bcp47}>
              {LANGUAGES[lang].nativeName}
            </span>
            <span className="t-small t-muted grow">{LANGUAGES[lang].englishName}</span>
            {lang === 'sat' && <Chip tone="warn">{t('language.draft')}</Chip>}
            {lang === current && <Check size={22} className="icon-accent" />}
          </button>
        ))}
      </div>
      <Button
        variant="secondary"
        block
        icon={muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        onClick={() => setMuted(!muted)}
      >
        {muted ? t('voice.off') : t('voice.on')}
      </Button>
    </Sheet>
  );
}
