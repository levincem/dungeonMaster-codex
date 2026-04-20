import { en } from './en';
import { fr } from './fr';

export type Locale = 'en' | 'fr';
export type Translations = typeof en;

const translations: Record<Locale, Translations> = {
    en,
    fr: fr as unknown as Translations,
};

const DEFAULT_LOCALE: Locale = 'en';

export function getTranslations(locale: Locale = DEFAULT_LOCALE): Translations {
    return translations[locale];
}

export function useI18n(): Translations {
    return getTranslations();
}
