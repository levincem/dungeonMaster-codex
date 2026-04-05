import React from 'react';
import { CHAMPIONS } from '../../data/champions';
import type { Champion, ChampionClass } from '../../data/champions';
import { useStore } from '../../engine/store';

const CLASS_COLORS: Record<ChampionClass, string> = {
    Fighter: '#c0392b',
    Ninja:   '#27ae60',
    Wizard:  '#8e44ad',
    Priest:  '#2980b9',
};
const CLASS_EMOJI: Record<ChampionClass, string> = {
    Fighter: '⚔️',
    Ninja:   '🗡️',
    Wizard:  '🔮',
    Priest:  '✨',
};

const MAX_PARTY = 4;

// ─── Stat bar ──────────────────────────────────────────────────────────────
const StatBar: React.FC<{ label: string; value: number; max?: number; color: string }> = ({
    label, value, max = 100, color,
}) => (
    <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginBottom: 2 }}>
            <span>{label}</span>
            <span style={{ color }}>{value}</span>
        </div>
        <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
                height: '100%',
                width: `${(value / max) * 100}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                borderRadius: 3,
                transition: 'width 0.4s ease',
            }} />
        </div>
    </div>
);

const Portrait: React.FC<{ champion: Champion; size?: number }> = ({ champion, size = 96 }) => (
    <img
        src={champion.portrait}
        alt={champion.name}
        style={{
            width: size, height: size,
            objectFit: 'cover',
            objectPosition: 'top center',
            flexShrink: 0,
            borderRadius: 6,
            border: `2px solid ${CLASS_COLORS[champion.class]}`,
            boxShadow: `0 0 16px ${CLASS_COLORS[champion.class]}55`,
        }}
    />
);

// ─── Party slot mini ──────────────────────────────────────────────────────
const PartySlotMini: React.FC<{
    champion?: Champion;
    onRemove: () => void;
}> = ({ champion, onRemove }) => {
    const color = champion ? CLASS_COLORS[champion.class] : '#333';
    if (champion) {
        return (
            <div
                onClick={onRemove}
                title={`Retirer ${champion.name}`}
                style={{
                    width: 52, height: 64,
                    borderRadius: 4,
                    border: `2px solid ${color}`,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    flexShrink: 0,
                }}
            >
                <img src={champion.portrait} alt={champion.name} style={{ width: 52, height: 64, objectFit: 'cover', objectPosition: 'top center', borderRadius: 0 }} />
            </div>
        );
    }
    return (
        <div
            style={{
                width: 52, height: 64,
                borderRadius: 4,
                border: `2px dashed #333`,
                background: '#0d0d12',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#2a2a2a', fontSize: 18,
            }}
        >
            +
        </div>
    );
};

