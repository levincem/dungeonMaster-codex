import { en } from './en';
import { fr } from './fr';

export type Locale = 'en' | 'fr';

const translations: Record<Locale, typeof en> = {
    en,
    fr: fr as typeof en,
};

export type Translations = typeof en;

const DEFAULT_LOCALE: Locale = 'en';

export function getTranslations(locale: Locale = DEFAULT_LOCALE): Translations {
    return translations[locale];
}

export function useI18n(): Translations {
    return getTranslations();
}
