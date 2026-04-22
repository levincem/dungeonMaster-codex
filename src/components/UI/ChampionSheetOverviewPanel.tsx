import React from 'react';
import type { Champion } from '../../data/champions';
import { MAX_FOOD, MAX_WATER } from '../../engine/store';
import { useI18n } from '../../i18n';
import type { HighlightStatKey } from './championStatHighlights';

const THEME = {
    panelBg: 'rgba(0,0,0,0.84)',
    panelBorder: '#7a5c20',
    gold: '#e0a830',
    creamDim: '#b0904a',
    red: '#d83030',
    blue: '#3080c8',
    yellow: '#d4a820',
    green: '#30b050',
    greenDim: '#7dc38e',
    electricBlue: '#39b6ff',
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
    attributeStatuses: Partial<Record<HighlightStatKey, 'levelUp' | 'penalty'>>;
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
    attributeStatuses,
}) => {
    const resolveAttributeColor = (stat: HighlightStatKey): string => {
        const status = attributeStatuses[stat];
        if (status === 'penalty') return THEME.red;
        if (status === 'levelUp') return THEME.electricBlue;
        return THEME.green;
    };

    const statRows = [
        { key: 'strength', label: text.statLabels.strength, value: effectiveStats.strength },
        { key: 'dexterity', label: text.statLabels.dexterity, value: effectiveStats.dexterity },
        { key: 'wisdom', label: text.statLabels.wisdom, value: effectiveStats.wisdom },
        { key: 'vitality', label: text.statLabels.vitality, value: effectiveStats.vitality },
        { key: 'luck', label: text.statLabels.luck, value: effectiveStats.luck },
        { key: 'antiMagic', label: text.statLabels.antiMagic, value: effectiveStats.antiMagic },
        { key: 'antiFire', label: text.statLabels.antiFire, value: effectiveStats.antiFire },
    ].map((stat) => ({
        ...stat,
        color: resolveAttributeColor(stat.key as HighlightStatKey),
        labelColor: attributeStatuses[stat.key as HighlightStatKey]
            ? resolveAttributeColor(stat.key as HighlightStatKey)
            : THEME.creamDim,
    }));

    const attributeBarBg = 'rgba(0,0,0,0.4)';
    const attributeTrackWidth = 50;
    const attributePanelBorder = `1px solid ${THEME.panelBorder}`;

    const getStatFillPercent = (value: number): number =>
        Math.max(0, Math.min(100, value));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch' }}>
            <div
                style={{
                    background: '#ffffff',
                    border: attributePanelBorder,
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

            <div style={{ background: THEME.panelBg, border: attributePanelBorder, borderRadius: 5, padding: '10px 12px' }}>
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

            <div style={{ background: THEME.panelBg, border: attributePanelBorder, borderRadius: 5, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, letterSpacing: 3, color: THEME.gold, marginBottom: 8 }}>{text.attributes}</div>
                {statRows.map((stat) => (
                    <div
                        key={stat.label}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                color: stat.labelColor,
                                textShadow: attributeStatuses[stat.key as HighlightStatKey]
                                    ? `0 0 8px ${stat.color}55`
                                    : undefined,
                            }}
                        >
                            {stat.label}
                        </span>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <div style={{ width: attributeTrackWidth, height: 3, background: attributeBarBg, borderRadius: 2, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${getStatFillPercent(stat.value)}%`,
                                        background: stat.color,
                                        borderRadius: 2,
                                        boxShadow: `0 0 8px ${stat.color}66`,
                                    }}
                                />
                            </div>
                            <span
                                style={{
                                    fontSize: 13,
                                    fontWeight: 'bold',
                                    color: stat.color,
                                    minWidth: 24,
                                    textAlign: 'right',
                                    textShadow: `0 0 8px ${stat.color}55`,
                                }}
                            >
                                {stat.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