// ─── Main Mirror Popup ─────────────────────────────────────────────────────
export const MirrorPopup: React.FC = () => {
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

    const color = CLASS_COLORS[champion.class];
    const isInParty = !!party.find(c => c.id === champion.id);
    const partyFull = party.length >= MAX_PARTY;

    return (
        /* Fullscreen backdrop */
        <div
            onClick={closeMirror}
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 100,
                fontFamily: '"Courier New", Courier, monospace',
            }}
        >
            {/* Card – stop propagation so click inside doesn't close */}
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 420,
                    background: 'linear-gradient(160deg, #0d0d18 0%, #1a1020 100%)',
                    border: `2px solid ${color}`,
                    borderRadius: 10,
                    boxShadow: `0 0 40px ${color}55, 0 20px 60px rgba(0,0,0,0.8)`,
                    padding: 24,
                    color: '#e0d5ba',
                    position: 'relative',
                }}
            >
                {/* Close button */}
                <button
                    onClick={closeMirror}
                    style={{
                        position: 'absolute', top: 10, right: 12,
                        background: 'none', border: 'none',
                        color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1,
                    }}
                >×</button>

                {/* Mirror label */}
                <div style={{ fontSize: 10, letterSpacing: 4, color: '#6a5430', marginBottom: 14, textAlign: 'center' }}>
                    ✦ HALL OF CHAMPIONS ✦
                </div>

                {/* Portrait + identity */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
                    <Portrait champion={champion} size={90} />
                    <div style={{ flex: 1 }}>
                        <div style={{
                            fontSize: 22, fontWeight: 'bold', letterSpacing: 2,
                            color: '#e0d5ba', textShadow: `0 0 12px ${color}88`,
                        }}>
                            {champion.name}
                        </div>
                        <div style={{ fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
                            {champion.title}
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: `${color}22`,
                            border: `1px solid ${color}66`,
                            borderRadius: 4,
                            padding: '3px 10px',
                            fontSize: 11, color, fontWeight: 'bold', letterSpacing: 1,
                        }}>
                            {CLASS_EMOJI[champion.class]} {champion.class.toUpperCase()}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div style={{
                    background: '#0a0a12',
                    border: '1px solid #2a2a3a',
                    borderRadius: 6,
                    padding: '12px 14px',
                    marginBottom: 16,
                }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, color: '#555', marginBottom: 8 }}>STATISTICS</div>
                    <StatBar label="STRENGTH"  value={champion.strength}  color="#e74c3c" />
                    <StatBar label="DEXTERITY" value={champion.dexterity} color="#2ecc71" />
                    <StatBar label="WISDOM"    value={champion.wisdom}    color="#9b59b6" />
                    <StatBar label="VITALITY"  value={champion.vitality}  color="#3498db" />
                    <StatBar label="HEALTH"    value={champion.health}    max={500} color="#e67e22" />
                    {champion.mana > 0 && (
                        <StatBar label="MANA" value={champion.mana} max={500} color="#8e44ad" />
                    )}
                </div>

                {/* Reincarnate / Dismiss button */}
                <button
                    onClick={() => {
                        if (isInParty) {
                            removeFromParty(champion.id);
                        } else if (!partyFull) {
                            addToParty(champion);
                        }
                    }}
                    disabled={!isInParty && partyFull}
                    style={{
                        width: '100%',
                        padding: '11px 0',
                        background: isInParty
                            ? 'linear-gradient(135deg, #6a1010, #8b0000)'
                            : partyFull
                                ? '#1a1a1a'
                                : `linear-gradient(135deg, ${color}99, ${color}55)`,
                        border: `1px solid ${isInParty ? '#c0392b' : partyFull ? '#333' : color}`,
                        borderRadius: 6,
                        color: partyFull && !isInParty ? '#444' : '#fff',
                        fontSize: 13, fontWeight: 'bold',
                        letterSpacing: 2,
                        cursor: partyFull && !isInParty ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: '"Courier New", monospace',
                        marginBottom: 14,
                        boxShadow: isInParty ? '0 0 12px #c0392b44' : `0 0 12px ${color}33`,
                    }}
                >
                    {isInParty
                        ? '💀 RENVOYER'
                        : partyFull
                            ? 'ÉQUIPE COMPLÈTE'
                            : '⚡ RÉINCARNER'}
                </button>

                {/* Party slots */}
                <div style={{ borderTop: '1px solid #2a2a3a', paddingTop: 12 }}>
                    <div style={{ fontSize: 10, letterSpacing: 3, color: '#555', marginBottom: 8 }}>
                        ÉQUIPE — {party.length}/{MAX_PARTY}
                        {party.length === MAX_PARTY && (
                            <span style={{ color: '#c8973a', marginLeft: 8 }}>✦ COMPLÈTE</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {Array.from({ length: MAX_PARTY }).map((_, i) => (
                            <PartySlotMini
                                key={i}
                                champion={party[i]}
                                onRemove={() => party[i] && removeFromParty(party[i].id)}
                            />
                        ))}
                    </div>
                    {party.length < MAX_PARTY && (
                        <div style={{ fontSize: 10, color: '#555', marginTop: 6, fontStyle: 'italic' }}>
                            Sélectionnez {MAX_PARTY - party.length} champion(s) supplémentaire(s) pour déverrouiller la porte
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
