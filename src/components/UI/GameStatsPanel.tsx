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

function formatLevelLabel(levelKey: string): string {
    const levelIndex = Number.parseInt(levelKey, 10);
    if (!Number.isFinite(levelIndex) || levelIndex < 0) {
        return levelKey;
    }
    return `L${levelIndex + 1}`;
}

function clampRatio(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(1, value / max));
}

export interface GameStatsPanelProps {
    gameStats: GameStats;
    title?: string;
    footer?: ReactNode;
    completedAt?: number;
}

export const GameStatsPanel = ({ gameStats, title, footer, completedAt }: GameStatsPanelProps) => {
    const text = useI18n().victory;
    const referenceCompletedAt = completedAt ?? Date.now();
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
                .slice(0, 3),
        [gameStats.magic.bySpell],
    );
    const topCreatures = useMemo(
        () =>
            Object.entries(gameStats.combat.byCreature)
                .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                .slice(0, 3),
        [gameStats.combat.byCreature],
    );
    const dangerousCreatures = useMemo(
        () =>
            Object.entries(gameStats.combat.damageTakenByCreature)
                .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
                .slice(0, 3),
        [gameStats.combat.damageTakenByCreature],
    );
    const timeByLevel = useMemo(
        () =>
            Object.entries(gameStats.exploration.timeByLevelMs)
                .filter(([, durationMs]) => durationMs > 0)
                .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))
                .slice(0, 3),
        [gameStats.exploration.timeByLevelMs],
    );
    const totalSteps =
        gameStats.movement.stepsForward +
        gameStats.movement.stepsBackward +
        gameStats.movement.strafesLeft +
        gameStats.movement.strafesRight;
    const totalTurns = gameStats.movement.turnsLeft + gameStats.movement.turnsRight;
    const topSpellMax = topSpells[0]?.attempted ?? 0;
    const topCreatureMax = topCreatures[0]?.[1] ?? 0;
    const dangerousCreatureMax = dangerousCreatures[0]?.[1] ?? 0;
    const summaryStats = [
        { label: text.playTime, value: formatDuration(referenceCompletedAt - gameStats.startedAt) },
        { label: text.monstersKilled, value: formatNumber(gameStats.combat.monstersKilled) },
        { label: text.spellsAttempted, value: formatNumber(gameStats.magic.spells.attempted) },
        { label: text.damageDealt, value: formatNumber(gameStats.combat.damageDealt.total) },
        { label: text.damageTaken, value: formatNumber(gameStats.combat.damageTaken.total) },
        { label: text.manaSpent, value: formatNumber(gameStats.magic.manaSpent) },
    ];
    const shellStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'stretch',
        gap: 14,
        alignSelf: 'center',
        width: 'min(94vw, 1500px)',
        maxHeight: 'min(90vh, 950px)',
        margin: 'min(1.5vh, 12px) 0',
        padding: '18px 20px 16px',
        borderRadius: 16,
        background: 'linear-gradient(180deg, rgba(26, 21, 12, 0.9), rgba(13, 10, 6, 0.95))',
        border: '1px solid rgba(186, 145, 76, 0.34)',
        boxShadow: '0 26px 70px rgba(0, 0, 0, 0.48)',
        backdropFilter: 'blur(2px)',
        overflowY: 'hidden' as const,
        overflowX: 'hidden' as const,
    };
    const sectionTitleStyle = {
        fontFamily: 'Garamond, "Times New Roman", serif',
        fontSize: 'clamp(14px, 1.05vw, 17px)',
        letterSpacing: 0.45,
        textTransform: 'uppercase' as const,
        color: '#c9782f',
        textShadow: '0 2px 10px rgba(0,0,0,0.4)',
    };
    const sectionPanelStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 10,
        minHeight: 0,
        padding: '16px 18px 14px',
        borderRadius: 10,
        background: 'linear-gradient(180deg, rgba(32, 25, 15, 0.78), rgba(20, 15, 9, 0.82))',
        border: '1px solid rgba(137, 106, 52, 0.26)',
        boxShadow: 'inset 0 0 0 1px rgba(76, 57, 28, 0.18)',
    };
    const sectionDividerStyle = {
        height: 1,
        background: 'linear-gradient(90deg, rgba(198, 156, 80, 0.45), rgba(198, 156, 80, 0.1))',
        marginTop: 2,
        marginBottom: 8,
    };
    const compactListStyle = {
        display: 'grid',
        gap: 8,
        fontFamily: '"Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.35,
        color: '#ecd9ae',
    };
    const counterRowStyle = {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'baseline',
    };
    const compactBarTrackStyle = {
        height: 5,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    };

    return (
        <div style={shellStyle}>
            <div style={{
                fontFamily: 'Garamond, "Times New Roman", serif',
                fontSize: 'clamp(20px, 1.9vw, 30px)',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                textAlign: 'center',
                color: '#c9782f',
                textShadow: '0 2px 12px rgba(0,0,0,0.55)',
                paddingBottom: 6,
                borderBottom: '1px solid rgba(161, 122, 60, 0.24)',
            }}>
                {title ?? text.statsTitle}
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
            }}>
                {summaryStats.map((entry) => (
                    <div
                        key={entry.label}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            minHeight: 78,
                            padding: '5px 14px 4px',
                            borderRadius: 10,
                            background: 'linear-gradient(180deg, rgba(34, 28, 18, 0.74), rgba(21, 16, 10, 0.82))',
                            border: '1px solid rgba(137, 106, 52, 0.28)',
                            boxShadow: 'inset 0 0 0 1px rgba(76, 57, 28, 0.16)',
                        }}
                    >
                        <div style={{
                            fontFamily: 'Garamond, "Times New Roman", serif',
                            fontSize: 'clamp(13px, 0.95vw, 15px)',
                            letterSpacing: 0.45,
                            textTransform: 'uppercase',
                            color: '#c9782f',
                            opacity: 0.94,
                            marginBottom: 1,
                        }}>
                            {entry.label}
                        </div>
                        <div style={{
                            fontFamily: '"Times New Roman", serif',
                            fontSize: 'clamp(19px, 2vw, 28px)',
                            letterSpacing: 0.8,
                            lineHeight: 1.02,
                            color: '#efc876',
                        }}>
                            {entry.value}
                        </div>
                    </div>
                ))}
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 12,
            }}>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.attacksTitle}</div>
                    <div style={sectionDividerStyle} />
                    <div style={compactListStyle}>
                        <div style={counterRowStyle}><span>{text.total}</span><strong>{formatNumber(gameStats.combat.attacks.total)}</strong></div>
                        <div style={counterRowStyle}><span>{text.melee}</span><strong>{formatNumber(gameStats.combat.attacks.melee)}</strong></div>
                        <div style={counterRowStyle}><span>{text.projectile}</span><strong>{formatNumber(gameStats.combat.attacks.projectile)}</strong></div>
                        <div style={counterRowStyle}><span>{text.utility}</span><strong>{formatNumber(gameStats.combat.attacks.utility)}</strong></div>
                        <div style={{ ...sectionDividerStyle, marginTop: 2, marginBottom: 2 }} />
                        <div style={counterRowStyle}><span>{text.championsKilled}</span><strong>{formatNumber(gameStats.combat.championsKilled)}</strong></div>
                    </div>
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.movementTitle}</div>
                    <div style={sectionDividerStyle} />
                    <div style={compactListStyle}>
                        <div style={counterRowStyle}><span>{text.steps}</span><strong>{formatNumber(totalSteps)}</strong></div>
                        <div style={counterRowStyle}><span>{text.turns}</span><strong>{formatNumber(totalTurns)}</strong></div>
                        <div style={counterRowStyle}><span>{text.bumps}</span><strong>{formatNumber(gameStats.movement.bumps)}</strong></div>
                        <div style={counterRowStyle}><span>{text.falls}</span><strong>{formatNumber(gameStats.movement.falls)}</strong></div>
                        <div style={counterRowStyle}><span>{text.levelTransitions}</span><strong>{formatNumber(gameStats.exploration.levelTransitions)}</strong></div>
                    </div>
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.explorationTitle}</div>
                    <div style={sectionDividerStyle} />
                    <div style={compactListStyle}>
                        <div style={counterRowStyle}><span>{text.doorsToggled}</span><strong>{formatNumber(gameStats.exploration.doorsToggled)}</strong></div>
                        <div style={counterRowStyle}><span>{text.wallSensorsActivated}</span><strong>{formatNumber(gameStats.exploration.wallSensorsActivated)}</strong></div>
                        <div style={counterRowStyle}><span>{text.fountainDrinks}</span><strong>{formatNumber(gameStats.exploration.fountainDrinks)}</strong></div>
                        <div style={counterRowStyle}><span>{text.waterContainersFilled}</span><strong>{formatNumber(gameStats.exploration.waterContainersFilled)}</strong></div>
                        <div style={counterRowStyle}><span>{text.sleeps}</span><strong>{formatNumber(gameStats.exploration.sleeps)}</strong></div>
                        <div style={counterRowStyle}><span>{text.resurrections}</span><strong>{formatNumber(gameStats.exploration.resurrections)}</strong></div>
                    </div>
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.itemsTitle}</div>
                    <div style={sectionDividerStyle} />
                    <div style={compactListStyle}>
                        <div style={counterRowStyle}><span>{text.pickedUp}</span><strong>{formatNumber(gameStats.items.pickedUp)}</strong></div>
                        <div style={counterRowStyle}><span>{text.dropped}</span><strong>{formatNumber(gameStats.items.dropped)}</strong></div>
                        <div style={counterRowStyle}><span>{text.thrown}</span><strong>{formatNumber(gameStats.items.thrown)}</strong></div>
                        <div style={counterRowStyle}><span>{text.used}</span><strong>{formatNumber(gameStats.items.used)}</strong></div>
                        <div style={counterRowStyle}><span>{text.equipped}</span><strong>{formatNumber(gameStats.items.equipped)}</strong></div>
                    </div>
                </div>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
                gap: 12,
            }}>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.topSpellsTitle}</div>
                    <div style={sectionDividerStyle} />
                    {topSpells.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gap: 12,
                        }}>
                            {topSpells.map((entry) => (
                                <div
                                    key={entry.name}
                                    style={{
                                        display: 'grid',
                                        gap: 6,
                                    }}
                                >
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                        gap: 10,
                                        alignItems: 'baseline',
                                    }}>
                                        <div style={{
                                            fontFamily: '"Times New Roman", serif',
                                            fontSize: 20,
                                            letterSpacing: 1,
                                            color: '#f5e4b8',
                                        }}>
                                            {entry.name}
                                        </div>
                                        <div style={{
                                            fontFamily: '"Courier New", monospace',
                                            fontSize: 15,
                                            color: '#efc876',
                                        }}>
                                            {formatNumber(entry.attempted)}
                                        </div>
                                    </div>
                                    <div style={{
                                        ...compactBarTrackStyle,
                                    }}>
                                        <div style={{
                                            width: `${Math.round(clampRatio(entry.attempted, topSpellMax) * 100)}%`,
                                            height: '100%',
                                            borderRadius: 999,
                                            background: 'linear-gradient(90deg, #d7a64f, #f0d089)',
                                        }} />
                                    </div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                        gap: 8,
                                        fontFamily: '"Courier New", monospace',
                                        fontSize: 11,
                                        lineHeight: 1.35,
                                        opacity: 0.84,
                                    }}>
                                        <span>{text.spellsSucceeded}: {formatNumber(entry.succeeded)}</span>
                                        <span style={{ textAlign: 'right' }}>{text.spellsFailed}: {formatNumber(entry.failed)}</span>
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
                    <div style={sectionDividerStyle} />
                    {topCreatures.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gap: 10,
                        }}>
                            {topCreatures.map(([name, count]) => (
                                <div
                                    key={name}
                                    style={{
                                        display: 'grid',
                                        gap: 6,
                                    }}
                                >
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                        gap: 10,
                                        alignItems: 'baseline',
                                    }}>
                                        <div style={{
                                            fontFamily: '"Times New Roman", serif',
                                            fontSize: 20,
                                            letterSpacing: 1,
                                            color: '#f5e4b8',
                                        }}>
                                            {name}
                                        </div>
                                        <div style={{
                                            fontFamily: '"Courier New", monospace',
                                            fontSize: 15,
                                            color: '#efc876',
                                        }}>
                                            {formatNumber(count)}
                                        </div>
                                    </div>
                                    <div style={{
                                        ...compactBarTrackStyle,
                                    }}>
                                        <div style={{
                                            width: `${Math.round(clampRatio(count, topCreatureMax) * 100)}%`,
                                            height: '100%',
                                            borderRadius: 999,
                                            background: 'linear-gradient(90deg, rgba(219, 175, 95, 0.9), rgba(240, 214, 150, 0.95))',
                                        }} />
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
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.mostDangerousCreaturesTitle}</div>
                    <div style={sectionDividerStyle} />
                    {dangerousCreatures.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gap: 10,
                        }}>
                            {dangerousCreatures.map(([name, damage]) => (
                                <div
                                    key={name}
                                    style={{
                                        display: 'grid',
                                        gap: 6,
                                    }}
                                >
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                        gap: 10,
                                        alignItems: 'baseline',
                                    }}>
                                        <div style={{
                                            fontFamily: '"Times New Roman", serif',
                                            fontSize: 20,
                                            letterSpacing: 1,
                                            color: '#f5e4b8',
                                        }}>
                                            {name}
                                        </div>
                                        <div style={{
                                            fontFamily: '"Courier New", monospace',
                                            fontSize: 15,
                                            color: '#efc876',
                                        }}>
                                            {formatNumber(damage)}
                                        </div>
                                    </div>
                                    <div style={{
                                        ...compactBarTrackStyle,
                                    }}>
                                        <div style={{
                                            width: `${Math.round(clampRatio(damage, dangerousCreatureMax) * 100)}%`,
                                            height: '100%',
                                            borderRadius: 999,
                                            background: 'linear-gradient(90deg, rgba(210, 118, 78, 0.92), rgba(240, 176, 121, 0.95))',
                                        }} />
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
                            {text.noCreatureDamageTaken}
                        </div>
                    )}
                </div>
                <div style={sectionPanelStyle}>
                    <div style={sectionTitleStyle}>{text.timeByLevelTitle}</div>
                    <div style={sectionDividerStyle} />
                    {timeByLevel.length > 0 ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '8px 18px',
                        }}>
                            {timeByLevel.map(([levelKey, durationMs]) => (
                                <div
                                    key={levelKey}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                                        gap: 10,
                                        alignItems: 'baseline',
                                    }}
                                >
                                    <div style={{
                                        fontFamily: '"Times New Roman", serif',
                                        fontSize: 18,
                                        letterSpacing: 1,
                                        color: '#f5e4b8',
                                    }}>
                                        {formatLevelLabel(levelKey)}
                                    </div>
                                    <div style={{
                                        fontFamily: '"Courier New", monospace',
                                        fontSize: 13,
                                        opacity: 0.92,
                                        textAlign: 'right',
                                    }}>
                                        {formatDuration(durationMs)}
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
                            {text.noLevelTimeRecorded}
                        </div>
                    )}
                </div>
            </div>
            {footer}
        </div>
    );
};
