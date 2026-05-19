import type { HallOfFameEntry } from '../../engine/hallOfFame';
import { getCurrentLocale, useI18n } from '../../i18n';
import { GameStatsPanel } from './GameStatsPanel';
import { formatHallOfFameCompletedAt } from './hallOfFameDetails';

interface HallOfFameEntryDetailsOverlayProps {
    entry: HallOfFameEntry;
    onClose: () => void;
}

export const HallOfFameEntryDetailsOverlay = ({ entry, onClose }: HallOfFameEntryDetailsOverlayProps) => {
    const { victory } = useI18n();
    const locale = getCurrentLocale();

    return (
        <div
            onClick={(event) => {
                event.stopPropagation();
                onClose();
            }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(3, 2, 1, 0.76)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px min(2vw, 24px)',
                zIndex: 40,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${victory.hallOfFameTitle} ${entry.name}`}
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    width: '100%',
                }}
            >
                <GameStatsPanel
                    gameStats={entry.stats}
                    completedAt={entry.completedAt}
                    title={entry.name}
                    footer={(
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 10,
                        }}>
                            <div style={{
                                fontFamily: '"Courier New", monospace',
                                fontSize: 'clamp(12px, 1vw, 14px)',
                                letterSpacing: 0.8,
                                textAlign: 'center',
                                color: '#e6d2a0',
                                opacity: 0.92,
                            }}>
                                {victory.hallOfFameCompleted}: {formatHallOfFameCompletedAt(entry.completedAt, locale, true)}
                                {'  '}·{'  '}
                                {victory.hallOfFameBuild}: v{entry.buildVersion}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(232, 215, 164, 0.38)',
                                    background: 'linear-gradient(180deg, rgba(58, 43, 22, 0.96), rgba(28, 20, 12, 0.96))',
                                    color: '#f0dfaf',
                                    fontFamily: '"Courier New", monospace',
                                    fontSize: 13,
                                    letterSpacing: 1,
                                    cursor: 'pointer',
                                }}
                            >
                                {victory.hallOfFameBackToLeaderboard}
                            </button>
                        </div>
                    )}
                />
            </div>
        </div>
    );
};
