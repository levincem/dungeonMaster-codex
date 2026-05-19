import { useEffect, useMemo, useState } from 'react';
import { miscPath } from '../../data/assetPaths';
import { getGameMap } from '../../data/mapLoader';
import { useStore } from '../../engine/store';
import {
    appendHallOfFameEntry,
    buildHallOfFameEntry,
    loadHallOfFameEntries,
    readHallOfFameEntries,
    readLastHallOfFameName,
    type HallOfFameEntry,
} from '../../engine/hallOfFame';
import {
    HALL_OF_FAME_PLAYER_NAME_MAX_LENGTH,
    buildHallOfFameEntryProof,
    extractHallOfFameProofSourceFromSaveExport,
    sanitizeHallOfFamePlayerNameInput,
} from '../../engine/hallOfFameSecurity';
import { getCurrentLocale, useI18n } from '../../i18n';
import type { WallTextObject } from '../../types/game';
import { GameStatsPanel } from './GameStatsPanel';
import {
    buildHallOfFameEntryHoverText,
    formatHallOfFameCompletedAt,
    formatHallOfFameCompactNumber,
    formatHallOfFameDurationFromSeconds,
    sortHallOfFameEntries,
} from './hallOfFameDetails';

const ORIGINAL_ENDGAME_MAP_INDEX = 12;

function resolveOriginalEndText(): string | null {
    try {
        const startTile = getGameMap(ORIGINAL_ENDGAME_MAP_INDEX).tiles[0]?.[0];
        if (!startTile) return null;
        const messages = startTile.objects
            .filter((object): object is WallTextObject =>
                object.category === 'Text' &&
                typeof (object as WallTextObject).text === 'string' &&
                ((object as WallTextObject).text?.length ?? 0) > 1,
            )
            .map((object) => ({
                order: object.text?.[0] ?? '',
                message: object.text?.slice(1).trim() ?? '',
            }))
            .filter((entry) => /^[A-Z]$/.test(entry.order) && entry.message.length > 0)
            .sort((a, b) => a.order.localeCompare(b.order))
            .map((entry) => entry.message.replace(/\n/g, ' '));
        return messages.length > 0 ? messages.join('\n\n') : null;
    } catch {
        return null;
    }
}

const ORIGINAL_END_TEXT = resolveOriginalEndText();

type VictoryStage = 'message' | 'stats' | 'hall' | 'end';

function resolveEntryRank(
    entries: HallOfFameEntry[],
    entryId: string,
    accessor: (entry: HallOfFameEntry) => number,
    direction: 'asc' | 'desc',
): number | null {
    const sorted = [...entries].sort((left, right) => {
        const leftValue = accessor(left);
        const rightValue = accessor(right);
        if (leftValue !== rightValue) {
            return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
        }
        return right.completedAt - left.completedAt;
    });
    const index = sorted.findIndex((entry) => entry.id === entryId);
    return index >= 0 ? index + 1 : null;
}

