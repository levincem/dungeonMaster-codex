import React, { useState } from 'react';
import { CHAMPIONS } from '../../data/champions';
import type { Champion } from '../../data/champions';
import type { ChampionClass } from '../../data/champions';

const CLASS_COLORS: Record<ChampionClass, string> = {
    Fighter: '#c0392b',
    Ninja: '#27ae60',
    Wizard: '#8e44ad',
    Priest: '#2980b9',
};

const CLASS_ICONS: Record<ChampionClass, string> = {
    Fighter: '⚔️',
    Ninja: '🗡️',
    Wizard: '🔮',
    Priest: '✨',
};

interface HeroSelectionScreenProps {
    onComplete: (selected: Champion[]) => void;
}

const MAX_PARTY = 4;

const StatBar: React.FC<{ label: string; value: number; max?: number; color: string }> = ({
    label, value, max = 100, color,
}) => (
    <div style={{ marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginBottom: 2 }}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
        <div style={{ height: 5, background: '#2a2a2a', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
                height: '100%',
                width: `${(value / max) * 100}%`,
                background: color,
                borderRadius: 3,
                transition: 'width 0.3s',
            }} />
        </div>
    </div>
);

const ChampionPortrait: React.FC<{ champion: Champion; size?: number }> = ({ champion, size = 64 }) => {
    const initials = champion.name.split(' ').map(w => w[0]).join('').slice(0, 2);
    return (
        <div style={{
            width: size,
            height: size,
            borderRadius: 4,
            background: `radial-gradient(circle at 35% 35%, ${champion.color}cc, ${champion.color}44)`,
            border: `2px solid ${champion.color}88`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.28,
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '0 1px 4px #000',
            userSelect: 'none',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Stylized face pattern */}
            <div style={{ fontSize: size * 0.4, lineHeight: 1 }}>
                {['👤', '🧙', '🥷', '⛪'][['Fighter', 'Wizard', 'Ninja', 'Priest'].indexOf(champion.class)]}
            </div>
            <div style={{ fontSize: size * 0.18, marginTop: 2, opacity: 0.8 }}>{initials}</div>
        </div>
    );
};

const ChampionCard: React.FC<{
    champion: Champion;
    isSelected: boolean;
    onToggle: () => void;
    partyFull: boolean;
}> = ({ champion, isSelected, onToggle, partyFull }) => {
    const [hovered, setHovered] = useState(false);
    const classColor = CLASS_COLORS[champion.class];

    return (
        <div
            onClick={onToggle}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                background: isSelected
                    ? `linear-gradient(135deg, #1a1a2e, ${classColor}22)`
                    : hovered
                        ? '#1e1e2e'
                        : '#151520',
                border: isSelected
                    ? `2px solid ${classColor}`
                    : `2px solid ${hovered ? '#444' : '#2a2a2a'}`,
                borderRadius: 8,
                padding: '10px',
                cursor: (!isSelected && partyFull) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: (!isSelected && partyFull) ? 0.4 : 1,
                transform: hovered && (isSelected || !partyFull) ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isSelected ? `0 0 16px ${classColor}44` : 'none',
            }}
        >
            {/* Selection checkmark */}
            {isSelected && (
                <div style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: classColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 'bold',
                    color: '#fff',
                }}>✓</div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <ChampionPortrait champion={champion} size={56} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e0d5ba', fontWeight: 'bold', fontSize: 13, lineHeight: 1.2 }}>
                        {champion.name}
                    </div>
                    <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontStyle: 'italic' }}>
                        {champion.title}
                    </div>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: `${classColor}22`,
                        border: `1px solid ${classColor}66`,
                        borderRadius: 3,
                        padding: '1px 6px',
                        fontSize: 10,
                        color: classColor,
                        fontWeight: 'bold',
                    }}>
                        {CLASS_ICONS[champion.class]} {champion.class.toUpperCase()}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 8 }}>
                <StatBar label="STR" value={champion.strength} color="#e74c3c" />
                <StatBar label="DEX" value={champion.dexterity} color="#2ecc71" />
                <StatBar label="WIS" value={champion.wisdom} color="#9b59b6" />
                <StatBar label="VIT" value={champion.vitality} color="#3498db" />
                {champion.mana > 0 && (
                    <StatBar label="MANA" value={champion.mana} max={500} color="#8e44ad" />
                )}
            </div>

        </div>
    );
};

