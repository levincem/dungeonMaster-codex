import React from 'react';
import type { Champion } from '../../data/champions';
import { canEquipItemInSlot } from '../../data/equipment';
import { miscPath } from '../../data/assetPaths';
import { getEquippedItemImage } from '../../data/itemImages';
import type { ChampionVitals } from '../../engine/runtimeTypes';
import { useStore } from '../../engine/store';
import { getTranslations } from '../../i18n';
import type { ChampionEquipment } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import { getDragPayload, setDragPayload } from './dragPayload';

const HUD_CLASS_COLORS: Record<string, string> = {
    Fighter: '#e05040',
    Ninja: '#40cc70',
    Wizard: '#a060e0',
    Priest: '#4090e0',
};

const EMPTY_HAND_IMAGES = {
    leftHand: miscPath('handLeft.png'),
    rightHand: miscPath('handRight.png'),
} as const;
const HUD_TEXT = getTranslations().hud;
const LEVEL_UP_PARTICLES = [
    { x: '-42px', y: '-34px', delay: '0s', size: 5, hue: '#fff1a8' },
    { x: '-28px', y: '-48px', delay: '0.08s', size: 4, hue: '#ffd36a' },
    { x: '-10px', y: '-56px', delay: '0.16s', size: 6, hue: '#ffb347' },
    { x: '14px', y: '-52px', delay: '0.04s', size: 5, hue: '#ffcf66' },
    { x: '30px', y: '-44px', delay: '0.12s', size: 4, hue: '#ff9952' },
    { x: '44px', y: '-26px', delay: '0.18s', size: 6, hue: '#ffe59a' },
    { x: '36px', y: '-4px', delay: '0.02s', size: 4, hue: '#ffc16b' },
    { x: '22px', y: '12px', delay: '0.1s', size: 5, hue: '#ff9650' },
    { x: '4px', y: '18px', delay: '0.2s', size: 4, hue: '#ffd978' },
    { x: '-18px', y: '14px', delay: '0.06s', size: 5, hue: '#ffb85e' },
    { x: '-34px', y: '2px', delay: '0.14s', size: 4, hue: '#ffe8a5' },
    { x: '-46px', y: '-16px', delay: '0.22s', size: 5, hue: '#ff9b4a' },
] as const;
const LEVEL_UP_STYLE = `
@keyframes hud-levelup-ring {
    0% { transform: scale(0.8); opacity: 0; }
    18% { opacity: 0.88; }
    100% { transform: scale(1.16); opacity: 0; }
}
@keyframes hud-levelup-burst {
    0% { transform: translateY(10px) scale(0.74); opacity: 0; }
    16% { opacity: 1; }
    100% { transform: translateY(-14px) scale(1.04); opacity: 0; }
}
@keyframes hud-levelup-sheen {
    0% { transform: translateX(-125%) rotate(-18deg); opacity: 0; }
    20% { opacity: 0.12; }
    55% { opacity: 0.34; }
    100% { transform: translateX(165%) rotate(-18deg); opacity: 0; }
}
@keyframes hud-levelup-glow {
    0%, 100% { box-shadow: 0 0 0 1px rgba(255, 190, 92, 0.34), 0 0 20px rgba(255, 132, 48, 0.14); }
    50% { box-shadow: 0 0 0 2px rgba(255, 224, 136, 0.86), 0 0 34px rgba(255, 170, 64, 0.3); }
}
@keyframes hud-levelup-particle {
    0% {
        transform: translate(-50%, -50%) translate(0, 0) scale(0.32);
        opacity: 0;
    }
    12% {
        opacity: 1;
    }
    72% {
        opacity: 0.94;
    }
    100% {
        transform: translate(-50%, -50%) translate(var(--burst-x), var(--burst-y)) scale(1.08);
        opacity: 0;
    }
}
@keyframes hud-levelup-core {
    0% { transform: translate(-50%, -50%) scale(0.24); opacity: 0; }
    18% { opacity: 0.98; }
    100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
}
@keyframes hud-pickup-full-flash {
    0% { opacity: 0; transform: scale(0.96); }
    16% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.02); }
}
`;

function getPortraitStyle(size: number): React.CSSProperties {
    return {
        width: size,
        height: size,
        objectFit: 'cover',
        objectPosition: 'top center',
        flexShrink: 0,
        borderRadius: 3,
    };
}

