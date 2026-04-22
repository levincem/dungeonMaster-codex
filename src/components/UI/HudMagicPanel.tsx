import React, { useEffect } from 'react';
import { RUNES_BY_FAMILY, RUNES_BY_ID } from '../../data/runes';
import { runesPath } from '../../data/assetPaths';
import { getTranslations, type Translations } from '../../i18n';

const RUNE_FAMILIES = ['power', 'element', 'form', 'alignment'] as const;
const runeText = getTranslations().runePanel;

function getRuneImagePath(runeId: string): string {
    return runesPath(`${runeId}.png`);
}

const RuneBtn: React.FC<{
    runeId: string;
    selected: boolean;
    onClick: () => void;
}> = ({ runeId, selected, onClick }) => {
    const rune = RUNES_BY_ID[runeId];
    const auraColor = selected ? 'rgba(182,130,255,0.34)' : 'rgba(140,110,220,0.14)';

    return (
        <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            title={rune?.name}
            style={{
                flex: '1 1 0',
                aspectRatio: '1',
                padding: 1,
                background: 'rgba(0,0,0,0.94)',
                border: `1px solid ${selected ? 'rgba(240,196,96,0.95)' : 'rgba(212,184,112,0.72)'}`,
                borderRadius: 3,
                cursor: 'pointer',
                outline: selected ? '2px solid rgba(255,160,32,0.72)' : 'none',
                outlineOffset: 1,
                transition: 'background 0.1s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                minWidth: 0,
                boxShadow: selected ? '0 0 10px rgba(255,170,48,0.55), inset 0 0 10px rgba(255,196,96,0.18)' : undefined,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {selected && (
                <>
                    <span
                        style={{
                            position: 'absolute',
                            inset: '6% 12%',
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${auraColor} 0%, rgba(166,120,255,0.14) 42%, rgba(166,120,255,0) 74%)`,
                            filter: 'blur(5px)',
                            opacity: 0.95,
                            pointerEvents: 'none',
                        }}
                        className="rune-arcane-aura"
                    />
                    <span
                        style={{
                            position: 'absolute',
                            inset: '18% 22%',
                            borderRadius: '50%',
                            border: '1px solid rgba(198,164,255,0.34)',
                            boxShadow: '0 0 10px rgba(176,120,255,0.22)',
                            opacity: 0.8,
                            pointerEvents: 'none',
                        }}
                        className="rune-arcane-ring"
                    />
                </>
            )}
            <img
                src={getRuneImagePath(runeId)}
                alt={rune?.name}
                style={{ width: '82%', height: '82%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
                draggable={false}
            />
            <span
                style={{
                    fontSize: 9,
                    letterSpacing: 1,
                    color: selected ? '#f0c870' : 'rgba(212,184,112,0.8)',
                    fontFamily: 'monospace',
                    lineHeight: 1,
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {rune?.name?.toUpperCase()}
            </span>
        </button>
    );
};

export const HudMagicPanel: React.FC<{
    panelStyle: React.CSSProperties;
    text: Translations['hud'];
    party: Array<{ id: number; name?: string } | undefined>;
    activeCasterChampionId: number | null;
    activeCasterMana?: number;
    activeCasterCooldown?: number;
    selectedRunes: string[];
    currentFamilyIdx: number;
    spell?: { name?: string; manaCost: number } | null;
    canCast: boolean;
    lastCastResult?: { success: boolean; message: string } | null;
    onSelectCaster: (championId: number) => void;
    onTruncateRunes: (slotIndex: number) => void;
    onSelectRune: (runeId: string) => void;
    onCast: () => void;
    onClear: () => void;
}> = ({
    panelStyle,
    text,
    party,
    activeCasterChampionId,
    activeCasterMana,
    activeCasterCooldown,
    selectedRunes,
    currentFamilyIdx,
    spell,
    canCast,
    lastCastResult,
    onSelectCaster,
    onTruncateRunes,
    onSelectRune,
    onCast,
    onClear,
}) => {
    useEffect(() => {
        const runeIds = Object.keys(RUNES_BY_ID);
        const preloaders = runeIds.map((runeId) => {
            const img = new Image();
            img.src = getRuneImagePath(runeId);
            return img;
        });
        return () => {
            preloaders.forEach((img) => {
                img.src = '';
            });
        };
    }, []);

    const currentFamily = RUNE_FAMILIES[currentFamilyIdx] ?? RUNE_FAMILIES[0];
    const activeCaster = party.find((champion) => champion?.id === activeCasterChampionId);
    const casterStatus = activeCaster
        ? [
            activeCasterMana !== undefined ? `${Math.floor(activeCasterMana)} ${text.manaUnit}` : null,
            activeCasterCooldown && activeCasterCooldown > 0 ? `${activeCasterCooldown.toFixed(1)}s` : null,
        ].filter(Boolean).join(' · ')
        : '';

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'stretch', marginBottom: 6 }}>
                {party.map((champion, index) => {
                    const isSelected = champion?.id === activeCasterChampionId;
                    const shortName = champion?.name ? champion.name.slice(0, 2).toUpperCase() : '';
                    return (
                        <button
                            key={champion?.id ?? `slot-${index}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => champion && onSelectCaster(champion.id)}
                            title={champion ? text.selectActiveCaster(champion.name ?? '') : text.noSpellCaster}
                            disabled={!champion}
                            style={{
                                flex: isSelected ? '1 1 0' : '0 0 30px',
                                width: isSelected ? 'auto' : 30,
                                height: 30,
                                minWidth: 0,
                                padding: isSelected ? '4px 8px' : 0,
                                background: champion
                                    ? isSelected
                                        ? 'rgba(10,10,10,0.96)'
                                        : 'rgba(0,0,0,0.94)'
                                    : 'rgba(0,0,0,0.78)',
                                border: `1px solid ${champion
                                    ? isSelected
                                        ? 'rgba(240,196,96,0.9)'
                                        : 'rgba(212,184,112,0.62)'
                                    : 'rgba(212,184,112,0.18)'}`,
                                borderRadius: 4,
                                color: champion
                                    ? isSelected
                                        ? '#f0d060'
                                        : '#d8ba76'
                                    : 'rgba(212,184,112,0.2)',
                                fontSize: isSelected ? 11 : 9,
                                fontWeight: 'bold',
                                letterSpacing: isSelected ? 0.9 : 0.5,
                                cursor: champion ? 'pointer' : 'default',
                                boxShadow: isSelected ? 'inset 0 0 12px rgba(255,196,96,0.1)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isSelected ? 'space-between' : 'center',
                                gap: isSelected ? 8 : 0,
                                overflow: 'hidden',
                            }}
                        >
                            {isSelected ? (
                                <>
                                    <span
                                        style={{
                                            minWidth: 0,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {champion?.name?.toUpperCase() ?? text.noSpellCaster}
                                    </span>
                                    {casterStatus && (
                                        <span style={{ fontSize: 9, color: '#bda46a', whiteSpace: 'nowrap' }}>
                                            {casterStatus}
                                        </span>
                                    )}
                                </>
                            ) : shortName}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                {Array.from({ length: 4 }).map((_, i) => {
                    const runeId = selectedRunes[i];
                    const rune = runeId ? RUNES_BY_ID[runeId] : undefined;
                    return (
                        <div
                            key={i}
                            onMouseDown={(e) => {
                                if (runeId) e.preventDefault();
                            }}
                            onClick={() => runeId && onTruncateRunes(i)}
                            title={runeId ? runeText.removeRune(rune?.name ?? '') : runeText.slot(i + 1)}
                            style={{
                                flex: 1,
                                aspectRatio: '1 / 0.68',
                                background: 'rgba(0,0,0,0.94)',
                                border: `1px solid ${runeId ? 'rgba(240,196,96,0.95)' : 'rgba(212,184,112,0.58)'}`,
                                borderRadius: 4,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0,
                                cursor: runeId ? 'pointer' : 'default',
                                padding: 1,
                                boxShadow: runeId ? '0 0 10px rgba(255,160,32,0.42), inset 0 0 10px rgba(255,196,96,0.16)' : undefined,
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                        >
                            {runeId ? (
                                <>
                                    <span
                                        style={{
                                            position: 'absolute',
                                            inset: '8% 16%',
                                            borderRadius: '50%',
                                            background: 'radial-gradient(circle, rgba(176,120,255,0.34) 0%, rgba(166,112,255,0.14) 44%, rgba(166,112,255,0) 74%)',
                                            filter: 'blur(6px)',
                                            opacity: 0.95,
                                            pointerEvents: 'none',
                                        }}
                                        className="rune-arcane-aura"
                                    />
                                    <span
                                        style={{
                                            position: 'absolute',
                                            inset: '22% 28%',
                                            borderRadius: '50%',
                                            border: '1px solid rgba(196,158,255,0.3)',
                                            boxShadow: '0 0 10px rgba(164,116,255,0.18)',
                                            opacity: 0.75,
                                            pointerEvents: 'none',
                                        }}
                                        className="rune-arcane-ring"
                                    />
                                    <img
                                        src={getRuneImagePath(runeId)}
                                        alt=""
                                        style={{ width: '74%', height: '74%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
                                    />
                                    <span
                                        style={{
                                            fontSize: 6,
                                            color: '#f0c870',
                                            letterSpacing: 0.8,
                                            lineHeight: 1,
                                            textShadow: '0 0 6px rgba(255,160,32,0.42)',
                                            position: 'relative',
                                            zIndex: 1,
                                            marginTop: -2,
                                        }}
                                    >
                                        {rune?.name?.toUpperCase()}
                                    </span>
                                </>
                            ) : (
                                <span style={{ fontSize: 14, color: 'rgba(212,184,112,0.24)' }}>{i + 1}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {spell ? (
                        <div style={{ fontSize: 12, color: '#f0d060', fontWeight: 'bold', letterSpacing: 0.5 }}>
                            {spell.name}
                            <span style={{ color: '#d4b870', fontWeight: 'normal', fontSize: 10, marginLeft: 5 }}>
                                {spell.manaCost} {text.manaUnit}
                            </span>
                        </div>
                    ) : selectedRunes.length > 0 ? (
                        <div style={{ fontSize: 10, color: '#8a7650', fontStyle: 'italic' }}>{text.unknownCombination}</div>
                    ) : (
                        <div style={{ fontSize: 10, color: '#8a7650', fontStyle: 'italic' }}>{text.selectRunes}</div>
                    )}
                </div>
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onCast}
                    disabled={!canCast}
                    style={{
                        padding: '4px 9px',
                        background: canCast ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.82)',
                        border: `1px solid ${canCast ? 'rgba(212,184,112,0.82)' : 'rgba(212,184,112,0.28)'}`,
                        borderRadius: 4,
                        color: canCast ? '#f0d060' : 'rgba(212,184,112,0.34)',
                        fontSize: 11,
                        letterSpacing: 1,
                        cursor: canCast ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {'\u2726'} {text.cast}
                </button>
                <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onClear}
                    disabled={selectedRunes.length === 0}
                    title={runeText.clearSelection}
                    style={{
                        padding: '4px 7px',
                        background: selectedRunes.length > 0 ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.82)',
                        border: `1px solid ${selectedRunes.length > 0 ? 'rgba(212,184,112,0.72)' : 'rgba(212,184,112,0.22)'}`,
                        borderRadius: 4,
                        color: selectedRunes.length > 0 ? '#d8ba76' : 'rgba(212,184,112,0.34)',
                        fontSize: 11,
                        cursor: selectedRunes.length > 0 ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace',
                        boxShadow: selectedRunes.length > 0 ? 'inset 0 0 10px rgba(212,184,112,0.08)' : 'none',
                    }}
                >
                    {'\u2715'}
                </button>
            </div>

            <div style={{ fontSize: 9, letterSpacing: 2, marginBottom: 3, fontWeight: 'bold', color: '#e0b850' }}>
                {text.runeFamilyLabels[currentFamily]}
            </div>

            <div style={{ display: 'flex', gap: 1, background: 'rgba(0,0,0,0.9)', padding: 2, borderRadius: 5, border: '1px solid rgba(212,184,112,0.24)' }}>
                {RUNES_BY_FAMILY[currentFamily].map((rune) => (
                    <RuneBtn
                        key={rune.id}
                        runeId={rune.id}
                        selected={selectedRunes.includes(rune.id)}
                        onClick={() => onSelectRune(rune.id)}
                    />
                ))}
            </div>

            {lastCastResult && (
                <div
                    style={{
                        marginTop: 6,
                        padding: '5px 8px',
                        background: 'rgba(10,6,22,0.95)',
                        border: `1px solid ${lastCastResult.success ? 'rgba(220,190,60,0.4)' : 'rgba(200,60,60,0.4)'}`,
                        borderRadius: 4,
                        fontSize: 10,
                        color: lastCastResult.success ? '#f0d060' : '#e06060',
                        lineHeight: 1.5,
                    }}
                >
                    {lastCastResult.success ? '\u2726 ' : '\u2715 '}
                    {lastCastResult.message}
                </div>
            )}
        </div>
    );
};
