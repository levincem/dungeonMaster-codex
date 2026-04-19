import React from 'react';
import type { Champion } from '../../data/champions';
import { MAX_FOOD, MAX_WATER } from '../../engine/store';
import { useI18n } from '../../i18n';

const THEME = {
    panelBg: 'rgba(0,0,0,0.84)',
    panelBorder: '#7a5c20',
    gold: '#e0a830',
    creamDim: '#b0904a',
    red: '#d83030',
    blue: '#3080c8',
    yellow: '#d4a820',
} as const;

const VitalBar: React.FC<{
    label: string;
    value: number;
    max: number;
    color: string;
    frameColor?: string;
    displayValue?: string;
    displayMax?: string;
}> = ({ label, value, max, color, frameColor, displayValue, displayMax }) => {
    const safeMax = Math.max(0, max);
    const fillPercent = safeMax > 0 ? Math.max(0, Math.min(100, (value / safeMax) * 100)) : 0;

    return (
        <div style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 15, lineHeight: 1, color: THEME.creamDim, letterSpacing: 1, flex: 1 }}>{label}</span>
                <span style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                    {displayValue ?? Math.ceil(value)}
                    <span style={{ fontSize: 12, color: THEME.creamDim, fontWeight: 'normal' }}>/{displayMax ?? safeMax}</span>
                </span>
            </div>
            <div
                style={{
                    height: 9,
                    background: 'rgba(0,0,0,0.5)',
                    borderRadius: 4,
                    border: `1px solid ${frameColor ?? THEME.panelBorder}`,
                    overflow: 'hidden',
                    boxShadow: frameColor ? `0 0 0 1px ${frameColor}22` : undefined,
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${fillPercent}%`,
                        background: `linear-gradient(90deg, ${color}88, ${color})`,
                        borderRadius: 4,
                        transition: 'width 0.3s ease',
                        boxShadow: `0 0 5px ${color}55`,
                    }}
                />
            </div>
        </div>
    );
};

export const ChampionSheetOverviewPanel: React.FC<{
    champion: Champion;
    text: ReturnType<typeof useI18n>['championSheet'];
    hp: number;
    stamina: number;
    mana: number;
    food: number;
    water: number;
    effectiveMana: number;
    displayStaminaValue: string;
    displayStaminaMax: string;
    foodFrame?: string;
    waterFrame?: string;
    effectiveStats: {
        strength: number;
        dexterity: number;
        wisdom: number;
        vitality: number;
        luck: number;
        antiMagic: number;
        antiFire: number;
    };
}> = ({
    champion,
    text,
    hp,
    stamina,
    mana,
    food,
    water,
    effectiveMana,
    displayStaminaValue,
    displayStaminaMax,
    foodFrame,
    waterFrame,
    effectiveStats,
}) => {
    const statRows = [
        { label: text.statLabels.strength, value: effectiveStats.strength, color: THEME.red },
        { label: text.statLabels.dexterity, value: effectiveStats.dexterity, color: '#30b050' },
        { label: text.statLabels.wisdom, value: effectiveStats.wisdom, color: THEME.blue },
        { label: text.statLabels.vitality, value: effectiveStats.vitality, color: THEME.yellow },
        { label: text.statLabels.luck, value: effectiveStats.luck, color: THEME.gold },
        { label: text.statLabels.antiMagic, value: effectiveStats.antiMagic, color: '#60c0a0' },
        { label: text.statLabels.antiFire, value: effectiveStats.antiFire, color: '#d08030' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch' }}>
            <div
                style={{
                    background: '#ffffff',
                    border: `1px solid ${THEME.panelBorder}`,
                    borderRadius: 5,
                    overflow: 'hidden',
                    minHeight: 198,
                    height: 198,
                    flex: '0 0 auto',
                }}
            >
                <img
                    src={champion.portrait}
                    alt={champion.name}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top center',
                        display: 'block',
                    }}
                />
            </div>

            <div style={{ background: THEME.panelBg, border: `1px solid ${THEME.panelBorder}`, borderRadius: 5, padding: '10px 12px' }}>
                <VitalBar label={text.health} value={hp} max={champion.health} color={THEME.red} />
                <VitalBar
                    label={text.stamina}
                    value={stamina}
                    max={champion.stamina}
                    color={THEME.yellow}
                    displayValue={displayStaminaValue}
                    displayMax={displayStaminaMax}
                />
                <VitalBar label={text.hunger} value={food} max={MAX_FOOD} color="#d88b2d" frameColor={foodFrame} />
                <VitalBar label={text.thirst} value={water} max={MAX_WATER} color="#3aa0d8" frameColor={waterFrame} />
                <VitalBar label={text.mana} value={mana} max={effectiveMana} color={THEME.blue} />
            </div>

            <div style={{ background: THEME.panelBg, border: `1px solid ${THEME.panelBorder}`, borderRadius: 5, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: THEME.gold, marginBottom: 8 }}>{text.attributes}</div>
                {statRows.map((stat) => (
                    <div
                        key={stat.label}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}
                    >
                        <span style={{ fontSize: 12, color: THEME.creamDim }}>{stat.label}</span>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <div style={{ width: 50, height: 3, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${Math.max(0, Math.min(100, stat.value))}%`,
                                        background: stat.color,
                                        borderRadius: 2,
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 'bold', color: stat.color, minWidth: 24, textAlign: 'right' }}>
                                {stat.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