const FormationSilhouette: React.FC<{
    champion: Champion | undefined;
    slotIndex: number;
    isDragOver: boolean;
    onDragStart: () => void;
    onDragOver: (event: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: () => void;
}> = ({ champion, slotIndex, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) => {
    const color = champion ? HUD_CLASS_COLORS[champion.class] : '#d4b870';

    return (
        <div
            draggable={!!champion}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            title={champion ? HUD_TEXT.party.formationPosition(champion.name, slotIndex + 1) : HUD_TEXT.party.position(slotIndex + 1)}
            style={{
                width: 52,
                height: 52,
                borderRadius: 8,
                border: `2px solid ${isDragOver ? '#f0d060' : champion ? color : 'rgba(212,184,112,0.34)'}`,
                background: isDragOver ? 'rgba(240,208,96,0.12)' : 'rgba(0,0,0,0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: champion ? 'grab' : 'default',
                transition: 'border-color 0.12s, background 0.12s',
            }}
        >
            {champion ? (
                <svg viewBox="0 0 100 100" width="34" height="34" aria-hidden="true">
                    <circle cx="50" cy="24" r="12" fill={color} opacity="0.95" />
                    <rect x="39" y="36" width="22" height="22" rx="9" fill={color} opacity="0.95" />
                    <rect x="24" y="41" width="18" height="10" rx="5" fill={color} opacity="0.75" />
                    <rect x="58" y="41" width="18" height="10" rx="5" fill={color} opacity="0.75" />
                    <rect x="41" y="58" width="8" height="23" rx="4" fill={color} opacity="0.8" />
                    <rect x="51" y="58" width="8" height="23" rx="4" fill={color} opacity="0.8" />
                </svg>
            ) : (
                <span style={{ fontSize: 12, color: 'rgba(212,184,112,0.22)', fontFamily: 'monospace' }} />
            )}
        </div>
    );
};

const HandSlot: React.FC<{
    championId: number;
    slotKey: 'leftHand' | 'rightHand';
    item?: ChampionEquipment['leftHand'];
    isDragOver?: boolean;
    floorDragActive?: boolean;
    onNativeItemDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
    onNativeItemDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
    onNativeItemDragLeave?: () => void;
    onFloorDrop?: () => void;
}> = ({
    championId,
    slotKey,
    item,
    isDragOver = false,
    floorDragActive = false,
    onNativeItemDragOver,
    onNativeItemDrop,
    onNativeItemDragLeave,
    onFloorDrop,
}) => {
    const torchBurnStart = useStore((state) => state.torchBurnStart);
    const paused = useStore((state) => state.paused);
    const pausedAt = useStore((state) => state.pausedAt ?? null);
    const imageNow = paused && typeof pausedAt === 'number' ? pausedAt : Date.now();
    const imageSrc = item ? getEquippedItemImage(item, torchBurnStart, imageNow) : null;
    const emptyHandImageSrc = !item ? EMPTY_HAND_IMAGES[slotKey] : null;

    return (
        <div
            onDragOver={onNativeItemDragOver}
            onDrop={onNativeItemDrop}
            onDragLeave={onNativeItemDragLeave}
            onMouseUp={onFloorDrop}
            style={{
                flex: 1,
                height: 36,
                border: `1px solid ${
                    isDragOver
                        ? 'rgba(240,208,96,0.95)'
                        : floorDragActive
                            ? 'rgba(212,184,112,0.78)'
                            : 'rgba(120,96,54,0.75)'
                }`,
                borderRadius: 4,
                background: isDragOver
                    ? 'rgba(52,40,14,0.94)'
                    : floorDragActive
                        ? 'rgba(32,24,10,0.94)'
                        : 'rgba(0,0,0,0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                transition: 'border-color 0.12s, background 0.12s',
            }}
            draggable={!!item}
            onDragStart={(event) => {
                if (!item) return;
                setDragPayload(event, { itemId: item.id, fromChampionId: championId, fromSlot: slotKey });
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: 2,
                    left: 4,
                    fontSize: 7,
                    lineHeight: 1,
                    letterSpacing: 1,
                    color: 'rgba(208,184,112,0.6)',
                }}
            >
                {HUD_TEXT.handSlotLabels[slotKey]}
            </span>
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    style={{
                        maxWidth: '82%',
                        maxHeight: '82%',
                        objectFit: 'contain',
                        imageRendering: 'crisp-edges',
                    }}
                />
            ) : (
                <>
                    {emptyHandImageSrc && (
                        <img
                            src={emptyHandImageSrc}
                            alt=""
                            draggable={false}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                opacity: 0.18,
                                imageRendering: 'crisp-edges',
                                pointerEvents: 'none',
                                transform: slotKey === 'leftHand' ? 'translateX(-3px)' : 'translateX(3px)',
                            }}
                        />
                    )}
                    <div
                        style={{
                            width: '68%',
                            height: '68%',
                            borderRadius: 3,
                            border: '1px dashed rgba(212,184,112,0.34)',
                            background: 'rgba(255,255,255,0.02)',
                            position: 'relative',
                            zIndex: 1,
                        }}
                    />
                </>
            )}
        </div>
    );
};

