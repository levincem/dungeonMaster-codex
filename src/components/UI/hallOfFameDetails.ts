import type { HallOfFameEntry } from '../../engine/hallOfFame';
import type { Locale } from '../../i18n';

type HallOfFameDetailText = {
    hallOfFameBuild: string;
    hallOfFameCompleted: string;
    playTime: string;
    damageTaken: string;
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

    const lines = [
        `${text.hallOfFameCompleted}: ${formatHallOfFameCompletedAt(entry.completedAt, locale, true)}`,
        `${text.hallOfFameBuild}: v${entry.buildVersion}`,
        `${text.playTime}: ${formatHallOfFameDurationFromSeconds(entry.summary.playTimeSec)}`,
        `${text.damageTaken}: ${formatHallOfFameNumber(entry.summary.damageTaken, locale)}`,
        `${text.manaSpent}: ${formatHallOfFameNumber(entry.summary.manaSpent, locale)}`,
        `${text.steps}: ${formatHallOfFameNumber(steps, locale)} | ${text.turns}: ${formatHallOfFameNumber(turns, locale)}`,
        `${text.pickedUp}: ${formatHallOfFameNumber(entry.stats.items.pickedUp, locale)} | ${text.dropped}: ${formatHallOfFameNumber(entry.stats.items.dropped, locale)} | ${text.equipped}: ${formatHallOfFameNumber(entry.stats.items.equipped, locale)}`,
    ];

    if (topSpells.length > 0) {
        lines.push(`${text.topSpellsTitle}: ${topSpells.map((spell) => `${spell.name} x${formatHallOfFameNumber(spell.attempted, locale)}`).join(' | ')}`);
    } else {
        lines.push(`${text.topSpellsTitle}: ${text.noSpellsCast}`);
    }

    return lines.join('\n');
}
