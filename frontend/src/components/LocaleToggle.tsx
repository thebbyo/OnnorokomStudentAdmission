import { setLocale, t } from '../i18n';
import { useLocale } from '../i18n/useLocale';

/** One button that shows the other language: "বাংলা" while in English, "English" while in Bangla. */
export function LocaleToggle() {
  const locale = useLocale();
  const next = locale === 'bn' ? 'en' : 'bn';
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm locale-toggle"
      lang={next}
      onClick={() => setLocale(next)}
    >
      {t(next === 'bn' ? 'locale.toggle.bn' : 'locale.toggle.en')}
    </button>
  );
}