const VitalsStrip: React.FC<{
    hp: number;
    maxHp: number;
    sta: number;
    maxSta: number;
    mana: number;
    maxMana: number;
}> = ({ hp, maxHp, sta, maxSta, mana, maxMana }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '5px 4px', background: '#060408' }}>
        {([
            { val: hp, max: maxHp, color: '#c0251a' },
            { val: sta, max: maxSta, color: '#1e9940' },
            { val: mana, max: maxMana, color: '#1a6ec0' },
        ] as const).map(({ val, max, color }, index) => (
            <div
                key={index}
                style={{
                    height: 6,
                    background: '#1a1220',
                    borderRadius: 2,
                    border: '1px solid transparent',
                    boxSizing: 'border-box',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: max > 0 ? `${Math.max(0, Math.min(100, (val / max) * 100))}%` : '0%',
                        background: color,
                        borderRadius: 2,
                        transition: 'width 0.4s linear',
                    }}
                />
            </div>
        ))}
    </div>
);

const ChampionCard: React.FC<{
    champion: Champion | undefined;
    vitals: ChampionVitals | undefined;
    equip: ChampionEquipment;
    recentDamage: number[];
    levelUp: boolean;
    inventoryFullFlash: boolean;
    slotIndex: number;
    selected: boolean;
    isDragOver: boolean;
    floorDragActive: boolean;
    leftHandDragOver: boolean;
    rightHandDragOver: boolean;
    onSelect: () => void;
    onOpenSheet: () => void;
    onNativeItemDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onNativeItemDrop: (event: React.DragEvent<HTMLDivElement>) => void;
    onNativeItemDragLeave: () => void;
    onFloorDrop: () => void;
    onHandNativeItemDragOver: (slotKey: 'leftHand' | 'rightHand', event: React.DragEvent<HTMLDivElement>) => void;
    onHandNativeItemDrop: (slotKey: 'leftHand' | 'rightHand', event: React.DragEvent<HTMLDivElement>) => void;
    onHandNativeItemDragLeave: (slotKey: 'leftHand' | 'rightHand') => void;
    onHandFloorDrop: (slotKey: 'leftHand' | 'rightHand') => void;
}> = ({
    champion,
    vitals,
    equip,
    recentDamage,
    levelUp,
    inventoryFullFlash,
    slotIndex,
    selected,
    isDragOver,
    floorDragActive,
    leftHandDragOver,
    rightHandDragOver,
    onSelect,
    onOpenSheet,
    onNativeItemDragOver,
    onNativeItemDrop,
    onNativeItemDragLeave,
    onFloorDrop,
    onHandNativeItemDragOver,
    onHandNativeItemDrop,
    onHandNativeItemDragLeave,
    onHandFloorDrop,
}) => {
    const width = 92;
    const portraitHeight = 55;
    const color = champion ? HUD_CLASS_COLORS[champion.class] : '#d4b870';

    return (
        <div
            onClick={() => champion && (selected ? onOpenSheet() : onSelect())}
            onDragOver={champion ? onNativeItemDragOver : undefined}
            onDrop={champion ? onNativeItemDrop : undefined}
            onDragLeave={champion ? onNativeItemDragLeave : undefined}
            onMouseUp={champion ? onFloorDrop : undefined}
            title={
                champion
                    ? (selected ? HUD_TEXT.party.openSheet(champion.name) : HUD_TEXT.party.selectChampion(champion.name))
                    : HUD_TEXT.party.slot(slotIndex + 1)
            }
            style={{
                width,
                border: `2px solid ${
                    isDragOver
                        ? '#f0d060'
                        : floorDragActive && champion
                            ? '#dcb35d'
                            : selected
                                ? color
                                : champion
                                    ? `${color}77`
                                    : 'rgba(212,184,112,0.24)'
                }`,
                borderRadius: 5,
                overflow: 'hidden',
                cursor: champion ? 'pointer' : 'default',
                background: isDragOver
                    ? 'rgba(240,208,80,0.15)'
                    : floorDragActive && champion
                        ? 'rgba(212,184,112,0.1)'
                        : selected
                            ? `${color}22`
                            : '#050505',
                outline: selected ? `3px solid ${color}55` : 'none',
                outlineOffset: 2,
                transition: 'border-color 0.15s',
                userSelect: 'none',
                animation: levelUp ? 'hud-levelup-glow 0.9s ease-in-out infinite' : undefined,
            }}
        >
            {champion ? (
                <>
                    <div
                        style={{
                            height: portraitHeight,
                            overflow: 'hidden',
                            display: 'flex',
                            justifyContent: 'center',
                            position: 'relative',
                        }}
                    >
                        <img src={champion.portrait} alt={champion.name} style={getPortraitStyle(width)} />
                        {levelUp && (
                            <>
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        pointerEvents: 'none',
                                        overflow: 'visible',
                                    }}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: '50%',
                                            top: '54%',
                                            width: 18,
                                            height: 18,
                                            borderRadius: '50%',
                                            background: 'radial-gradient(circle, rgba(255,246,182,0.98) 0%, rgba(255,186,84,0.92) 40%, rgba(255,120,38,0.12) 78%, rgba(255,120,38,0) 100%)',
                                            filter: 'blur(0.5px)',
                                            animation: 'hud-levelup-core 0.82s ease-out infinite',
                                        }}
                                    />
                                    {LEVEL_UP_PARTICLES.map((particle, index) => (
                                        <span
                                            key={`${champion.id}_levelup_particle_${index}`}
                                            style={{
                                                position: 'absolute',
                                                left: '50%',
                                                top: '54%',
                                                width: particle.size,
                                                height: particle.size,
                                                marginLeft: -(particle.size / 2),
                                                marginTop: -(particle.size / 2),
                                                borderRadius: '50%',
                                                background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, ${particle.hue} 42%, rgba(255,140,48,0.12) 78%, rgba(255,140,48,0) 100%)`,
                                                boxShadow: `0 0 10px ${particle.hue}, 0 0 18px rgba(255,144,44,0.34)`,
                                                ['--burst-x' as string]: particle.x,
                                                ['--burst-y' as string]: particle.y,
                                                animation: `hud-levelup-particle 0.92s cubic-bezier(0.18, 0.72, 0.24, 1) ${particle.delay} infinite`,
                                            }}
                                        />
                                    ))}
                                </div>
                                <div
                                    style={{
                                        position: 'absolute',
                                        inset: 4,
                                        borderRadius: 6,
                                        border: '2px solid rgba(255,206,116,0.84)',
                                        animation: 'hud-levelup-ring 0.92s ease-out infinite',
                                        pointerEvents: 'none',
                                    }}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: -2,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        background: 'linear-gradient(180deg, rgba(255,245,188,0.98), rgba(255,182,72,0.98) 58%, rgba(231,96,28,0.98))',
                                        border: '1px solid rgba(84,38,0,0.72)',
                                        color: '#3b2104',
                                        fontSize: 9,
                                        fontWeight: 900,
                                        letterSpacing: 1.1,
                                        textTransform: 'uppercase',
                                        animation: 'hud-levelup-burst 1.1s ease-out infinite',
                                        boxShadow: '0 6px 16px rgba(0,0,0,0.42)',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {HUD_TEXT.party.levelUp}
                                </div>
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: -12,
                                        bottom: -12,
                                        width: 28,
                                        background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,248,210,0.95), rgba(255,255,255,0))',
                                        filter: 'blur(1px)',
                                        animation: 'hud-levelup-sheen 1.4s linear infinite',
                                        pointerEvents: 'none',
                                    }}
                                />
                            </>
                        )}
                        {recentDamage.map((amount, index) => (
                            <div
                                key={`${champion.id}_hurt_${index}_${amount}`}
                                style={{
                                    position: 'absolute',
                                    right: 4,
                                    top: 4 + (index * 16),
                                    minWidth: 26,
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    background: 'rgba(120,16,12,0.94)',
                                    border: '1px solid rgba(255,166,118,0.88)',
                                    color: '#fff4dd',
                                    fontSize: 11 + Math.min(5, amount * 0.15),
                                    fontWeight: 'bold',
                                    lineHeight: 1.1,
                                    textAlign: 'center',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
                                    pointerEvents: 'none',
                                }}
                            >
                                -{amount}
                            </div>
                        ))}
                        {inventoryFullFlash && (
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(180deg, rgba(120,10,10,0.12), rgba(168,12,12,0.34) 45%, rgba(86,4,4,0.2))',
                                    animation: 'hud-pickup-full-flash 0.52s ease-out 1',
                                    pointerEvents: 'none',
                                }}
                            >
                                <span
                                    style={{
                                        padding: '3px 10px',
                                        borderRadius: 999,
                                        background: 'rgba(86,6,6,0.94)',
                                        border: '1px solid rgba(255,186,186,0.82)',
                                        boxShadow: '0 4px 14px rgba(0,0,0,0.42)',
                                        color: '#fff1e8',
                                        fontSize: 10,
                                        fontWeight: 900,
                                        letterSpacing: 1.2,
                                    }}
                                >
                                    FULL
                                </span>
                            </div>
                        )}
                    </div>
                    {vitals ? (
                        <VitalsStrip
                            hp={vitals.hp}
                            maxHp={champion.health}
                            sta={vitals.stamina}
                            maxSta={champion.stamina}
                            mana={vitals.mana}
                            maxMana={champion.mana}
                        />
                    ) : (
                        <div style={{ height: 34, background: '#050505' }} />
                    )}
                    <div
                        style={{
                            textAlign: 'center',
                            fontSize: 9,
                            letterSpacing: 0.5,
                            color: selected ? color : '#887060',
                            padding: '2px 0',
                            background: '#050505',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {champion.name.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', gap: 4, padding: 4, background: '#050505' }}>
                        <HandSlot
                            championId={champion.id}
                            slotKey="leftHand"
                            item={equip.leftHand}
                            isDragOver={leftHandDragOver}
                            floorDragActive={floorDragActive}
                            onNativeItemDragOver={(event) => onHandNativeItemDragOver('leftHand', event)}
                            onNativeItemDrop={(event) => onHandNativeItemDrop('leftHand', event)}
                            onNativeItemDragLeave={() => onHandNativeItemDragLeave('leftHand')}
                            onFloorDrop={() => onHandFloorDrop('leftHand')}
                        />
                        <HandSlot
                            championId={champion.id}
                            slotKey="rightHand"
                            item={equip.rightHand}
                            isDragOver={rightHandDragOver}
                            floorDragActive={floorDragActive}
                            onNativeItemDragOver={(event) => onHandNativeItemDragOver('rightHand', event)}
                            onNativeItemDrop={(event) => onHandNativeItemDrop('rightHand', event)}
                            onNativeItemDragLeave={() => onHandNativeItemDragLeave('rightHand')}
                            onFloorDrop={() => onHandFloorDrop('rightHand')}
                        />
                    </div>
                </>
            ) : (
                <div
                    style={{
                        height: portraitHeight + 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(212,184,112,0.18)',
                        fontSize: 18,
                    }}
                />
            )}
        </div>
    );
};

type ActiveFloorDrag = { itemId: string; pointerX: number; pointerY: number } | null;

export const HudPartyPanel: React.FC<{
    panelStyle: React.CSSProperties;
    party: Champion[];
    championVitals: Record<number, ChampionVitals>;
    championEquipment: Record<number, ChampionEquipment>;
    recentDamageByChampionId: Record<number, number[]>;
    levelUpChampionIds: number[];
    inventoryFullFeedback: { championId: number; ts: number } | null;
    selectedChampionIndex: number;
    activeFloorDrag: ActiveFloorDrag;
    dragFrom: number | null;
    dragOver: number | null;
    itemDropOver: number | null;
    handDropOver: string | null;
    setDragFrom: React.Dispatch<React.SetStateAction<number | null>>;
    setDragOver: React.Dispatch<React.SetStateAction<number | null>>;
    setItemDropOver: React.Dispatch<React.SetStateAction<number | null>>;
    setHandDropOver: React.Dispatch<React.SetStateAction<string | null>>;
    selectChampion: (index: number) => void;
    openPartyMember: (championId: number) => void;
    reorderParty: (from: number, to: number) => void;
    pickupItemToChampion: (itemId: string, championId: number) => boolean;
    endFloorDrag: () => void;
    giveItem: (fromChampionId: number, toChampionId: number, itemId: string) => void;
    giveEquippedItem: (fromChampionId: number, fromSlot: EquipSlotKey, toChampionId: number) => void;
    equipItem: (championId: number, slotKey: EquipSlotKey, itemId: string) => void;
}> = ({
    panelStyle,
    party,
    championVitals,
    championEquipment,
    recentDamageByChampionId,
    levelUpChampionIds,
    inventoryFullFeedback,
    selectedChampionIndex,
    activeFloorDrag,
    dragFrom,
    dragOver,
    itemDropOver,
    handDropOver,
    setDragFrom,
    setDragOver,
    setItemDropOver,
    setHandDropOver,
    selectChampion,
    openPartyMember,
    reorderParty,
    pickupItemToChampion,
    endFloorDrag,
    giveItem,
    giveEquippedItem,
    equipItem,
}) => {
    const [activeInventoryFullChampionId, setActiveInventoryFullChampionId] = React.useState<number | null>(null);
    const inventoryFullTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        if (!inventoryFullFeedback) return;
        setActiveInventoryFullChampionId(inventoryFullFeedback.championId);
        if (inventoryFullTimeoutRef.current) clearTimeout(inventoryFullTimeoutRef.current);
        inventoryFullTimeoutRef.current = setTimeout(() => {
            setActiveInventoryFullChampionId((current) =>
                current === inventoryFullFeedback.championId ? null : current,
            );
            inventoryFullTimeoutRef.current = null;
        }, Math.max(0, inventoryFullFeedback.ts - Date.now()));
        return () => {
            if (inventoryFullTimeoutRef.current) {
                clearTimeout(inventoryFullTimeoutRef.current);
                inventoryFullTimeoutRef.current = null;
            }
        };
    }, [inventoryFullFeedback]);

    return (
        <div style={panelStyle} data-tutorial-zone="party-panel">
            <style>{LEVEL_UP_STYLE}</style>
            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 80%', display: 'flex', gap: 4, minWidth: 0 }} data-tutorial-zone="party-portraits">
                    {[0, 1, 2, 3].map((index) => (
                        <div key={index} style={{ flex: '1 1 20%', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                            <ChampionCard
                                champion={party[index]}
                                vitals={party[index] ? championVitals[party[index].id] : undefined}
                                equip={party[index] ? (championEquipment[party[index].id] ?? {}) : {}}
                                recentDamage={party[index] ? (recentDamageByChampionId[party[index].id] ?? []) : []}
                                levelUp={party[index] ? levelUpChampionIds.includes(party[index].id) : false}
                                inventoryFullFlash={party[index] ? activeInventoryFullChampionId === party[index].id : false}
                                slotIndex={index}
                                selected={selectedChampionIndex === index && !!party[index]}
                                isDragOver={itemDropOver === index}
                                floorDragActive={activeFloorDrag !== null}
                                leftHandDragOver={handDropOver === `${party[index]?.id}_leftHand`}
                                rightHandDragOver={handDropOver === `${party[index]?.id}_rightHand`}
                                onSelect={() => selectChampion(index)}
                                onOpenSheet={() => party[index] && openPartyMember(party[index].id)}
                                onNativeItemDragOver={(event) => {
                                    if (!party[index]) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    event.dataTransfer.dropEffect = 'move';
                                    setItemDropOver(index);
                                }}
                                onNativeItemDragLeave={() => {
                                    setItemDropOver((current) => (current === index ? null : current));
                                }}
                                onNativeItemDrop={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setItemDropOver(null);
                                    const targetChampion = party[index];
                                    if (!targetChampion) return;
                                    const payload = getDragPayload(event);
                                    if (!payload) return;
                                    if (payload.fromSlot === 'container') return;
                                    if (payload.fromChampionId === targetChampion.id && payload.fromSlot !== 'inventory') return;
                                    if (payload.fromSlot === 'inventory') {
                                        giveItem(payload.fromChampionId, targetChampion.id, payload.itemId);
                                        return;
                                    }
                                    giveEquippedItem(payload.fromChampionId, payload.fromSlot as EquipSlotKey, targetChampion.id);
                                }}
                                onFloorDrop={() => {
                                    const targetChampion = party[index];
                                    if (!activeFloorDrag || !targetChampion) return;
                                    const pickedUp = pickupItemToChampion(activeFloorDrag.itemId, targetChampion.id);
                                    if (pickedUp) endFloorDrag();
                                }}
                                onHandNativeItemDragOver={(slotKey, event) => {
                                    const targetChampion = party[index];
                                    if (!targetChampion) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    event.dataTransfer.dropEffect = 'move';
                                    setItemDropOver(null);
                                    setHandDropOver(`${targetChampion.id}_${slotKey}`);
                                }}
                                onHandNativeItemDragLeave={(slotKey) => {
                                    const targetChampion = party[index];
                                    if (!targetChampion) return;
                                    const key = `${targetChampion.id}_${slotKey}`;
                                    setHandDropOver((current) => (current === key ? null : current));
                                }}
                                onHandNativeItemDrop={(slotKey, event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setItemDropOver(null);
                                    setHandDropOver(null);
                                    const targetChampion = party[index];
                                    if (!targetChampion) return;
                                    const payload = getDragPayload(event);
                                    if (!payload) return;
                                    if (payload.fromSlot === 'container') return;
                                    const state = useStore.getState();
                                    const sourceItem = payload.fromSlot === 'inventory'
                                        ? (state.championInventories[payload.fromChampionId] ?? []).find((item) => item.id === payload.itemId)
                                        : state.championEquipment[payload.fromChampionId]?.[payload.fromSlot as EquipSlotKey];
                                    if (!sourceItem || !canEquipItemInSlot(sourceItem, slotKey)) return;
                                    if (payload.fromChampionId !== targetChampion.id) {
                                        if (payload.fromSlot === 'inventory') {
                                            giveItem(payload.fromChampionId, targetChampion.id, payload.itemId);
                                        } else {
                                            giveEquippedItem(payload.fromChampionId, payload.fromSlot as EquipSlotKey, targetChampion.id);
                                        }
                                        equipItem(targetChampion.id, slotKey, payload.itemId);
                                        return;
                                    }
                                    if (payload.fromSlot === 'inventory') {
                                        equipItem(targetChampion.id, slotKey, payload.itemId);
                                        return;
                                    }
                                    const sourceSlot = payload.fromSlot as EquipSlotKey;
                                    if (sourceSlot === slotKey) return;
                                    giveEquippedItem(targetChampion.id, sourceSlot, targetChampion.id);
                                    equipItem(targetChampion.id, slotKey, payload.itemId);
                                }}
                                onHandFloorDrop={(slotKey) => {
                                    const targetChampion = party[index];
                                    if (!activeFloorDrag || !targetChampion) return;
                                    const state = useStore.getState();
                                    const floorItem = state.floorItems.find((item) => item.id === activeFloorDrag.itemId);
                                    if (!floorItem || !canEquipItemInSlot(floorItem, slotKey)) return;
                                    const pickedUp = pickupItemToChampion(activeFloorDrag.itemId, targetChampion.id);
                                    if (!pickedUp) return;
                                    equipItem(targetChampion.id, slotKey, activeFloorDrag.itemId);
                                    endFloorDrag();
                                    setHandDropOver(null);
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        flex: '0 0 20%',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 8,
                        alignContent: 'center',
                        justifyItems: 'center',
                        minWidth: 0,
                    }}
                    data-tutorial-zone="party-formation"
                >
                    {[0, 1, 2, 3].map((index) => (
                        <FormationSilhouette
                            key={index}
                            champion={party[index]}
                            slotIndex={index}
                            isDragOver={dragOver === index}
                            onDragStart={() => setDragFrom(index)}
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDragOver(index);
                            }}
                            onDrop={() => {
                                if (dragFrom !== null && dragFrom !== index) reorderParty(dragFrom, index);
                                setDragFrom(null);
                                setDragOver(null);
                            }}
                            onDragEnd={() => {
                                setDragFrom(null);
                                setDragOver(null);
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
