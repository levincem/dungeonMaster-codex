import { en } from './en';
import { fr } from './fr';

export type Locale = 'en' | 'fr';
export type Translations = typeof en;

const translations: Record<Locale, Translations> = {
    en,
    fr: fr as unknown as Translations,
};

let currentLocale: Locale = 'en';

function resolveLocaleCandidate(candidate: string | null | undefined): Locale | null {
    if (!candidate) return null;
    const normalized = candidate.toLowerCase();
    if (normalized.startsWith('fr')) return 'fr';
    if (normalized.startsWith('en')) return 'en';
    return null;
}

export function detectLocaleFromEnvironment(): Locale {
    const candidates: string[] = [];

    if (typeof document !== 'undefined' && document.documentElement.lang) {
        candidates.push(document.documentElement.lang);
    }

    if (typeof navigator !== 'undefined') {
        if (Array.isArray(navigator.languages)) {
            candidates.push(...navigator.languages);
        }
        if (navigator.language) {
            candidates.push(navigator.language);
        }
    }

    for (const candidate of candidates) {
        const locale = resolveLocaleCandidate(candidate);
        if (locale) return locale;
    }

    return 'en';
}

export function setLocale(locale: Locale): void {
    currentLocale = locale;
    if (typeof document !== 'undefined') {
        document.documentElement.lang = locale;
    }
}

export function initializeLocale(locale?: Locale): Locale {
    const resolved = locale ?? detectLocaleFromEnvironment();
    setLocale(resolved);
    return resolved;
}

export function getTranslations(locale: Locale = currentLocale): Translations {
    return translations[locale];
}

export function useI18n(): Translations {
    return getTranslations();
}
