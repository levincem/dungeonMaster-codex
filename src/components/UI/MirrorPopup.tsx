import React from 'react';
import { CHAMPIONS } from '../../data/champions';
import type { Champion, ChampionClass } from '../../data/champions';
import { useStore } from '../../engine/store';
import { useI18n } from '../../i18n';

const CLASS_COLORS: Record<ChampionClass, string> = {
    Fighter: '#d05a45',
    Ninja: '#4fae6c',
    Wizard: '#9d79d0',
    Priest: '#5f8fcb',
};

const CLASS_MARKERS: Record<ChampionClass, string> = {
    Fighter: 'F',
    Ninja: 'N',
    Wizard: 'W',
    Priest: 'P',
};

const MAX_PARTY = 4;
const GOLD = '#d7b36a';
const GOLD_DIM = '#8f6b32';
const PANEL_BORDER = 'rgba(215, 179, 106, 0.42)';
const PANEL_BG = 'linear-gradient(180deg, rgba(10,10,10,0.98), rgba(18,16,12,0.96))';

const StatBar: React.FC<{ label: string; value: number; max?: number; color: string }> = ({
    label, value, max = 100, color,
}) => (
    <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b99b64', marginBottom: 4, letterSpacing: 1.2 }}>
            <span>{label}</span>
            <span style={{ color: '#f0dfb0', fontWeight: 700 }}>{value}</span>
        </div>
        <div style={{ height: 7, background: '#171410', borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(215, 179, 106, 0.12)' }}>
            <div style={{
                height: '100%',
                width: `${(value / max) * 100}%`,
                background: `linear-gradient(90deg, ${color}aa, ${color})`,
                borderRadius: 999,
                transition: 'width 0.4s ease',
            }} />
        </div>
    </div>
);

const Portrait: React.FC<{ champion: Champion; size?: number }> = ({ champion, size = 120 }) => (
    <img
        src={champion.portrait}
        alt={champion.name}
        style={{
            width: size,
            height: size,
            objectFit: 'cover',
            objectPosition: 'top center',
            flexShrink: 0,
            borderRadius: 8,
            border: `2px solid ${GOLD}`,
            boxShadow: '0 0 0 1px rgba(255, 231, 173, 0.12), 0 18px 36px rgba(0,0,0,0.5)',
            background: '#090909',
        }}
    />
);

function getPartyRequirementText(currentPartySize: number, text: ReturnType<typeof useI18n>['mirrorPopup']): string {
    const remaining = Math.max(0, MAX_PARTY - currentPartySize);
    if (remaining === 0) return text.partyFull;
    if (remaining === 1) return text.chooseOneMoreChampion;
    return text.chooseMoreChampions(remaining);
}

export const MirrorPopup: React.FC = () => {
    const text = useI18n().mirrorPopup;
    const {
        activeMirrorChampionId,
        party,
        closeMirror,
        addToParty,
        removeFromParty,
    } = useStore();

    if (activeMirrorChampionId === null) return null;

    const champion = CHAMPIONS[activeMirrorChampionId];
    if (!champion) return null;

    const classColor = CLASS_COLORS[champion.class];
    const isInParty = !!party.find(c => c.id === champion.id);
    const partyFull = party.length >= MAX_PARTY;

    return (
        <div
            onClick={closeMirror}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.84)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
                fontFamily: '"Courier New", Courier, monospace',
                padding: 16,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(520px, 96vw)',
                    background: PANEL_BG,
                    border: `2px solid ${GOLD_DIM}`,
                    borderRadius: 12,
                    boxShadow: '0 30px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,225,150,0.06) inset',
                    padding: 28,
                    color: '#e8d8b3',
                    position: 'relative',
                }}
            >
                <button
                    onClick={closeMirror}
                    aria-label={text.closeChampionSelection}
                    style={{
                        position: 'absolute',
                        top: 12,
                        right: 14,
                        background: 'none',
                        border: 'none',
                        color: '#8f7a52',
                        fontSize: 24,
                        cursor: 'pointer',
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>

                <div style={{ fontSize: 11, letterSpacing: 4, color: GOLD_DIM, marginBottom: 16, textAlign: 'center' }}>
                    {text.hallOfChampions.toUpperCase()}
                </div>

                <div style={{
                    display: 'flex',
                    gap: 18,
                    alignItems: 'flex-start',
                    marginBottom: 22,
                    padding: 18,
                    border: `1px solid ${PANEL_BORDER}`,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.34)',
                }}>
                    <Portrait champion={champion} />
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: 28,
                            fontWeight: 'bold',
                            letterSpacing: 2,
                            color: '#f0dfb0',
                            marginBottom: 4,
                        }}>
                            {champion.name.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 15, color: '#ab9a79', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.35 }}>
                            {champion.title}
                        </div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            background: `${classColor}18`,
                            border: `1px solid ${classColor}66`,
                            borderRadius: 999,
                            padding: '5px 12px',
                            fontSize: 12,
                            color: classColor,
                            fontWeight: 'bold',
                            letterSpacing: 1.5,
                        }}>
                            {CLASS_MARKERS[champion.class]} {champion.class.toUpperCase()}
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(0,0,0,0.38)',
                    border: `1px solid ${PANEL_BORDER}`,
                    borderRadius: 10,
                    padding: '16px 18px',
                    marginBottom: 18,
                }}>
                    <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD_DIM, marginBottom: 12 }}>{text.attributes.toUpperCase()}</div>
                    <StatBar label={text.strength.toUpperCase()} value={champion.strength} color="#d05a45" />
                    <StatBar label={text.dexterity.toUpperCase()} value={champion.dexterity} color="#4fae6c" />
                    <StatBar label={text.wisdom.toUpperCase()} value={champion.wisdom} color="#9d79d0" />
                    <StatBar label={text.vitality.toUpperCase()} value={champion.vitality} color="#5f8fcb" />
                    <StatBar label={text.health.toUpperCase()} value={champion.health} max={500} color="#cb8c42" />
                    {champion.mana > 0 && (
                        <StatBar label={text.mana.toUpperCase()} value={champion.mana} max={500} color="#6c82de" />
                    )}
                </div>

                {isInParty ? (
                    <button
                        onClick={() => removeFromParty(champion.id)}
                        style={{
                            width: '100%',
                            padding: '14px 0',
                            background: 'linear-gradient(180deg, #3a1414, #230909)',
                            border: '1px solid #7f3636',
                            borderRadius: 8,
                            color: '#f0d7d7',
                            fontSize: 14,
                            fontWeight: 'bold',
                            letterSpacing: 2,
                            cursor: 'pointer',
                            fontFamily: '"Courier New", monospace',
                            boxShadow: '0 0 18px rgba(127, 54, 54, 0.18)',
                        }}
                    >
                        {text.removeFromParty.toUpperCase()}
                    </button>
                ) : (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <button
                                onClick={() => addToParty(champion, 'resurrect')}
                                disabled={partyFull}
                                style={{
                                    padding: '14px 0',
                                    background: partyFull ? '#171717' : 'linear-gradient(180deg, #231d12, #120f09)',
                                    border: `1px solid ${partyFull ? '#343434' : GOLD}`,
                                    borderRadius: 8,
                                    color: partyFull ? '#575757' : '#f2deb2',
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    letterSpacing: 1.8,
                                    cursor: partyFull ? 'not-allowed' : 'pointer',
                                    fontFamily: '"Courier New", monospace',
                                    boxShadow: partyFull ? 'none' : '0 0 18px rgba(215, 179, 106, 0.14)',
                                }}
                            >
                                {text.resurrect.toUpperCase()}
                            </button>
                            <button
                                onClick={() => addToParty(champion, 'reincarnate')}
                                disabled={partyFull}
                                style={{
                                    padding: '14px 0',
                                    background: partyFull ? '#171717' : 'linear-gradient(180deg, #17110a, #0d0a06)',
                                    border: `1px solid ${partyFull ? '#343434' : GOLD}`,
                                    borderRadius: 8,
                                    color: partyFull ? '#575757' : '#f2deb2',
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    letterSpacing: 1.8,
                                    cursor: partyFull ? 'not-allowed' : 'pointer',
                                    fontFamily: '"Courier New", monospace',
                                    boxShadow: partyFull ? 'none' : '0 0 18px rgba(215, 179, 106, 0.14)',
                                }}
                            >
                                {text.reincarnate.toUpperCase()}
                            </button>
                        </div>
                        <div style={{
                            padding: '14px 16px',
                            border: `1px solid ${PANEL_BORDER}`,
                            borderRadius: 10,
                            background: 'rgba(0,0,0,0.24)',
                            color: '#bca47b',
                            fontSize: 12,
                            lineHeight: 1.6,
                        }}>
                            {text.resurrectDescription} {text.reincarnateDescription}
                        </div>
                        <div style={{
                            marginTop: 12,
                            fontSize: 11,
                            color: partyFull ? '#a16b6b' : '#8f7a52',
                            textAlign: 'center',
                            letterSpacing: 1.2,
                        }}>
                            {partyFull ? text.partyFull : getPartyRequirementText(party.length, text)}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
