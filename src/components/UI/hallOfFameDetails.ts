import type { HallOfFameEntry } from '../../engine/hallOfFame';
import type { Locale } from '../../i18n';

type HallOfFameDetailText = {
    hallOfFameBuild: string;
    hallOfFameCompleted: string;
    playTime: string;
    damageTaken: string;
    mostDangerousCreaturesTitle: string;
    noCreatureDamageTaken: string;
    timeByLevelTitle: string;
    manaSpent: string;
    steps: string;
    turns: string;
    pickedUp: string;
    dropped: string;
    equipped: string;
    topSpellsTitle: string;
    noSpellsCast: string;
};

function resolveIntlLocale(locale: Locale): string {
    return locale === 'fr' ? 'fr-FR' : 'en-US';
}

function formatHallOfFameNumber(value: number, locale: Locale): string {
    return value.toLocaleString(resolveIntlLocale(locale));
}

export function formatHallOfFameCompactNumber(value: number, locale: Locale): string {
    const clamped = Math.max(0, value);
    if (clamped < 1000) {
        return formatHallOfFameNumber(clamped, locale);
    }
    return new Intl.NumberFormat(resolveIntlLocale(locale), {
        notation: 'compact',
        compactDisplay: 'short',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })
        .format(clamped)
        .replace(/\s+/g, '')
        .toLowerCase();
}

export function formatHallOfFameDurationFromSeconds(totalSeconds: number): string {
    const clampedSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(clampedSeconds / 3600);
    const minutes = Math.floor((clampedSeconds % 3600) / 60);
    const seconds = clampedSeconds % 60;
    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${seconds}s`;
}

export function formatHallOfFameCompletedAt(ts: number, locale: Locale, includeTime = false): string {
    return new Intl.DateTimeFormat(
        resolveIntlLocale(locale),
        includeTime ? { dateStyle: 'long', timeStyle: 'short' } : { dateStyle: 'medium' },
    ).format(new Date(ts));
}

export function sortHallOfFameEntries(entries: readonly HallOfFameEntry[]): HallOfFameEntry[] {
    return [...entries].sort((left, right) =>
        left.summary.playTimeSec - right.summary.playTimeSec
        || right.summary.monstersKilled - left.summary.monstersKilled
        || right.completedAt - left.completedAt);
}

function summarizeSpellName(name: string): string {
    const [shortName] = name.split(' - ');
    return shortName?.trim() || name.trim();
}

function formatLevelLabel(levelKey: string): string {
    const levelIndex = Number.parseInt(levelKey, 10);
    if (!Number.isFinite(levelIndex) || levelIndex < 0) {
        return levelKey;
    }
    return `L${levelIndex + 1}`;
}

export function buildHallOfFameEntryHoverText(
    entry: HallOfFameEntry,
    text: HallOfFameDetailText,
    locale: Locale,
): string {
    const steps = entry.stats.movement.stepsForward
        + entry.stats.movement.stepsBackward
        + entry.stats.movement.strafesLeft
        + entry.stats.movement.strafesRight;
    const turns = entry.stats.movement.turnsLeft + entry.stats.movement.turnsRight;
    const topSpells = Object.entries(entry.stats.magic.bySpell)
        .map(([name, counters]) => ({
            name: summarizeSpellName(name),
            attempted: counters.attempted,
        }))
        .filter((spell) => spell.attempted > 0)
        .sort((left, right) => right.attempted - left.attempted || left.name.localeCompare(right.name))
        .slice(0, 3);
    const dangerousCreatures = Object.entries(entry.stats.combat.damageTakenByCreature)
        .filter(([, damage]) => damage > 0)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 3);
    const timeByLevel = Object.entries(entry.stats.exploration.timeByLevelMs)
        .filter(([, durationMs]) => durationMs > 0)
        .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))
        .slice(0, 3);

    const lines = [
        `${text.hallOfFameCompleted}: ${formatHallOfFameCompletedAt(entry.completedAt, locale, true)}`,
        `${text.hallOfFameBuild}: v${entry.buildVersion}`,
        `${text.playTime}: ${formatHallOfFameDurationFromSeconds(entry.summary.playTimeSec)}`,
        `${text.damageTaken}: ${formatHallOfFameCompactNumber(entry.summary.damageTaken, locale)}`,
        `${text.manaSpent}: ${formatHallOfFameCompactNumber(entry.summary.manaSpent, locale)}`,
        `${text.steps}: ${formatHallOfFameCompactNumber(steps, locale)} | ${text.turns}: ${formatHallOfFameCompactNumber(turns, locale)}`,
        `${text.pickedUp}: ${formatHallOfFameCompactNumber(entry.stats.items.pickedUp, locale)} | ${text.dropped}: ${formatHallOfFameCompactNumber(entry.stats.items.dropped, locale)} | ${text.equipped}: ${formatHallOfFameCompactNumber(entry.stats.items.equipped, locale)}`,
    ];

    if (dangerousCreatures.length > 0) {
        lines.push(`${text.mostDangerousCreaturesTitle}: ${dangerousCreatures.map(([name, damage]) => `${name} ${formatHallOfFameCompactNumber(damage, locale)}`).join(' | ')}`);
    } else {
        lines.push(`${text.mostDangerousCreaturesTitle}: ${text.noCreatureDamageTaken}`);
    }

    if (timeByLevel.length > 0) {
        lines.push(`${text.timeByLevelTitle}: ${timeByLevel.map(([levelKey, durationMs]) => `${formatLevelLabel(levelKey)} ${formatHallOfFameDurationFromSeconds(Math.floor(durationMs / 1000))}`).join(' | ')}`);
    }

    if (topSpells.length > 0) {
        lines.push(`${text.topSpellsTitle}: ${topSpells.map((spell) => `${spell.name} x${formatHallOfFameCompactNumber(spell.attempted, locale)}`).join(' | ')}`);
    } else {
        lines.push(`${text.topSpellsTitle}: ${text.noSpellsCast}`);
    }

    return lines.join('\n');
}
