import { useMemo, type ReactNode } from 'react';
import type { GameStats } from '../../engine/systems/gameStats';
import { useI18n } from '../../i18n';

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${seconds}s`;
}

function formatNumber(value: number): string {
    return value.toLocaleString();
}

export interface GameStatsPanelProps {
    gameStats: GameStats;
    title?: string;
    footer?: ReactNode;
}

export const GameStatsPanel = ({ gameStats, title, footer }: GameStatsPanelProps) => {
    const text = useI18n().victory;
    const topSpells = useMemo(
        () =>
            Object.entries(gameStats.magic.bySpell)
                .map(([name, counters]) => ({ name, ...counters }))
                .filter((entry) => entry.attempted > 0)
                .sort((left, right) =>
                    right.attempted - left.attempted
                    || right.succeeded - left.succeeded
                    || left.name.localeCompare(right.name),
                )
                .slice(0, 5),
        [gameStats.magic.bySpell],
    );
    const topCreatures = useMemo(
        () =>
            Object.entries(gameStats.combat.byCreature)
                .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                .slice(0, 5),
        [gameStats.combat.byCreature],
    );
    const totalSteps =
        gameStats.movement.stepsForward +
        gameStats.movement.stepsBackward +
        gameStats.movement.strafesLeft +
        gameStats.movement.strafesRight;
    const totalTurns = gameStats.movement.turnsLeft + gameStats.movement.turnsRight;
    const summaryStats = [
        { label: text.playTime, value: formatDuration(Date.now() - gameStats.startedAt) },
        { label: text.monstersKilled, value: formatNumber(gameStats.combat.monstersKilled) },
        { label: text.spellsAttempted, value: formatNumber(gameStats.magic.spells.attempted) },
        { label: text.damageDealt, value: formatNumber(gameStats.combat.damageDealt.total) },
        { label: text.damageTaken, value: formatNumber(gameStats.combat.damageTaken.total) },
        { label: text.manaSpent, value: formatNumber(gameStats.magic.manaSpent) },
    ];
    const sectionTitleStyle = {
        fontFamily: '"Times New Roman", serif',
        fontSize: 'clamp(20px, 2.1vw, 28px)',
        letterSpacing: 1.6,
        textTransform: 'uppercase' as const,
        color: '#f2dfb2',
        textShadow: '0 2px 10px rgba(0,0,0,0.45)',
    };
    const sectionPanelStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 10,
        padding: '16px 18px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(12, 10, 8, 0.46), rgba(7, 6, 5, 0.66))',
        border: '1px solid rgba(216, 188, 122, 0.22)',
        boxShadow: 'inset 0 0 0 1px rgba(87, 62, 28, 0.24)',
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 18,
            alignSelf: 'center',
            width: 'min(76vw, 960px)',
            maxHeight: 'min(82vh, 920px)',
            margin: '5vh 0',
            padding: '22px 22px 16px',
            borderRadius: 14,
            background: 'linear-gradient(180deg, rgba(18, 14, 9, 0.58), rgba(8, 6, 4, 0.82))',
            border: '1px solid rgba(232, 215, 164, 0.34)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(2px)',
            overflowY: 'auto',
            overflowX: 'hidden',
        }}>
            <div style={{
                fontFamily: '"Times New Roman", serif',
                fontSize: 'clamp(28px, 3.8vw, 46px)',
                letterSpacing: 2,
                textTransform: 'uppercase',
                textAlign: 'center',
                textShadow: '0 2px 10px rgba(0,0,0,0.55)',
            }}>
                {title ?? text.statsTitle}
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
            }}>
                {summaryStats.map((entry) => (
                    <div
                        key={entry.label}
                        style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: 'linear-gradient(180deg, rgba(12, 10, 8, 0.42), rgba(7, 6, 5, 0.6))',
                            border: '1px solid rgba(216, 188, 122, 0.22)',
                            boxShadow: 'inset 0 0 0 1px rgba(87, 62, 28, 0.2)',
                        }}
                    >
                        <div style={{
                            fontFamily: '"Courier New", monospace',
                            fontSize: 12,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            opacity: 0.82,
                            marginBottom: 6,
                        }}>
                            {entry.label}
                        </div>
                        <div style={{
                            fontFamily: '"Times New Roman", serif',
                            fontSize: 'clamp(24px, 3vw, 34px)',
                            letterSpacing: 1.2,
                            color: '#f5e4b8',
                        }}>
                            {entry.value}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
            }}>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.attacksTitle}</div>
                    <div style={{ display: 'grid', gap: 6, fontFamily: '"Courier New", monospace', fontSize: 14, lineHeight: 1.45 }}>
                        <div>{text.total}: {formatNumber(gameStats.combat.attacks.total)}</div>
                        <div>{text.melee}: {formatNumber(gameStats.combat.attacks.melee)}</div>
                        <div>{text.projectile}: {formatNumber(gameStats.combat.attacks.projectile)}</div>
                        <div>{text.magic}: {formatNumber(gameStats.combat.attacks.magic)}</div>
                        <div>{text.utility}: {formatNumber(gameStats.combat.attacks.utility)}</div>
                        <div>{text.championsKilled}: {formatNumber(gameStats.combat.championsKilled)}</div>
                    </div>
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.movementTitle}</div>
                    <div style={{ display: 'grid', gap: 6, fontFamily: '"Courier New", monospace', fontSize: 14, lineHeight: 1.45 }}>
                        <div>{text.steps}: {formatNumber(totalSteps)}</div>
                        <div>{text.turns}: {formatNumber(totalTurns)}</div>
                        <div>{text.bumps}: {formatNumber(gameStats.movement.bumps)}</div>
                        <div>{text.falls}: {formatNumber(gameStats.movement.falls)}</div>
                        <div>{text.levelTransitions}: {formatNumber(gameStats.exploration.levelTransitions)}</div>
                    </div>
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.explorationTitle}</div>
                    <div style={{ display: 'grid', gap: 6, fontFamily: '"Courier New", monospace', fontSize: 14, lineHeight: 1.45 }}>
                        <div>{text.doorsToggled}: {formatNumber(gameStats.exploration.doorsToggled)}</div>
                        <div>{text.wallSensorsActivated}: {formatNumber(gameStats.exploration.wallSensorsActivated)}</div>
                        <div>{text.fountainDrinks}: {formatNumber(gameStats.exploration.fountainDrinks)}</div>
                        <div>{text.waterContainersFilled}: {formatNumber(gameStats.exploration.waterContainersFilled)}</div>
                        <div>{text.sleeps}: {formatNumber(gameStats.exploration.sleeps)}</div>
                        <div>{text.wakes}: {formatNumber(gameStats.exploration.wakes)}</div>
                        <div>{text.resurrections}: {formatNumber(gameStats.exploration.resurrections)}</div>
                    </div>
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.itemsTitle}</div>
                    <div style={{ display: 'grid', gap: 6, fontFamily: '"Courier New", monospace', fontSize: 14, lineHeight: 1.45 }}>
                        <div>{text.pickedUp}: {formatNumber(gameStats.items.pickedUp)}</div>
                        <div>{text.dropped}: {formatNumber(gameStats.items.dropped)}</div>
                        <div>{text.thrown}: {formatNumber(gameStats.items.thrown)}</div>
                        <div>{text.used}: {formatNumber(gameStats.items.used)}</div>
                        <div>{text.equipped}: {formatNumber(gameStats.items.equipped)}</div>
                        <div>{text.unequipped}: {formatNumber(gameStats.items.unequipped)}</div>
                        <div>{text.storedInContainers}: {formatNumber(gameStats.items.storedInContainers)}</div>
                        <div>{text.takenFromContainers}: {formatNumber(gameStats.items.takenFromContainers)}</div>
                        <div>{text.given}: {formatNumber(gameStats.items.given)}</div>
                    </div>
                </div>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 14,
            }}>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.topSpellsTitle}</div>
                    {topSpells.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gap: 10,
                        }}>
                            {topSpells.map((entry) => (
                                <div
                                    key={entry.name}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(216, 188, 122, 0.16)',
                                    }}
                                >
                                    <div style={{
                                        fontFamily: '"Times New Roman", serif',
                                        fontSize: 22,
                                        letterSpacing: 1,
                                        color: '#f5e4b8',
                                        marginBottom: 4,
                                    }}>
                                        {entry.name}
                                    </div>
                                    <div style={{
                                        fontFamily: '"Courier New", monospace',
                                        fontSize: 13,
                                        lineHeight: 1.45,
                                        opacity: 0.9,
                                    }}>
                                        {text.spellSummary(entry.attempted, entry.succeeded, entry.failed)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            fontFamily: '"Courier New", monospace',
                            fontSize: 14,
                            opacity: 0.86,
                        }}>
                            {text.noSpellsCast}
                        </div>
                    )}
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.topCreaturesTitle}</div>
                    {topCreatures.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gap: 10,
                        }}>
                            {topCreatures.map(([name, count]) => (
                                <div
                                    key={name}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(216, 188, 122, 0.16)',
                                        gap: 12,
                                    }}
                                >
                                    <div style={{
                                        fontFamily: '"Times New Roman", serif',
                                        fontSize: 22,
                                        letterSpacing: 1,
                                        color: '#f5e4b8',
                                    }}>
                                        {name}
                                    </div>
                                    <div style={{
                                        fontFamily: '"Courier New", monospace',
                                        fontSize: 18,
                                        opacity: 0.92,
                                    }}>
                                        {formatNumber(count)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            fontFamily: '"Courier New", monospace',
                            fontSize: 14,
                            opacity: 0.86,
                        }}>
                            {text.noCreaturesKilled}
                        </div>
                    )}
                </div>
            </div>
            {footer}
        </div>
    );
};
