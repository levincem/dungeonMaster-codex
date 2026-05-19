import { useEffect, useMemo, useState } from 'react';
import {
    loadHallOfFameEntries,
    readHallOfFameEntries,
    type HallOfFameEntry,
} from '../../engine/hallOfFame';
import { getCurrentLocale, useI18n } from '../../i18n';
import {
    formatHallOfFameCompletedAt,
    formatHallOfFameCompactNumber,
    formatHallOfFameDurationFromSeconds,
    sortHallOfFameEntries,
} from './hallOfFameDetails';
import { HallOfFameEntryDetailsOverlay } from './HallOfFameEntryDetailsOverlay';

interface HallOfFameModalProps {
    onClose: () => void;
}

export const HallOfFameModal = ({ onClose }: HallOfFameModalProps) => {
    const { titleScreen, victory } = useI18n();
    const locale = getCurrentLocale();
    const [entries, setEntries] = useState<HallOfFameEntry[]>(() => readHallOfFameEntries());
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void loadHallOfFameEntries().then((result) => {
            if (cancelled) return;
            setEntries(result.entries);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (selectedEntryId) {
                    setSelectedEntryId(null);
                    return;
                }
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, selectedEntryId]);

    const leaderboardEntries = useMemo(
        () => sortHallOfFameEntries(entries).slice(0, 20),
        [entries],
    );
    const selectedEntry = useMemo(
        () => (selectedEntryId ? entries.find((entry) => entry.id === selectedEntryId) ?? null : null),
        [entries, selectedEntryId],
    );

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(3, 2, 1, 0.78)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 30,
                padding: '32px min(3vw, 28px)',
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={victory.hallOfFameTitle}
                style={{
                    width: 'min(88vw, 980px)',
                    maxHeight: 'min(84vh, 920px)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: '22px 24px 20px',
                    borderRadius: 14,
                    background: 'linear-gradient(180deg, rgba(18, 14, 9, 0.94), rgba(8, 6, 4, 0.97))',
                    border: '1px solid rgba(232, 215, 164, 0.34)',
                    boxShadow: '0 28px 72px rgba(0, 0, 0, 0.54)',
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                }}>
                    <div>
                        <div style={{
                            fontFamily: '"Times New Roman", serif',
                            fontSize: 'clamp(26px, 3.2vw, 42px)',
                            letterSpacing: 2,
                            textTransform: 'uppercase',
                            color: '#f2dfb2',
                            textShadow: '0 2px 10px rgba(0,0,0,0.45)',
                        }}>
                            {victory.hallOfFameTitle}
                        </div>
                        <div style={{
                            marginTop: 6,
                            fontFamily: '"Courier New", monospace',
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: '#e7d5a4',
                        }}>
                            {titleScreen.hallOfFameBrowse}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(232, 215, 164, 0.32)',
                            background: 'linear-gradient(180deg, rgba(42, 30, 16, 0.94), rgba(20, 14, 8, 0.96))',
                            color: '#f0dfaf',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 13,
                            letterSpacing: 1,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {titleScreen.hallOfFameClose}
                    </button>
                </div>

                <div style={{
                    padding: '16px 18px',
                    borderRadius: 12,
                    background: 'linear-gradient(180deg, rgba(12, 10, 8, 0.46), rgba(7, 6, 5, 0.66))',
                    border: '1px solid rgba(216, 188, 122, 0.22)',
                    boxShadow: 'inset 0 0 0 1px rgba(87, 62, 28, 0.24)',
                    overflow: 'auto',
                }}>
                    {leaderboardEntries.length > 0 ? (
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 13,
                            lineHeight: 1.45,
                        }}>
                            <thead>
                                <tr style={{ color: '#f0d996', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    <th style={{ textAlign: 'left', padding: '0 0 10px' }}>{victory.hallOfFameRank}</th>
                                    <th style={{ textAlign: 'left', padding: '0 0 10px' }}>{victory.hallOfFameNameLabel}</th>
                                    <th style={{ textAlign: 'left', padding: '0 0 10px' }}>{victory.hallOfFameCompleted}</th>
                                    <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{victory.hallOfFameTime}</th>
                                    <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{victory.hallOfFameKills}</th>
                                    <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{victory.hallOfFameSpells}</th>
                                    <th style={{ textAlign: 'right', padding: '0 0 10px' }}>{victory.hallOfFameDamage}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboardEntries.map((entry, index) => (
                                    <tr
                                        key={entry.id}
                                        onClick={() => setSelectedEntryId(entry.id)}
                                        style={{
                                            borderTop: '1px solid rgba(216, 188, 122, 0.14)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <td style={{ padding: '10px 0' }}>#{index + 1}</td>
                                        <td style={{ padding: '10px 12px 10px 0' }}>{entry.name}</td>
                                        <td style={{ padding: '10px 12px 10px 0' }}>{formatHallOfFameCompletedAt(entry.completedAt, locale)}</td>
                                        <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameDurationFromSeconds(entry.summary.playTimeSec)}</td>
                                        <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameCompactNumber(entry.summary.monstersKilled, locale)}</td>
                                        <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameCompactNumber(entry.summary.spellsCast, locale)}</td>
                                        <td style={{ padding: '10px 0', textAlign: 'right' }}>{formatHallOfFameCompactNumber(entry.summary.damageDealt, locale)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{
                            fontFamily: '"Courier New", monospace',
                            fontSize: 14,
                            color: '#f1e4c1',
                            opacity: 0.88,
                        }}>
                            {victory.hallOfFameEmpty}
                        </div>
                    )}
                </div>
            </div>
            {selectedEntry && (
                <HallOfFameEntryDetailsOverlay
                    entry={selectedEntry}
                    onClose={() => setSelectedEntryId(null)}
                />
            )}
        </div>
    );
};