const PartySlot: React.FC<{ champion?: Champion; index: number; onRemove: () => void }> = ({
    champion, index, onRemove,
}) => (
    <div style={{
        width: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
    }}>
        <div
            onClick={champion ? onRemove : undefined}
            style={{
                width: 64,
                height: 64,
                borderRadius: 6,
                border: champion
                    ? `2px solid ${CLASS_COLORS[champion.class]}`
                    : '2px dashed #333',
                background: champion ? `${champion.color}22` : '#0d0d12',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: champion ? 'pointer' : 'default',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {champion ? (
                <>
                    <ChampionPortrait champion={champion} size={60} />
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(200,50,50,0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        opacity: 0,
                        transition: 'opacity 0.2s',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    >❌</div>
                </>
            ) : (
                <div style={{ color: '#333', fontSize: 24 }}>+</div>
            )}
        </div>
        <div style={{ fontSize: 10, color: '#555', textAlign: 'center', height: 16 }}>
            {champion ? champion.name.split(' ')[0] : `SLOT ${index + 1}`}
        </div>
    </div>
);

export const HeroSelectionScreen: React.FC<HeroSelectionScreenProps> = ({ onComplete }) => {
    const [selected, setSelected] = useState<Champion[]>([]);
    const [filter, setFilter] = useState<ChampionClass | 'ALL'>('ALL');

    const toggleChampion = (champion: Champion) => {
        setSelected(prev => {
            const alreadySelected = prev.find(c => c.id === champion.id);
            if (alreadySelected) return prev.filter(c => c.id !== champion.id);
            if (prev.length >= MAX_PARTY) return prev;
            return [...prev, champion];
        });
    };

    const filteredChampions = filter === 'ALL'
        ? CHAMPIONS
        : CHAMPIONS.filter(c => c.class === filter);

    const partyFull = selected.length >= MAX_PARTY;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(ellipse at center, #0d0d1a 0%, #000 100%)',
            color: '#e0d5ba',
            fontFamily: '"Courier New", Courier, monospace',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Animated scanlines overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* Header */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                textAlign: 'center',
                padding: '20px 0 12px',
                borderBottom: '1px solid #2a2a3a',
                background: 'linear-gradient(180deg, rgba(20,10,0,0.8), transparent)',
            }}>
                <div style={{ fontSize: 11, letterSpacing: 6, color: '#6a5430', marginBottom: 4 }}>
                    ✦ DUNGEON MASTER ✦
                </div>
                <h1 style={{
                    margin: 0,
                    fontSize: 28,
                    fontWeight: 'bold',
                    letterSpacing: 4,
                    color: '#c8973a',
                    textShadow: '0 0 20px #c8973a88, 0 0 40px #c8973a44',
                    fontFamily: '"Courier New", monospace',
                }}>
                    HALL OF CHAMPIONS
                </h1>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6, letterSpacing: 2 }}>
                    Choose your party of {MAX_PARTY} champions to enter the dungeon
                </div>
            </div>

            {/* Party Slots */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                borderBottom: '1px solid #1a1a2a',
                background: 'rgba(0,0,0,0.5)',
                flexShrink: 0,
            }}>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: 2, marginRight: 8 }}>PARTY:</div>
                {Array.from({ length: MAX_PARTY }).map((_, i) => (
                    <PartySlot
                        key={i}
                        champion={selected[i]}
                        index={i}
                        onRemove={() => {
                            const champ = selected[i];
                            if (champ) setSelected(prev => prev.filter(c => c.id !== champ.id));
                        }}
                    />
                ))}
                <button
                    onClick={() => selected.length === MAX_PARTY && onComplete(selected)}
                    disabled={selected.length < MAX_PARTY}
                    style={{
                        marginLeft: 20,
                        padding: '12px 28px',
                        background: selected.length === MAX_PARTY
                            ? 'linear-gradient(135deg, #c8973a, #a07020)'
                            : '#1a1a1a',
                        border: `2px solid ${selected.length === MAX_PARTY ? '#c8973a' : '#333'}`,
                        borderRadius: 6,
                        color: selected.length === MAX_PARTY ? '#fff' : '#444',
                        fontSize: 13,
                        fontWeight: 'bold',
                        cursor: selected.length === MAX_PARTY ? 'pointer' : 'not-allowed',
                        letterSpacing: 2,
                        transition: 'all 0.2s',
                        fontFamily: '"Courier New", monospace',
                        boxShadow: selected.length === MAX_PARTY ? '0 0 20px #c8973a44' : 'none',
                    }}
                >
                    ENTER DUNGEON ▶
                </button>
            </div>

            {/* Filter Tabs */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                gap: 4,
                padding: '8px 20px',
                flexShrink: 0,
                flexWrap: 'wrap',
            }}>
                {(['ALL', 'Fighter', 'Ninja', 'Wizard', 'Priest'] as const).map(cls => (
                    <button
                        key={cls}
                        onClick={() => setFilter(cls)}
                        style={{
                            padding: '4px 14px',
                            borderRadius: 4,
                            border: filter === cls
                                ? `1px solid ${cls === 'ALL' ? '#888' : CLASS_COLORS[cls as ChampionClass]}`
                                : '1px solid #2a2a2a',
                            background: filter === cls
                                ? cls === 'ALL' ? '#2a2a2a' : `${CLASS_COLORS[cls as ChampionClass]}22`
                                : 'transparent',
                            color: filter === cls
                                ? cls === 'ALL' ? '#ccc' : CLASS_COLORS[cls as ChampionClass]
                                : '#555',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontFamily: '"Courier New", monospace',
                            letterSpacing: 1,
                            transition: 'all 0.15s',
                        }}
                    >
                        {cls === 'ALL' ? 'ALL' : `${CLASS_ICONS[cls as ChampionClass]} ${cls}`}
                    </button>
                ))}
                <div style={{ marginLeft: 'auto', fontSize: 11, color: '#555', alignSelf: 'center' }}>
                    {selected.length}/{MAX_PARTY} selected
                </div>
            </div>

            {/* Champion Grid */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                flex: 1,
                overflowY: 'auto',
                padding: '8px 20px 20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 10,
                alignContent: 'start',
            }}>
                {filteredChampions.map(champion => (
                    <ChampionCard
                        key={champion.id}
                        champion={champion}
                        isSelected={!!selected.find(c => c.id === champion.id)}
                        onToggle={() => toggleChampion(champion)}
                        partyFull={partyFull}
                    />
                ))}
            </div>
        </div>
    );
};