export const VictoryScreen = () => {
    const text = useI18n().victory;
    const locale = getCurrentLocale();
    const gameStats = useStore((state) => state.gameStats);
    const buildSaveExportPayload = useStore((state) => state.buildSaveExportPayload);
    const [stage, setStage] = useState<VictoryStage>('message');
    const [playerName, setPlayerName] = useState(() => readLastHallOfFameName());
    const [nameInputBlocked, setNameInputBlocked] = useState(false);
    const [hallEntries, setHallEntries] = useState<HallOfFameEntry[]>(() => readHallOfFameEntries());
    const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
    const [hallFeedback, setHallFeedback] = useState<{ message: string; success: boolean } | null>(null);
    const [isSavingHallEntry, setIsSavingHallEntry] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void loadHallOfFameEntries().then((result) => {
            if (cancelled) return;
            setHallEntries(result.entries);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (stage !== 'hall' || !savedEntryId) return undefined;
        const timeoutId = window.setTimeout(() => {
            setStage('end');
        }, 5000);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [savedEntryId, stage]);

    const showStatsCard = stage === 'stats';
    const showHallCard = stage === 'hall';
    const showEndCard = stage === 'end';
    const canOverlayAdvance = stage === 'message' || stage === 'stats';
    const savedEntry = useMemo(
        () => hallEntries.find((entry) => entry.id === savedEntryId) ?? null,
        [hallEntries, savedEntryId],
    );
    const leaderboardEntries = useMemo(
        () => {
            const sortedEntries = sortHallOfFameEntries(hallEntries)
                .slice(0, 10);
            if (!savedEntryId || sortedEntries.some((entry) => entry.id === savedEntryId)) {
                return sortedEntries;
            }
            const currentEntry = hallEntries.find((entry) => entry.id === savedEntryId);
            if (!currentEntry) return sortedEntries;
            return [...sortedEntries.slice(0, 9), currentEntry];
        },
        [hallEntries, savedEntryId],
    );
    const comparisonRanks = useMemo(() => {
        if (!savedEntry) return null;
        return {
            fastest: resolveEntryRank(hallEntries, savedEntry.id, (entry) => entry.summary.playTimeSec, 'asc'),
            slayer: resolveEntryRank(hallEntries, savedEntry.id, (entry) => entry.summary.monstersKilled, 'desc'),
            archmage: resolveEntryRank(hallEntries, savedEntry.id, (entry) => entry.summary.spellsCast, 'desc'),
        };
    }, [hallEntries, savedEntry]);

    const advance = () => setStage((current) => (
        current === 'message'
            ? 'stats'
            : current === 'stats'
                ? 'hall'
                : current
    ));

    const handleSaveVictory = async () => {
        if (savedEntryId || isSavingHallEntry) return;
        setIsSavingHallEntry(true);
        setHallFeedback(null);
        const completedAt = Date.now();
        const entry = buildHallOfFameEntry(playerName, gameStats, completedAt);
        const proofSource = extractHallOfFameProofSourceFromSaveExport(buildSaveExportPayload());
        const proof = buildHallOfFameEntryProof(entry, proofSource);
        if (!proof) {
            console.warn('[hall-of-fame] Failed to build victory proof before submission.', {
                entryId: entry.id,
                completedAt: entry.completedAt,
                startedAt: entry.stats.startedAt,
                proofSource,
            });
            setHallFeedback({
                message: text.hallOfFameSaveFailed,
                success: false,
            });
            setIsSavingHallEntry(false);
            return;
        }

        const result = await appendHallOfFameEntry({ ...entry, proof });
        if (!result.success) {
            console.warn('[hall-of-fame] Victory submission failed.', {
                entryId: entry.id,
                source: result.source,
                reason: result.reason,
                completedAt: entry.completedAt,
                startedAt: entry.stats.startedAt,
                playTimeSec: entry.summary.playTimeSec,
            });
        }
        setHallEntries(result.entries);
        setSavedEntryId(result.success ? entry.id : null);
        setHallFeedback({
            message: result.success ? text.hallOfFameSaved : text.hallOfFameSaveFailed,
            success: result.success,
        });
        setIsSavingHallEntry(false);
    };

    return (
        <div
            onClick={canOverlayAdvance ? advance : undefined}
            onKeyDown={canOverlayAdvance ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    advance();
                }
            } : undefined}
            role={canOverlayAdvance ? 'button' : undefined}
            tabIndex={canOverlayAdvance ? 0 : -1}
            style={{
                position: 'fixed',
                inset: 0,
                background: showEndCard
                    ? 'rgba(4, 3, 2, 0.58)'
                    : showHallCard
                        ? 'rgba(4, 3, 2, 0.5)'
                        : showStatsCard
                            ? 'rgba(4, 3, 2, 0.42)'
                            : 'rgba(4, 3, 2, 0.34)',
                color: '#e8d7a4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: canOverlayAdvance ? 'pointer' : 'default',
                zIndex: 220,
            }}
        >
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: showEndCard
                        ? 'radial-gradient(circle at 50% 58%, rgba(255,216,132,0.04) 0%, rgba(0,0,0,0.02) 24%, rgba(0,0,0,0.46) 100%)'
                        : showHallCard
                            ? 'radial-gradient(circle at 50% 54%, rgba(255,216,132,0.06) 0%, rgba(0,0,0,0.02) 24%, rgba(0,0,0,0.42) 100%)'
                            : showStatsCard
                                ? 'radial-gradient(circle at 50% 54%, rgba(255,216,132,0.08) 0%, rgba(0,0,0,0.02) 24%, rgba(0,0,0,0.38) 100%)'
                                : 'radial-gradient(circle at 50% 56%, rgba(255,216,132,0.1) 0%, rgba(0,0,0,0.02) 24%, rgba(0,0,0,0.3) 100%)',
                    pointerEvents: 'none',
                }}
            />
            {stage === 'message' ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 16,
                    width: 'min(68vw, 760px)',
                    marginTop: '-6vh',
                    padding: '22px 24px 18px',
                    borderRadius: 14,
                    background: 'linear-gradient(180deg, rgba(18, 14, 9, 0.58), rgba(8, 6, 4, 0.78))',
                    border: '1px solid rgba(232, 215, 164, 0.36)',
                    boxShadow: '0 20px 56px rgba(0, 0, 0, 0.42)',
                    backdropFilter: 'blur(2px)',
                }}>
                    <div style={{
                        fontFamily: '"Times New Roman", serif',
                        fontSize: 'clamp(26px, 3.6vw, 46px)',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        textShadow: '0 2px 10px rgba(0,0,0,0.55)',
                    }}>
                        {text.greyLord}
                    </div>
                    <div style={{
                        alignSelf: 'center',
                        width: '100%',
                        maxWidth: 'min(62vw, 680px)',
                        padding: '16px 18px',
                        borderRadius: 10,
                        border: '1px solid rgba(216, 188, 122, 0.38)',
                        background: 'linear-gradient(180deg, rgba(12, 10, 8, 0.42), rgba(7, 6, 5, 0.64))',
                        boxShadow: 'inset 0 0 0 1px rgba(87, 62, 28, 0.34)',
                        fontFamily: '"Courier New", monospace',
                        fontSize: 'clamp(15px, 1.55vw, 20px)',
                        lineHeight: 1.55,
                        letterSpacing: 0.8,
                        whiteSpace: 'pre-line',
                        color: '#f1e4c1',
                        textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                    }}>
                        {ORIGINAL_END_TEXT ?? text.originalEndText}
                    </div>
                    <div style={{
                        textAlign: 'center',
                        fontFamily: '"Courier New", monospace',
                        fontSize: 'clamp(13px, 1.3vw, 17px)',
                        letterSpacing: 1.2,
                        color: '#f0d996',
                        textTransform: 'uppercase',
                        opacity: 0.92,
                    }}>
                        {text.clickToContinue}
                    </div>
                </div>
            ) : stage === 'stats' ? (
                <GameStatsPanel
                    gameStats={gameStats}
                    footer={
                        <div style={{
                            textAlign: 'center',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 'clamp(13px, 1.3vw, 17px)',
                            letterSpacing: 1.2,
                            color: '#f0d996',
                            textTransform: 'uppercase',
                            opacity: 0.92,
                        }}>
                            {text.clickToContinue}
                        </div>
                    }
                />
            ) : stage === 'hall' ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 18,
                    width: 'min(78vw, 980px)',
                    marginTop: '-1vh',
                    padding: '24px 26px 20px',
                    borderRadius: 14,
                    background: 'linear-gradient(180deg, rgba(18, 14, 9, 0.62), rgba(8, 6, 4, 0.86))',
                    border: '1px solid rgba(232, 215, 164, 0.34)',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
                    backdropFilter: 'blur(2px)',
                }}>
                    <div style={{
                        fontFamily: '"Times New Roman", serif',
                        fontSize: 'clamp(28px, 3.8vw, 46px)',
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        textShadow: '0 2px 10px rgba(0,0,0,0.55)',
                    }}>
                        {text.hallOfFameTitle}
                    </div>
                    <div style={{
                        fontFamily: '"Courier New", monospace',
                        fontSize: 15,
                        lineHeight: 1.5,
                        textAlign: 'center',
                        color: '#f1e4c1',
                    }}>
                        {text.hallOfFamePrompt}
                    </div>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'end',
                        justifyContent: 'center',
                        gap: 12,
                    }}>
                        <label style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            minWidth: 'min(340px, 72vw)',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 13,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            color: '#f0d996',
                        }}>
                            <span>{text.hallOfFameNameLabel}</span>
                            <input
                                type="text"
                                value={playerName}
                                maxLength={HALL_OF_FAME_PLAYER_NAME_MAX_LENGTH}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    const sanitizedValue = sanitizeHallOfFamePlayerNameInput(nextValue);
                                    setPlayerName(sanitizedValue);
                                    setNameInputBlocked(nextValue !== sanitizedValue);
                                }}
                                placeholder={text.hallOfFameNamePlaceholder}
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                inputMode="text"
                                pattern="[A-Za-z0-9]*"
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(232, 215, 164, 0.34)',
                                    background: 'rgba(9, 7, 5, 0.82)',
                                    color: '#f5e4b8',
                                    fontFamily: '"Courier New", monospace',
                                    fontSize: 15,
                                    outline: 'none',
                                }}
                            />
                            <span style={{
                                minHeight: 18,
                                fontSize: 11,
                                letterSpacing: 0.6,
                                textTransform: 'none',
                                color: nameInputBlocked ? '#e3b57b' : '#cfbf94',
                            }}>
                                {nameInputBlocked ? text.hallOfFameNameBlocked : text.hallOfFameNameHelp}
                            </span>
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                void handleSaveVictory();
                            }}
                            disabled={Boolean(savedEntryId) || isSavingHallEntry}
                            style={{
                                padding: '12px 18px',
                                borderRadius: 8,
                                border: '1px solid rgba(232, 215, 164, 0.38)',
                                background: savedEntryId
                                    ? 'linear-gradient(180deg, rgba(52, 58, 34, 0.92), rgba(28, 34, 18, 0.92))'
                                    : 'linear-gradient(180deg, rgba(58, 43, 22, 0.96), rgba(28, 20, 12, 0.96))',
                                color: '#f0dfaf',
                                fontFamily: '"Courier New", monospace',
                                fontSize: 14,
                                letterSpacing: 1,
                                cursor: savedEntryId || isSavingHallEntry ? 'default' : 'pointer',
                                minWidth: 180,
                            }}
                        >
                            {text.hallOfFameSave}
                        </button>
                    </div>
                    {hallFeedback && (
                        <div style={{
                            textAlign: 'center',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 13,
                            color: hallFeedback.success ? '#9ad18f' : '#e0a18a',
                        }}>
                            {hallFeedback.message}
                        </div>
                    )}
                    {comparisonRanks && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: 12,
                        }}>
                            {[
                                { label: text.hallOfFameFastestRank, value: comparisonRanks.fastest },
                                { label: text.hallOfFameSlayerRank, value: comparisonRanks.slayer },
                                { label: text.hallOfFameArchmageRank, value: comparisonRanks.archmage },
                            ].map((entry) => (
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
                                        fontSize: 30,
                                        letterSpacing: 1.2,
                                        color: '#f5e4b8',
                                    }}>
                                        #{entry.value ?? '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{
                        padding: '16px 18px',
                        borderRadius: 12,
                        background: 'linear-gradient(180deg, rgba(12, 10, 8, 0.46), rgba(7, 6, 5, 0.66))',
                        border: '1px solid rgba(216, 188, 122, 0.22)',
                        boxShadow: 'inset 0 0 0 1px rgba(87, 62, 28, 0.24)',
                    }}>
                        <div style={{
                            fontFamily: '"Times New Roman", serif',
                            fontSize: 'clamp(20px, 2.1vw, 28px)',
                            letterSpacing: 1.6,
                            textTransform: 'uppercase',
                            color: '#f2dfb2',
                            textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                            marginBottom: 12,
                        }}>
                            {text.hallOfFameLeaderboardTitle}
                        </div>
                        {leaderboardEntries.length > 0 ? (
                            <div style={{
                                overflowX: 'auto',
                            }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontFamily: '"Courier New", monospace',
                                    fontSize: 13,
                                    lineHeight: 1.45,
                                }}>
                                    <thead>
                                        <tr style={{ color: '#f0d996', textTransform: 'uppercase', letterSpacing: 1 }}>
                                            <th style={{ textAlign: 'left', padding: '0 0 10px' }}>{text.hallOfFameRank}</th>
                                            <th style={{ textAlign: 'left', padding: '0 0 10px' }}>{text.hallOfFameNameLabel}</th>
                                            <th style={{ textAlign: 'left', padding: '0 0 10px' }}>{text.hallOfFameCompleted}</th>
                                            <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{text.hallOfFameTime}</th>
                                            <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{text.hallOfFameKills}</th>
                                            <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{text.hallOfFameSpells}</th>
                                            <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{text.hallOfFameDamage}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboardEntries.map((entry, index) => {
                                            const isCurrent = entry.id === savedEntryId;
                                            const rank = resolveEntryRank(
                                                hallEntries,
                                                entry.id,
                                                (candidate) => candidate.summary.playTimeSec,
                                                'asc',
                                            ) ?? (index + 1);
                                            return (
                                                <tr
                                                    key={entry.id}
                                                    title={buildHallOfFameEntryHoverText(entry, text, locale)}
                                                    style={{
                                                        borderTop: '1px solid rgba(216, 188, 122, 0.14)',
                                                        background: isCurrent ? 'rgba(255, 224, 132, 0.08)' : 'transparent',
                                                        cursor: 'help',
                                                    }}
                                                >
                                                    <td style={{ padding: '10px 0' }}>#{rank}</td>
                                                    <td style={{ padding: '10px 12px 10px 0' }}>
                                                        {entry.name}
                                                        {isCurrent && (
                                                            <span style={{ marginLeft: 8, color: '#f0d996' }}>
                                                                {text.hallOfFameCurrentRun}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px 12px 10px 0' }}>{formatHallOfFameCompletedAt(entry.completedAt, locale)}</td>
                                                    <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameDurationFromSeconds(entry.summary.playTimeSec)}</td>
                                                    <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameCompactNumber(entry.summary.monstersKilled, locale)}</td>
                                                    <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameCompactNumber(entry.summary.spellsCast, locale)}</td>
                                                    <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameCompactNumber(entry.summary.damageDealt, locale)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{
                                fontFamily: '"Courier New", monospace',
                                fontSize: 14,
                                opacity: 0.86,
                            }}>
                                {text.hallOfFameEmpty}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20,
                    textAlign: 'center',
                    padding: '28px 34px',
                    borderRadius: 16,
                    background: 'linear-gradient(180deg, rgba(18, 14, 9, 0.72), rgba(8, 6, 4, 0.9))',
                    border: '1px solid rgba(232, 215, 164, 0.24)',
                    boxShadow: '0 28px 72px rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(2px)',
                }}>
                    <img
                        src={miscPath('Dm_logo.png')}
                        alt={text.dungeonMasterAlt}
                        draggable={false}
                        style={{
                            width: 'min(42vw, 520px)',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 18px 48px rgba(0,0,0,0.85))',
                        }}
                    />
                    <div style={{
                        fontFamily: '"Times New Roman", serif',
                        fontSize: 'clamp(34px, 5vw, 64px)',
                        letterSpacing: 4,
                        textTransform: 'uppercase',
                    }}>
                        {text.theEnd}
                    </div>
                    <div style={{
                        fontFamily: '"Courier New", monospace',
                        fontSize: 'clamp(14px, 1.5vw, 19px)',
                        letterSpacing: 1,
                        color: '#f1e4c1',
                    }}>
                        {text.thanksForPlaying}
                    </div>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: 8,
                            padding: '12px 18px',
                            borderRadius: 8,
                            border: '1px solid rgba(232, 215, 164, 0.38)',
                            background: 'linear-gradient(180deg, rgba(58, 43, 22, 0.96), rgba(28, 20, 12, 0.96))',
                            color: '#f0dfaf',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 14,
                            letterSpacing: 1,
                            cursor: 'pointer',
                        }}
                    >
                        {text.returnHome}
                    </button>
                </div>
            )}
        </div>
    );
};
