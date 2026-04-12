import React, { useState } from 'react';
import { useStore } from '../../engine/store';
import { RUNES_BY_FAMILY, RUNES_BY_ID, findSpell } from '../../data/runes';
import type { RuneFamily } from '../../data/runes';
import { useI18n } from '../../i18n';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_RUNES = 4;

const FAMILY_COLORS: Record<RuneFamily, string> = {
    power:     '#e0a020',  // gold
    element:   '#3ab8e0',  // cyan
    form:      '#8e44ad',  // purple
    alignment: '#27ae60',  // green
};

const EFFECT_ICONS: Record<string, string> = {
    light:     '☀',
    heal:      '♥',
    fireball:  '🔥',
    lightning: '⚡',
    poison:    '☠',
    shield:    '🛡',
    open:      '🔓',
    darkness:  '🌑',
    unknown:   '?',
};

// ─── Single rune button ───────────────────────────────────────────────────────
const RuneButton: React.FC<{
    runeId: string;
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
}> = ({ runeId, selected, disabled, onClick }) => {
    const rune = RUNES_BY_ID[runeId];
    const family = rune?.family ?? 'power';
    const color = FAMILY_COLORS[family];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={rune?.name ?? runeId}
            style={{
                width: 52,
                height: 52,
                padding: 2,
                background: selected ? `${color}18` : '#0a0a12',
                border: `1px solid ${selected ? color : color + '44'}`,
                borderRadius: 4,
                cursor: disabled ? 'default' : 'pointer',
                boxShadow: selected ? `0 0 14px ${color}99, inset 0 0 8px ${color}22` : 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                opacity: disabled ? 0.35 : 1,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <img
                src={`/runes/${runeId}.png`}
                alt={rune?.name ?? runeId}
                className={selected ? 'rune-fire' : undefined}
                style={{ width: 36, height: 36, objectFit: 'contain', imageRendering: 'auto' }}
                draggable={false}
            />
            <span style={{
                fontSize: 7,
                letterSpacing: 1,
                color: selected ? color : color + 'aa',
                fontFamily: 'monospace',
                lineHeight: 1,
            }}>
                {rune?.name?.toUpperCase() ?? runeId.toUpperCase()}
            </span>
        </button>
    );
};

// ─── Selected rune slot ───────────────────────────────────────────────────────
const RuneSlot: React.FC<{ runeId?: string; index: number; onRemove: () => void }> = ({
    runeId, index, onRemove,
}) => {
    const text = useI18n().runePanel;
    const rune = runeId ? RUNES_BY_ID[runeId] : undefined;
    const color = rune ? FAMILY_COLORS[rune.family] : '#333';

    return (
        <div
            onClick={runeId ? onRemove : undefined}
            title={runeId ? text.removeRune(rune?.name ?? runeId) : text.slot(index + 1)}
            style={{
                width: 48,
                height: 52,
                background: runeId ? `${color}18` : '#08080f',
                border: `1px solid ${runeId ? color : '#1e1e2e'}`,
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: runeId ? 'pointer' : 'default',
                transition: 'all 0.15s',
            }}
        >
            {runeId ? (
                <>
                    <img
                        src={`/runes/${runeId}.png`}
                        alt={rune?.name}
                        className="rune-fire"
                        style={{ width: 32, height: 32, objectFit: 'contain' }}
                    />
                    <span style={{ fontSize: 7, color, letterSpacing: 1, fontFamily: 'monospace' }}>
                        {rune?.name?.toUpperCase()}
                    </span>
                </>
            ) : (
                <span style={{ fontSize: 18, color: '#1e1e2e' }}>{index + 1}</span>
            )}
        </div>
    );
};

// ─── Main RunePanel ───────────────────────────────────────────────────────────
export const RunePanel: React.FC = () => {
    const text = useI18n().runePanel;
    const { party, selectedChampionIndex } = useStore();
    const [selectedRunes, setSelectedRunes] = useState<string[]>([]);
    const [lastResult, setLastResult] = useState<string | null>(null);

    const champion = party[selectedChampionIndex];
    const families: RuneFamily[] = ['power', 'element', 'form', 'alignment'];

    const toggleRune = (runeId: string) => {
        setLastResult(null);
        setSelectedRunes(prev => {
            if (prev.includes(runeId)) return prev.filter(r => r !== runeId);
            if (prev.length >= MAX_RUNES) return prev;
            return [...prev, runeId];
        });
    };

    const castSpell = () => {
        const spell = findSpell(selectedRunes);
        if (spell) {
            setLastResult(text.castResult(spell.name, spell.description));
        } else {
            setLastResult(text.unknownRuneCombinationResult);
        }
        // TODO: deduct mana, apply effect
    };

    const clearRunes = () => {
        setSelectedRunes([]);
        setLastResult(null);
    };

    const spell = findSpell(selectedRunes);

    return (
        <div style={{
            position: 'fixed',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 348,
            background: 'linear-gradient(160deg, #080810 0%, #0d0a18 100%)',
            border: '1px solid #2a1a4a',
            borderRadius: 8,
            boxShadow: '0 0 40px rgba(100,50,200,0.15), 0 8px 32px rgba(0,0,0,0.8)',
            padding: 12,
            fontFamily: '"Courier New", monospace',
            zIndex: 150,
            userSelect: 'none',
        }}>
            {/* Header */}
            <div style={{ fontSize: 9, letterSpacing: 4, color: '#4a2a8a', textAlign: 'center', marginBottom: 10 }}>
                ✦ {text.magic} ✦
            </div>

            {/* Champion info */}
            {champion && (
                <div style={{
                    fontSize: 10, color: '#6a5ab0', textAlign: 'center',
                    marginBottom: 8, letterSpacing: 1,
                }}>
                    {champion.name.toUpperCase()} &nbsp;·&nbsp; {text.mana}: {champion.mana}
                </div>
            )}

            {/* Spell bar — selected runes */}
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 }}>
                {Array.from({ length: MAX_RUNES }).map((_, i) => (
                    <RuneSlot
                        key={i}
                        runeId={selectedRunes[i]}
                        index={i}
                        onRemove={() => setSelectedRunes(prev => prev.filter((_, j) => j !== i))}
                    />
                ))}
            </div>

            {/* Matched spell name */}
            <div style={{
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
            }}>
                {spell ? (
                    <div style={{ fontSize: 11, color: '#c8a96e', letterSpacing: 1 }}>
                        {EFFECT_ICONS[spell.effect]} {spell.name}
                        <span style={{ color: '#555', marginLeft: 8, fontSize: 9 }}>({spell.manaCost} mana)</span>
                    </div>
                ) : selectedRunes.length > 0 ? (
                    <div style={{ fontSize: 9, color: '#443344', fontStyle: 'italic' }}>
                        {text.unknownCombination}
                    </div>
                ) : null}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #1a1028', marginBottom: 10 }} />

            {/* Rune grid — 4 rows × 6 columns */}
            {families.map(family => (
                <div key={family} style={{ marginBottom: 8 }}>
                    <div style={{
                        fontSize: 7,
                        letterSpacing: 2,
                        color: FAMILY_COLORS[family] + '88',
                        marginBottom: 4,
                    }}>
                        {text.familyLabels[family]}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {RUNES_BY_FAMILY[family].map(rune => (
                            <RuneButton
                                key={rune.id}
                                runeId={rune.id}
                                selected={selectedRunes.includes(rune.id)}
                                disabled={
                                    !selectedRunes.includes(rune.id) &&
                                    selectedRunes.length >= MAX_RUNES
                                }
                                onClick={() => toggleRune(rune.id)}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {/* Divider */}
            <div style={{ borderTop: '1px solid #1a1028', marginTop: 6, marginBottom: 8 }} />

            {/* Cast / Clear buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
                <button
                    onClick={castSpell}
                    disabled={selectedRunes.length === 0}
                    style={{
                        flex: 1,
                        padding: '7px 0',
                        background: spell
                            ? 'linear-gradient(135deg, #2a0a5a, #5a1aaa)'
                            : '#100c1a',
                        border: `1px solid ${spell ? '#8a44cc' : '#2a1a4a'}`,
                        borderRadius: 4,
                        color: spell ? '#c8a9f0' : '#3a2a5a',
                        fontSize: 10,
                        letterSpacing: 2,
                        cursor: selectedRunes.length > 0 ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace',
                        boxShadow: spell ? '0 0 12px #8a44cc44' : 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    ✦ {text.cast}
                </button>
                <button
                    onClick={clearRunes}
                    disabled={selectedRunes.length === 0}
                    style={{
                        padding: '7px 14px',
                        background: '#0a0810',
                        border: '1px solid #1e1a28',
                        borderRadius: 4,
                        color: selectedRunes.length > 0 ? '#554466' : '#2a2030',
                        fontSize: 10,
                        letterSpacing: 1,
                        cursor: selectedRunes.length > 0 ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Feedback message */}
            {lastResult && (
                <div style={{
                    marginTop: 8,
                    padding: '6px 10px',
                    background: '#0a0a10',
                    border: '1px solid #2a1a4a',
                    borderRadius: 4,
                    fontSize: 10,
                    color: '#a090c0',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                }}>
                    {lastResult}
                </div>
            )}
        </div>
    );
};
