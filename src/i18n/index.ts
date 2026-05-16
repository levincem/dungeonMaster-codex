import { useSyncExternalStore } from 'react';
import { en } from './en';
import { fr } from './fr';

export type Locale = 'en' | 'fr';
export type Translations = typeof en;

const translations: Record<Locale, Translations> = {
    en,
    fr: fr as unknown as Translations,
};

let currentLocale: Locale = 'en';
const LOCALE_STORAGE_KEY = 'dm_locale';
const localeListeners = new Set<() => void>();

function readStoredLocale(): Locale | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        return resolveLocaleCandidate(localStorage.getItem(LOCALE_STORAGE_KEY));
    } catch {
        return null;
    }
}

function writeStoredLocale(locale: Locale): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
        // Ignore storage failures and keep the in-memory locale.
    }
}

function emitLocaleChange(): void {
    for (const listener of localeListeners) {
        listener();
    }
}

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
    if (currentLocale === locale) {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
        }
        writeStoredLocale(locale);
        return;
    }
    currentLocale = locale;
    if (typeof document !== 'undefined') {
        document.documentElement.lang = locale;
    }
    writeStoredLocale(locale);
    emitLocaleChange();
}

export function initializeLocale(locale?: Locale): Locale {
    const resolved = locale ?? readStoredLocale() ?? detectLocaleFromEnvironment();
    setLocale(resolved);
    return resolved;
}

export function getTranslations(locale: Locale = currentLocale): Translations {
    return translations[locale];
}

export function getCurrentLocale(): Locale {
    return currentLocale;
}

export function useLocale(): Locale {
    return useSyncExternalStore(
        (listener) => {
            localeListeners.add(listener);
            return () => localeListeners.delete(listener);
        },
        () => currentLocale,
        () => currentLocale,
    );
}

export function useI18n(): Translations {
    return getTranslations(useLocale());
}
