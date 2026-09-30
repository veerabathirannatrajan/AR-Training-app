import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../design/components';
import { useLanguage } from '../i18n';

/** Shown while Santali is selected: its text is an unreviewed draft with Hindi fallback. */
export function SantaliDraftNotice() {
  const { t } = useTranslation();
  const lang = useLanguage();
  if (lang !== 'sat') return null;
  return (
    <Notice tone="warn" icon={<Languages size={18} />}>
      {t('language.santaliDraftNotice')}
    </Notice>
  );
}
