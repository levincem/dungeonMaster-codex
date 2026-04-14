import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    useStore,
} from '../../engine/store';
import { playStep, playCry, onSoundPlayed } from '../../engine/sounds';
import type { ChampionCombat, ChampionTemporaryXP, ChampionXP, GameAction } from '../../engine/runtimeTypes';
import { WEAPON_TYPES } from '../../data/items';
import { getGameMap } from '../../data/mapLoader';
import type { Champion } from '../../data/champions';
import type { ChampionEquipment } from '../../types/game';
import type { EquipSlotKey } from '../../types/items';
import { getEquippedItemImage } from '../../data/itemImages';
import { formatKeybinding, matchesKeybinding, normalizeBindingKey } from '../../engine/options';
import { RUNES_BY_FAMILY, RUNES_BY_ID, findSpell } from '../../data/runes';
import type { RuneFamily } from '../../data/runes';
import { itemsPath, runesPath } from '../../data/assetPaths';
import { useI18n } from '../../i18n';
import { getDragPayload, setDragPayload } from './dragPayload';
import { canEquipItemInSlot } from '../../data/equipment';
import {
    getAttackOptionUnusableReason,
    getWeaponAttackOptions,
    isAttackOptionUsableAtMastery,
    type WeaponAttackOption,
} from '../../data/weaponAttacks';
import { getChampionSkillLevel, mapOriginalSkillNumberToSkillKey } from '../../data/skillProgression';

function getRuneImagePath(runeId: string): string {
    return runesPath(`${runeId}.png`);
}

// ─── Combat grid ──────────────────────────────────────────────────────────────
const CombatGrid: React.FC<{
    party: Champion[];
    championCombat: Record<number, ChampionCombat>;
    championEquipment: Record<number, ChampionEquipment>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    attackFront: (id: number, attackType?: number) => void;
}> = ({ party, championCombat, championEquipment, championXP, championTemporaryXP, attackFront }) => {
    const text = useI18n().hud;
    const [flash, setFlash] = useState([false, false, false, false]);
    const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
    const torchBurnStart = useStore((s) => s.torchBurnStart);

    const triggerAttack = (i: number, champ: Champion, attackType?: number) => {
        attackFront(champ.id, attackType);
        setOpenMenuIndex(null);
        setFlash(prev => { const n = [...prev] as typeof prev; n[i] = true; return n; });
        setTimeout(() => setFlash(prev => { const n = [...prev] as typeof prev; n[i] = false; return n; }), 130);
    };

    const handleClick = (
        i: number,
        champ: Champion | undefined,
        ready: boolean,
        allAttacks: WeaponAttackOption[],
        usableAttacks: WeaponAttackOption[],
    ) => {
        if (!champ || !ready) return;
        if (allAttacks.length === 0) {
            triggerAttack(i, champ, usableAttacks[0]?.attackType);
            return;
        }
        if (allAttacks.length === 1 && usableAttacks.length === 1) {
            triggerAttack(i, champ, usableAttacks[0].attackType);
            return;
        }
        setOpenMenuIndex((current) => current === i ? null : i);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 126px)', gap: 10, justifyContent: 'start' }}>
            {[0, 1, 2, 3].map(i => {
                const champ = party[i];
                const cb = champ ? (championCombat[champ.id] ?? { cooldown: 0, cooldownMax: 1 }) : null;
                const cooldownRatio = cb && cb.cooldownMax > 0 ? Math.min(1, cb.cooldown / cb.cooldownMax) : 0;
                const ready = !cb || cb.cooldown <= 0;
                const equip = champ ? (championEquipment[champ.id] ?? {}) : {};
                const weapon = (equip as ChampionEquipment).rightHand;
                const weaponImage = weapon ? getEquippedItemImage(weapon, torchBurnStart) : itemsPath('hands_1.png');
                const allAttacks = getWeaponAttackOptions(weapon);
                const getMasteryForAttack = (attack: WeaponAttackOption) => {
                    if (!champ) return 0;
                    const skill = mapOriginalSkillNumberToSkillKey(attack.attack.skillNumber);
                    return getChampionSkillLevel(
                        championXP[champ.id],
                        championTemporaryXP[champ.id],
                        skill,
                    );
                };
                const usableAttacks = allAttacks.filter((attack) =>
                    isAttackOptionUsableAtMastery(attack, getMasteryForAttack(attack)),
                );
                const weaponName = weapon?.category === 'Weapon'
                    ? (WEAPON_TYPES[weapon.typeId]?.name ?? weapon.rawName ?? '?')
                    : text.fist;
                const isFlash = flash[i];
                const menuOpen = openMenuIndex === i && ready && !!champ && allAttacks.length > 1;

                return (
                    <div
                        key={i}
                        onClick={() => handleClick(i, champ, ready, allAttacks, usableAttacks)}
                        style={{
                            position: 'relative', overflow: 'hidden',
                            background: isFlash
                                ? 'rgba(220,180,60,0.28)'
                                : champ ? (ready ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.78)') : 'rgba(0,0,0,0.55)',
                            border: `1px solid ${isFlash ? 'rgba(220,180,60,0.7)' : champ ? 'rgba(212,184,112,0.62)' : 'rgba(212,184,112,0.24)'}`,
                            borderRadius: 4,
                            cursor: champ && ready ? 'pointer' : 'default',
                            width: 126,
                            height: 126,
                            userSelect: 'none',
                            transition: 'background 0.08s, border-color 0.08s',
                        }}
                    >
                        {champ ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                    <div
                                        title={weaponName}
                                        style={{
                                            width: 88,
                                            height: 100,
                                            borderRadius: 8,
                                            border: '2px solid rgba(212,184,112,0.92)',
                                            background: ready ? 'rgba(255,255,255,1)' : 'rgba(232,232,232,0.78)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {weaponImage ? (
                                            <img
                                                src={weaponImage}
                                                alt=""
                                                draggable={false}
                                                style={{
                                                    maxWidth: '92%',
                                                    maxHeight: '92%',
                                                    objectFit: 'contain',
                                                    imageRendering: 'crisp-edges',
                                                }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: 42, color: ready ? '#8a5c18' : '#6a5840', lineHeight: 1 }}>?</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0, left: 0, right: 0,
                                    height: `${cooldownRatio * 100}%`,
                                    background: 'rgba(0,0,0,0.65)',
                                    pointerEvents: 'none',
                                    transition: 'height 0.08s linear',
                                    borderRadius: '0 0 3px 3px',
                                }} />
                                {menuOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'rgba(0,0,0,0.96)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 3,
                                        padding: 4,
                                        zIndex: 2,
                                    }}>
                                        {allAttacks.map((attack) => {
                                            const masteryLevel = getMasteryForAttack(attack);
                                            const usable = isAttackOptionUsableAtMastery(attack, masteryLevel);
                                            const unusableReason = getAttackOptionUnusableReason(attack, masteryLevel);
                                            return (
                                                <button
                                                    key={attack.attackType}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!usable) return;
                                                        triggerAttack(i, champ, attack.attackType);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        minHeight: 0,
                                                        background: usable ? 'rgba(0,0,0,0.94)' : 'rgba(0,0,0,0.82)',
                                                        border: `1px solid ${usable ? 'rgba(212,184,112,0.68)' : 'rgba(212,184,112,0.3)'}`,
                                                        color: usable ? '#e4c684' : 'rgba(228,198,132,0.52)',
                                                        borderRadius: 3,
                                                        fontSize: 9,
                                                        fontWeight: 'bold',
                                                        letterSpacing: 0.5,
                                                        cursor: usable ? 'pointer' : 'default',
                                                        padding: '2px 4px',
                                                        textAlign: 'center',
                                                    }}
                                                    title={usable
                                                        ? `${attack.displayName} · ${text.fatigue} ${attack.attack.staminaCost} · ${text.speed} ${attack.attack.disableTime}/6s`
                                                        : `${attack.displayName} · ${unusableReason ?? text.attackUnavailable}`}
                                                >
                                                    {attack.displayName}
                                                    {!usable && attack.masteryThreshold > 0 ? ` [${attack.masteryThreshold}]` : ''}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ color: 'rgba(212,184,112,0.32)', fontSize: 10, textAlign: 'center', paddingTop: 8 }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Portrait helper ───────────────────────────────────────────────────────────
function getPortraitStyle(size: number): React.CSSProperties {
    return {
        width: size, height: size,
        objectFit: 'cover' as const,
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
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: () => void;
}> = ({ champion, slotIndex, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) => {
    const color = champion ? CLASS_COLORS[champion.class] : '#d4b870';

    return (
        <div
            draggable={!!champion}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            title={champion ? `${champion.name} - position ${slotIndex + 1}` : `Position ${slotIndex + 1}`}
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

const CLASS_COLORS: Record<string, string> = {
    Fighter: '#e05040', Ninja: '#40cc70', Wizard: '#a060e0', Priest: '#4090e0',
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
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const imageSrc = item
        ? getEquippedItemImage(item, torchBurnStart)
        : null;

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
            <span style={{
                position: 'absolute',
                top: 2,
                left: 4,
                fontSize: 7,
                lineHeight: 1,
                letterSpacing: 1,
                color: 'rgba(208,184,112,0.6)',
            }}>
                {HAND_SLOT_LABELS[slotKey]}
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
                <div style={{
                    width: '68%',
                    height: '68%',
                    borderRadius: 3,
                    border: '1px dashed rgba(212,184,112,0.34)',
                }} />
            )}
        </div>
    );
};


// ─── Tiny 3-bar vitals strip ───────────────────────────────────────────────────
const VitalsStrip: React.FC<{
    hp: number; maxHp: number;
    sta: number; maxSta: number;
    mana: number; maxMana: number;
}> = (
    { hp, maxHp, sta, maxSta, mana, maxMana }
) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '5px 4px', background: '#060408' }}>
        {([
            { val: hp, max: maxHp, color: '#c0251a', frameColor: undefined },
            { val: sta, max: maxSta, color: '#1e9940', frameColor: undefined },
            { val: mana, max: maxMana, color: '#1a6ec0', frameColor: undefined },
        ] as const).map(({ val, max, color, frameColor }, i) => (
            <div key={i} style={{
                height: 6,
                background: '#1a1220',
                borderRadius: 2,
                border: frameColor ? `1px solid ${frameColor}` : '1px solid transparent',
                boxSizing: 'border-box',
                boxShadow: frameColor ? `0 0 0 1px ${frameColor}18` : undefined,
            }}>
                <div style={{
                    height: '100%',
                    width: max > 0 ? `${Math.max(0, Math.min(100, (val / max) * 100))}%` : '0%',
                    background: color,
                    borderRadius: 2,
                    transition: 'width 0.4s linear',
                }} />
            </div>
        ))}
    </div>
);

// ─── Champion card (draggable, 2×2 grid) ──────────────────────────────────────
const ChampionCard: React.FC<{
    champion: Champion | undefined;
    vitals: { hp: number; stamina: number; mana: number; food: number; water: number } | undefined;
    equip: ChampionEquipment;
    recentDamage: number[];
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
    const W = 92;
    const PORTRAIT_H = 55; // clip height — shows upper portion (face), no deformation
    const color = champion ? CLASS_COLORS[champion.class] : '#d4b870';

    return (
        <div
            onClick={() => champion && (selected ? onOpenSheet() : onSelect())}
            onDragOver={champion ? onNativeItemDragOver : undefined}
            onDrop={champion ? onNativeItemDrop : undefined}
            onDragLeave={champion ? onNativeItemDragLeave : undefined}
            onMouseUp={champion ? onFloorDrop : undefined}
            title={champion
                ? (selected ? `Fiche de ${champion.name}` : `Sélectionner ${champion.name}`)
                : `Slot ${slotIndex + 1}`}
            style={{
                width: W,
                border: `2px solid ${
                    isDragOver
                        ? '#f0d060'
                        : floorDragActive && champion
                            ? '#dcb35d'
                            : selected
                                ? color
                                : champion
                                    ? color + '77'
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
            }}
        >
            {champion ? (
                <>
                    {/* Portrait — clipped to PORTRAIT_H, image centered horizontally */}
                    <div style={{ height: PORTRAIT_H, overflow: 'hidden', display: 'flex', justifyContent: 'center', position: 'relative' }}>
                        <img src={champion.portrait} alt={champion.name} style={getPortraitStyle(W)} />
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
                    </div>
                    {/* HP / Stamina / Mana bars */}
                    {vitals ? (
                        <VitalsStrip
                            hp={vitals.hp}       maxHp={champion.health}
                            sta={vitals.stamina} maxSta={champion.stamina}
                            mana={vitals.mana}   maxMana={champion.mana}
                        />
                    ) : (
                        <div style={{ height: 34, background: '#050505' }} />
                    )}
                    {/* Name strip */}
                    <div style={{
                        textAlign: 'center', fontSize: 9, letterSpacing: 0.5,
                        color: selected ? color : '#887060', padding: '2px 0',
                        background: '#050505', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
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
                <div style={{
                    height: PORTRAIT_H + 60, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(212,184,112,0.18)', fontSize: 18,
                }} />
            )}
        </div>
    );
};

// ─── Rune button ───────────────────────────────────────────────────────────────
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
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 1,
                minWidth: 0,
                boxShadow: selected ? '0 0 10px rgba(255,170,48,0.55), inset 0 0 10px rgba(255,196,96,0.18)' : undefined,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {selected && (
                <>
                    <span style={{
                        position: 'absolute',
                        inset: '6% 12%',
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${auraColor} 0%, rgba(166,120,255,0.14) 42%, rgba(166,120,255,0) 74%)`,
                        filter: 'blur(5px)',
                        opacity: 0.95,
                        pointerEvents: 'none',
                    }} className="rune-arcane-aura" />
                    <span style={{
                        position: 'absolute',
                        inset: '18% 22%',
                        borderRadius: '50%',
                        border: '1px solid rgba(198,164,255,0.34)',
                        boxShadow: '0 0 10px rgba(176,120,255,0.22)',
                        opacity: 0.8,
                        pointerEvents: 'none',
                    }} className="rune-arcane-ring" />
                </>
            )}
            <img
                src={getRuneImagePath(runeId)}
                alt={rune?.name}
                style={{ width: '82%', height: '82%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
                draggable={false}
            />
            <span style={{
                fontSize: 9, letterSpacing: 1,
                color: selected ? '#f0c870' : 'rgba(212,184,112,0.8)',
                fontFamily: 'monospace', lineHeight: 1,
                position: 'relative',
                zIndex: 1,
            }}>
                {rune?.name?.toUpperCase()}
            </span>
        </button>
    );
};

// ─── Movement button ───────────────────────────────────────────────────────────
const MoveBtn: React.FC<{
    label: string; flash: boolean; onClick: () => void; title?: string; disabled?: boolean;
}> = ({ label, flash, onClick, title, disabled = false }) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            width: '100%', aspectRatio: '1',
            background: flash ? 'rgba(220,195,110,0.46)' : 'rgba(18,14,8,0.9)',
            border: `1px solid ${flash ? 'rgba(240,210,100,0.92)' : 'rgba(212,184,112,0.82)'}`,
            borderRadius: 6,
            color: flash ? '#fff0b8' : '#e4c684',
            fontSize: 30, cursor: disabled ? 'default' : 'pointer', fontFamily: 'monospace',
            fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.05s, border-color 0.05s, color 0.05s',
            opacity: 1,
        }}
    >
        {label}
    </button>
);

const RUNE_FAMILIES: RuneFamily[] = ['power', 'element', 'form', 'alignment'];
const MOVEMENT_ACTIONS: Array<{ action: GameAction; icon: string }> = [
    { action: 'moveForward', icon: '↑' },
    { action: 'moveBackward', icon: '↓' },
    { action: 'turnLeft', icon: '↺' },
    { action: 'turnRight', icon: '↻' },
    { action: 'strafeLeft', icon: '←' },
    { action: 'strafeRight', icon: '→' },
];
type RebindingTarget = { action: GameAction; slot: 0 | 1 };

function isTextEntryTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
export const HUD = () => {
    const text = useI18n().hud;
    const {
        party, level, position, direction,
        selectedChampionIndex, selectChampion, openPartyMember, reorderParty,
        moveForward, moveBackward, strafeLeft, strafeRight, turnLeft, turnRight,
        championVitals, castSpell: storeCastSpell, lastCastResult,
        championXP, championTemporaryXP, championCombat, attackFront, championEquipment, gameOptions,
        damageEvents, optionsModalOpen, openOptionsModal, closeOptionsModal, setGameOptions,
        activeFloorDrag, pickupItemToChampion, endFloorDrag, giveItem, giveEquippedItem, equipItem,
        openDoors, openWalls, openPits,
    } = useStore();
    const currentMap = getGameMap(level);
    const keybindings = gameOptions.keybindings;
    const globalX = (currentMap.mapOffset?.x ?? 0) + position[1];
    const globalY = (currentMap.mapOffset?.y ?? 0) + position[0];
    const frontLocalX = direction === 'EAST' ? position[1] + 1 : direction === 'WEST' ? position[1] - 1 : position[1];
    const frontLocalY = direction === 'NORTH' ? position[0] - 1 : direction === 'SOUTH' ? position[0] + 1 : position[0];
    const frontGlobalX = (currentMap.mapOffset?.x ?? 0) + frontLocalX;
    const frontGlobalY = (currentMap.mapOffset?.y ?? 0) + frontLocalY;
    const frontTile = currentMap.tiles[frontLocalY]?.[frontLocalX];
    const frontState =
        !frontTile
            ? 'void blocked'
            : frontTile.type === 'Wall'
                ? 'Wall blocked'
                : frontTile.type === 'TrickWall'
                    ? `TrickWall ${openWalls.has(`${level},${frontLocalY},${frontLocalX}`) ? 'open walk' : 'closed blocked'}`
                    : frontTile.type === 'Door'
                        ? `Door ${openDoors.has(`${level},${frontLocalY},${frontLocalX}`) ? 'open walk' : 'closed blocked'}`
                        : frontTile.type === 'Pit'
                            ? `Pit ${openPits.has(`${level},${frontLocalY},${frontLocalX}`) ? 'open blocked' : 'closed walk'}`
                            : `${frontTile.type} walk`;

    // ── Sound debug ─────────────────────────────────────────────────────────
    const [lastSound, setLastSound] = useState<string>('');
    useEffect(() => {
        return onSoundPlayed((name, file) => setLastSound(`${name} (${file})`));
    }, []);

    // ── Flash ───────────────────────────────────────────────────────────────
    const [flashKey, setFlashKey] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [rebindingTarget, setRebindingTarget] = useState<RebindingTarget | null>(null);
    const [tutorialModalOpen, setTutorialModalOpen] = useState(false);
    const [tutorialPressedButton, setTutorialPressedButton] = useState<'close' | 'continue' | null>(null);
    const handleCloseOptionsModal = useCallback(() => {
        setRebindingTarget(null);
        closeOptionsModal();
    }, [closeOptionsModal]);
    const flash = useCallback((key: string, action: () => void) => {
        action();
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlashKey(key);
        flashTimer.current = setTimeout(() => setFlashKey(null), 150);
    }, []);

    // Like flash but also plays footstep/cry sound for movement actions
    const move = useCallback((key: string, action: () => void) => {
        const cooldown = useStore.getState().movementCooldown;
        if (Number.isFinite(cooldown) && cooldown > 0) return;
        const posBefore = useStore.getState().position;
        action();
        const posAfter = useStore.getState().position;
        const moved = posAfter[0] !== posBefore[0] || posAfter[1] !== posBefore[1];
        if (moved) playStep(); else playCry();
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlashKey(key);
        flashTimer.current = setTimeout(() => setFlashKey(null), 150);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (optionsModalOpen || tutorialModalOpen) return;
            if (isTextEntryTarget(e.target)) return;
            const { keybindings } = gameOptions;
            if (matchesKeybinding(keybindings.moveForward, e.key)) { e.preventDefault(); move('fwd', moveForward); return; }
            if (matchesKeybinding(keybindings.moveBackward, e.key)) { e.preventDefault(); move('bck', moveBackward); return; }
            if (matchesKeybinding(keybindings.turnLeft, e.key)) { e.preventDefault(); flash('tl', turnLeft); return; }
            if (matchesKeybinding(keybindings.turnRight, e.key)) { e.preventDefault(); flash('tr', turnRight); return; }
            if (matchesKeybinding(keybindings.strafeLeft, e.key)) { e.preventDefault(); move('sl', strafeLeft); return; }
            if (matchesKeybinding(keybindings.strafeRight, e.key)) { e.preventDefault(); move('sr', strafeRight); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [flash, gameOptions, move, moveForward, moveBackward, optionsModalOpen, tutorialModalOpen, turnLeft, turnRight, strafeLeft, strafeRight]);

    useEffect(() => {
        if (!optionsModalOpen) return;

        const handleRebind = (e: KeyboardEvent) => {
            if (rebindingTarget === null) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCloseOptionsModal();
                }
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape') {
                setRebindingTarget(null);
                return;
            }

            const ignoredKeys = new Set(['Shift', 'Control', 'Alt', 'Meta']);
            if (ignoredKeys.has(e.key)) return;

            setGameOptions({
                keybindings: {
                    [rebindingTarget.action]: (() => {
                        const current = [...(keybindings[rebindingTarget.action] ?? [])];
                        while (current.length < 2) current.push('');
                        current[rebindingTarget.slot] = normalizeBindingKey(e.key);
                        return current.filter((value, index, arr) => value && arr.indexOf(value) === index);
                    })(),
                } as typeof keybindings,
            });
            setRebindingTarget(null);
        };

        window.addEventListener('keydown', handleRebind, true);
        return () => window.removeEventListener('keydown', handleRebind, true);
    }, [handleCloseOptionsModal, keybindings, optionsModalOpen, rebindingTarget, setGameOptions]);

    // ── Drag-and-drop (champion reorder) ────────────────────────────────────
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);
    const [itemDropOver, setItemDropOver] = useState<number | null>(null);
    const [handDropOver, setHandDropOver] = useState<string | null>(null);

    useEffect(() => {
        const clearItemDropState = () => {
            setItemDropOver(null);
            setHandDropOver(null);
        };
        window.addEventListener('dragend', clearItemDropState);
        window.addEventListener('drop', clearItemDropState);
        return () => {
            window.removeEventListener('dragend', clearItemDropState);
            window.removeEventListener('drop', clearItemDropState);
        };
    }, []);



    // ── Rune state ──────────────────────────────────────────────────────────
    const [selectedRunes, setSelectedRunes] = useState<string[]>([]);
    const currentFamilyIdx = Math.min(selectedRunes.length, RUNE_FAMILIES.length - 1);
    const currentFamily = RUNE_FAMILIES[currentFamilyIdx];

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

    const selectRune = (runeId: string) => {
        setSelectedRunes(prev => {
            const idx = prev.indexOf(runeId);
            if (idx !== -1) return prev.slice(0, idx);
            if (prev.length >= 4) return prev;
            return [...prev, runeId];
        });
    };
    const handleCast = () => {
        const champ = party[selectedChampionIndex];
        if (!champ) return;
        storeCastSpell(champ.id, selectedRunes);
        setSelectedRunes([]);
    };
    const clearRunes = () => setSelectedRunes([]);
    const spell = findSpell(selectedRunes);
    const selectedChamp = party[selectedChampionIndex];
    const selectedVitals = selectedChamp ? championVitals[selectedChamp.id] : undefined;
    const selectedCombat = selectedChamp ? championCombat[selectedChamp.id] : undefined;

    // Disable LANCER if no mana or insufficient mana for the matched spell
    const canCast = selectedRunes.length >= 2 && selectedChamp &&
        (selectedCombat?.cooldown ?? 0) <= 0 &&
        (spell ? (selectedVitals?.mana ?? 0) >= spell.manaCost : true);
    // ── Panel wrapper (subtle border/bg, no title) ──────────────────────────
    const panel: React.CSSProperties = {
        background: 'rgba(0,0,0,0.84)',
        border: '1px solid rgba(200,170,110,0.18)',
        borderRadius: 6, padding: '8px 10px', marginBottom: 6,
    };

    return (
        <div style={{
            position: 'fixed', right: 0, top: 0,
            width: '33vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.5)',
            borderLeft: '1px solid rgba(200,170,110,0.18)',
            display: 'flex', flexDirection: 'column',
            padding: '42px 10px 10px', boxSizing: 'border-box',
            fontFamily: '"Courier New", Courier, monospace',
            color: '#d8d0b8', zIndex: 100,
            overflow: 'hidden',
        }}>
            <button
                onClick={() => setTutorialModalOpen(true)}
                title="Quick guide"
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 46,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    border: '1px solid rgba(200,170,110,0.38)',
                    background: 'rgba(0,0,0,0.9)',
                    color: '#f0d060',
                    fontSize: 18,
                    fontWeight: 'bold',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                }}
            >
                ?
            </button>
            <button
                onClick={openOptionsModal}
                title={text.options}
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 10,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    border: '1px solid rgba(200,170,110,0.38)',
                    background: 'rgba(0,0,0,0.9)',
                    color: '#f0d060',
                    fontSize: 17,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                }}
            >
                ⚙
            </button>

            {/* Top area: four portraits in one row, formation on the right */}
            <div style={panel}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                    <div style={{ flex: '0 0 80%', display: 'flex', gap: 6, minWidth: 0 }}>
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} style={{ flex: '1 1 20%', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                                <ChampionCard
                                    champion={party[i]}
                                    vitals={party[i] ? championVitals[party[i].id] : undefined}
                                    equip={party[i] ? (championEquipment[party[i].id] ?? {}) : {}}
                                    recentDamage={party[i]
                                        ? damageEvents
                                            .filter((event) => event.target === 'champion' && event.championId === party[i]!.id)
                                            .slice(-2)
                                            .map((event) => event.amount)
                                        : []}
                                    slotIndex={i}
                                    selected={selectedChampionIndex === i && !!party[i]}
                                    isDragOver={itemDropOver === i}
                                    floorDragActive={activeFloorDrag !== null}
                                    leftHandDragOver={handDropOver === `${party[i]?.id}_leftHand`}
                                    rightHandDragOver={handDropOver === `${party[i]?.id}_rightHand`}
                                    onSelect={() => selectChampion(i)}
                                    onOpenSheet={() => party[i] && openPartyMember(party[i].id)}
                                    onNativeItemDragOver={(event) => {
                                        if (!party[i]) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.dataTransfer.dropEffect = 'move';
                                        setItemDropOver(i);
                                    }}
                                    onNativeItemDragLeave={() => {
                                        setItemDropOver((current) => (current === i ? null : current));
                                    }}
                                    onNativeItemDrop={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setItemDropOver(null);
                                        const targetChampion = party[i];
                                        if (!targetChampion) return;
                                        const payload = getDragPayload(event);
                                        if (!payload) return;
                                        if (payload.fromChampionId === targetChampion.id && payload.fromSlot !== 'inventory') return;
                                        if (payload.fromSlot === 'inventory') {
                                            giveItem(payload.fromChampionId, targetChampion.id, payload.itemId);
                                            return;
                                        }
                                        giveEquippedItem(payload.fromChampionId, payload.fromSlot as EquipSlotKey, targetChampion.id);
                                    }}
                                    onFloorDrop={() => {
                                        const targetChampion = party[i];
                                        if (!activeFloorDrag || !targetChampion) return;
                                        pickupItemToChampion(activeFloorDrag.itemId, targetChampion.id);
                                        endFloorDrag();
                                    }}
                                    onHandNativeItemDragOver={(slotKey, event) => {
                                        const targetChampion = party[i];
                                        if (!targetChampion) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.dataTransfer.dropEffect = 'move';
                                        setItemDropOver(null);
                                        setHandDropOver(`${targetChampion.id}_${slotKey}`);
                                    }}
                                    onHandNativeItemDragLeave={(slotKey) => {
                                        const targetChampion = party[i];
                                        if (!targetChampion) return;
                                        const key = `${targetChampion.id}_${slotKey}`;
                                        setHandDropOver((current) => (current === key ? null : current));
                                    }}
                                    onHandNativeItemDrop={(slotKey, event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setItemDropOver(null);
                                        setHandDropOver(null);
                                        const targetChampion = party[i];
                                        if (!targetChampion) return;
                                        const payload = getDragPayload(event);
                                        if (!payload) return;
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
                                        const targetChampion = party[i];
                                        if (!activeFloorDrag || !targetChampion) return;
                                        const state = useStore.getState();
                                        const floorItem = state.floorItems.find((item) => item.id === activeFloorDrag.itemId);
                                        if (!floorItem || !canEquipItemInSlot(floorItem, slotKey)) return;
                                        pickupItemToChampion(activeFloorDrag.itemId, targetChampion.id);
                                        equipItem(targetChampion.id, slotKey, activeFloorDrag.itemId);
                                        endFloorDrag();
                                        setHandDropOver(null);
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div style={{
                        flex: '0 0 20%',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 8,
                        alignContent: 'center',
                        justifyItems: 'center',
                        minWidth: 0,
                    }}>
                        {[0, 1, 2, 3].map(i => (
                            <FormationSilhouette
                                key={i}
                                champion={party[i]}
                                slotIndex={i}
                                isDragOver={dragOver === i}
                                onDragStart={() => setDragFrom(i)}
                                onDragOver={e => { e.preventDefault(); setDragOver(i); }}
                                onDrop={() => {
                                    if (dragFrom !== null && dragFrom !== i) reorderParty(dragFrom, i);
                                    setDragFrom(null); setDragOver(null);
                                }}
                                onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                            />
                        ))}
                    </div>
                </div>

                {/* Selected champion info */}
                {selectedChamp && (
                    <div style={{
                        marginTop: 7, paddingTop: 6,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <span style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 1, color: CLASS_COLORS[selectedChamp.class] }}>
                            {selectedChamp.name}
                        </span>
                        <span style={{ fontSize: 10, color: '#887878', letterSpacing: 1 }}>
                            {selectedChamp.class.toUpperCase()}
                            {selectedVitals && (
                                <span style={{ color: '#5080c0', marginLeft: 7 }}>
                                    {Math.floor(selectedVitals.mana)}/{selectedChamp.mana} MP
                                </span>
                            )}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Magie ─────────────────────────────────────────────────── */}
            <div style={panel}>
                {/* 4 rune slots + cast/clear buttons on same row */}
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
                                onClick={() => runeId && setSelectedRunes(prev => prev.slice(0, i))}
                                title={runeId ? `Retirer ${rune?.name}` : `Slot ${i + 1}`}
                                style={{
                                    flex: 1,
                                    aspectRatio: '1 / 0.68',
                                    background: 'rgba(0,0,0,0.94)',
                                    border: `1px solid ${runeId ? 'rgba(240,196,96,0.95)' : 'rgba(212,184,112,0.58)'}`,
                                    borderRadius: 4,
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 0,
                                    cursor: runeId ? 'pointer' : 'default', padding: 1,
                                    boxShadow: runeId ? '0 0 10px rgba(255,160,32,0.42), inset 0 0 10px rgba(255,196,96,0.16)' : undefined,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {runeId ? (
                                    <>
                                        <span style={{
                                            position: 'absolute',
                                            inset: '8% 16%',
                                            borderRadius: '50%',
                                            background: 'radial-gradient(circle, rgba(176,120,255,0.34) 0%, rgba(166,112,255,0.14) 44%, rgba(166,112,255,0) 74%)',
                                            filter: 'blur(6px)',
                                            opacity: 0.95,
                                            pointerEvents: 'none',
                                        }} className="rune-arcane-aura" />
                                        <span style={{
                                            position: 'absolute',
                                            inset: '22% 28%',
                                            borderRadius: '50%',
                                            border: '1px solid rgba(196,158,255,0.3)',
                                            boxShadow: '0 0 10px rgba(164,116,255,0.18)',
                                            opacity: 0.75,
                                            pointerEvents: 'none',
                                        }} className="rune-arcane-ring" />
                                        <img src={getRuneImagePath(runeId)} alt=""
                                            style={{ width: '74%', height: '74%', objectFit: 'contain', position: 'relative', zIndex: 1 }} />
                                        <span style={{ fontSize: 6, color: '#f0c870', letterSpacing: 0.8, lineHeight: 1, textShadow: '0 0 6px rgba(255,160,32,0.42)', position: 'relative', zIndex: 1, marginTop: -2 }}>
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

                {/* Spell name + cast/clear */}
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {spell ? (
                            <div style={{ fontSize: 12, color: '#f0d060', fontWeight: 'bold', letterSpacing: 0.5 }}>
                                {spell.name}
                                <span style={{ color: '#d4b870', fontWeight: 'normal', fontSize: 10, marginLeft: 5 }}>
                                    {spell.manaCost} MP
                                </span>
                            </div>
                        ) : selectedRunes.length > 0 ? (
                            <div style={{ fontSize: 10, color: '#8a7650', fontStyle: 'italic' }}>{text.unknownCombination}</div>
                        ) : (
                            <div style={{ fontSize: 10, color: '#8a7650', fontStyle: 'italic' }}>{text.selectRunes}</div>
                        )}
                    </div>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={handleCast} disabled={!canCast} style={{
                        padding: '4px 9px',
                        background: canCast ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.82)',
                        border: `1px solid ${canCast ? 'rgba(212,184,112,0.82)' : 'rgba(212,184,112,0.28)'}`,
                        borderRadius: 4,
                        color: canCast ? '#f0d060' : 'rgba(212,184,112,0.34)',
                        fontSize: 11, letterSpacing: 1,
                        cursor: canCast ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace', whiteSpace: 'nowrap',
                    }}>✦ {text.cast}</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={clearRunes} disabled={selectedRunes.length === 0} style={{
                        padding: '4px 7px',
                        background: selectedRunes.length > 0 ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.82)',
                        border: `1px solid ${selectedRunes.length > 0 ? 'rgba(212,184,112,0.72)' : 'rgba(212,184,112,0.22)'}`, borderRadius: 4,
                        color: selectedRunes.length > 0 ? '#d8ba76' : 'rgba(212,184,112,0.34)',
                        fontSize: 11,
                        cursor: selectedRunes.length > 0 ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace',
                        boxShadow: selectedRunes.length > 0 ? 'inset 0 0 10px rgba(212,184,112,0.08)' : 'none',
                    }}>✕</button>
                </div>

                {/* Family label */}
                <div style={{ fontSize: 9, letterSpacing: 2, marginBottom: 3, fontWeight: 'bold', color: '#e0b850' }}>
                    {text.runeFamilyLabels[currentFamily]}
                </div>

                {/* Rune row */}
                <div style={{ display: 'flex', gap: 1, background: 'rgba(0,0,0,0.9)', padding: 2, borderRadius: 5, border: '1px solid rgba(212,184,112,0.24)' }}>
                    {RUNES_BY_FAMILY[currentFamily].map(rune => (
                        <RuneBtn
                            key={rune.id}
                            runeId={rune.id}
                            selected={selectedRunes.includes(rune.id)}
                            onClick={() => selectRune(rune.id)}
                        />
                    ))}
                </div>

                {/* Cast feedback */}
                {lastCastResult && (
                    <div style={{
                        marginTop: 6, padding: '5px 8px',
                        background: 'rgba(10,6,22,0.95)',
                        border: `1px solid ${lastCastResult.success ? 'rgba(220,190,60,0.4)' : 'rgba(200,60,60,0.4)'}`,
                        borderRadius: 4, fontSize: 10,
                        color: lastCastResult.success ? '#f0d060' : '#e06060',
                        lineHeight: 1.5,
                    }}>
                        {lastCastResult.success ? '✦ ' : '✕ '}{lastCastResult.message}
                    </div>
                )}
            </div>

            {/* ── Combat ─────────────────────────────────────────────────── */}
            <div style={panel}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <CombatGrid
                            party={party}
                            championCombat={championCombat}
                            championEquipment={championEquipment}
                            championXP={championXP}
                            championTemporaryXP={championTemporaryXP}
                            attackFront={attackFront}
                        />
                    </div>
                    <div style={{
                        flex: '0 0 48%',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 10,
                        alignContent: 'center',
                    }}>
                        <MoveBtn label="↺" flash={flashKey === 'tl'}  title={`${text.actionLabels.turnLeft} (${formatKeybinding(gameOptions.keybindings.turnLeft)})`} onClick={() => flash('tl',  turnLeft)} />
                        <MoveBtn label="↑" flash={flashKey === 'fwd'} title={`${text.actionLabels.moveForward} (${formatKeybinding(gameOptions.keybindings.moveForward)})`} onClick={() => move('fwd', moveForward)} />
                        <MoveBtn label="↻" flash={flashKey === 'tr'}  title={`${text.actionLabels.turnRight} (${formatKeybinding(gameOptions.keybindings.turnRight)})`} onClick={() => flash('tr',  turnRight)} />
                        <MoveBtn label="←" flash={flashKey === 'sl'}  title={`${text.actionLabels.strafeLeft} (${formatKeybinding(gameOptions.keybindings.strafeLeft)})`} onClick={() => move('sl',  strafeLeft)} />
                        <MoveBtn label="↓" flash={flashKey === 'bck'} title={`${text.actionLabels.moveBackward} (${formatKeybinding(gameOptions.keybindings.moveBackward)})`} onClick={() => move('bck', moveBackward)} />
                        <MoveBtn label="→" flash={flashKey === 'sr'}  title={`${text.actionLabels.strafeRight} (${formatKeybinding(gameOptions.keybindings.strafeRight)})`} onClick={() => move('sr',  strafeRight)} />
                    </div>
                </div>
            </div>

            <div style={{ flex: 1 }} />

            {/* Debug */}
            <div style={{ fontSize: 10, color: '#993322', fontFamily: 'monospace', textAlign: 'center', opacity: 0.6 }}>
                [g:{globalX},{globalY}] {direction} · LVL {level} · front [g:{frontGlobalX},{frontGlobalY} / l:{frontLocalX},{frontLocalY}] · {frontState}
            </div>
            <div style={{ fontSize: 9, color: '#7a4a24', fontFamily: 'monospace', textAlign: 'center', opacity: 0.5, marginTop: 2 }}>
                local [l:{position[1]},{position[0]}] · offset [{currentMap.mapOffset?.x ?? 0},{currentMap.mapOffset?.y ?? 0}]
            </div>
            {lastSound && (
                <div style={{ fontSize: 9, color: '#cc8833', fontFamily: 'monospace', textAlign: 'center', opacity: 0.7, marginTop: 2 }}>
                    ♪ {lastSound}
                </div>
            )}

            {optionsModalOpen && (
                <div
                    onClick={() => {
                        setRebindingTarget(null);
                        closeOptionsModal();
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 220,
                        padding: 24,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(560px, 92vw)',
                            background: 'linear-gradient(180deg, rgba(7,7,7,0.98), rgba(18,15,10,0.98))',
                            border: '1px solid rgba(212,184,112,0.46)',
                            borderRadius: 12,
                            boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
                            padding: 22,
                            color: '#ead6a0',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div>
                                <div style={{ fontSize: 13, letterSpacing: 3, color: '#c9a85e', marginBottom: 6 }}>{text.options.toUpperCase()}</div>
                                <div style={{ fontSize: 21, fontWeight: 'bold', color: '#f2dfad' }}>{text.keybindings}</div>
                            </div>
                            <button
                                onClick={() => {
                                    setRebindingTarget(null);
                                    closeOptionsModal();
                                }}
                                style={{
                                    background: 'none',
                                    border: '1px solid rgba(212,184,112,0.26)',
                                    color: '#bfa06a',
                                    borderRadius: 999,
                                    width: 32,
                                    height: 32,
                                    fontSize: 20,
                                    cursor: 'pointer',
                                }}
                                title={text.close}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(232,214,160,0.72)', marginBottom: 20 }}>
                            {rebindingTarget === null ? text.clickToReassign : `${text.pressNewKey} ${text.pressEscToCancel}`}
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                            {MOVEMENT_ACTIONS.map(({ action, icon }) => {
                                const bindings = gameOptions.keybindings[action] ?? [];
                                return (
                                    <div
                                        key={action}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '48px 1fr 140px 140px',
                                            gap: 12,
                                            alignItems: 'center',
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: '1px solid rgba(212,184,112,0.18)',
                                            background: 'rgba(0,0,0,0.28)',
                                        }}
                                    >
                                        <div style={{
                                            width: 38,
                                            height: 38,
                                            borderRadius: 999,
                                            border: '1px solid rgba(212,184,112,0.28)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#f0d060',
                                            fontSize: 22,
                                        }}>
                                            {icon}
                                        </div>
                                        <div style={{ fontSize: 15, color: '#ecd9a8' }}>
                                            {text.actionLabels[action]}
                                        </div>
                                        {[0, 1].map((slotIndex) => {
                                            const waiting = rebindingTarget?.action === action && rebindingTarget.slot === slotIndex;
                                            const binding = bindings[slotIndex] ? formatKeybinding([bindings[slotIndex]]) : '—';
                                            return (
                                                <button
                                                    key={`${action}-${slotIndex}`}
                                                    onClick={() => setRebindingTarget((current) =>
                                                        current?.action === action && current.slot === slotIndex
                                                            ? null
                                                            : { action, slot: slotIndex as 0 | 1 },
                                                    )}
                                                    style={{
                                                        padding: '9px 12px',
                                                        borderRadius: 6,
                                                        border: `1px solid ${waiting ? 'rgba(240,208,96,0.78)' : 'rgba(212,184,112,0.3)'}`,
                                                        background: waiting ? 'rgba(18,12,0,0.96)' : 'rgba(0,0,0,0.62)',
                                                        color: waiting ? '#ffe9aa' : '#d8c08b',
                                                        fontSize: 15,
                                                        cursor: 'pointer',
                                                        fontFamily: '"Courier New", monospace',
                                                        letterSpacing: 1,
                                                    }}
                                                >
                                                    {waiting ? text.pressNewKey : binding}
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {tutorialModalOpen && (
                <div
                    onClick={() => setTutorialModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 221,
                        padding: 24,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(560px, 92vw)',
                            background: 'linear-gradient(180deg, rgba(7,7,7,0.98), rgba(18,15,10,0.98))',
                            border: '1px solid rgba(212,184,112,0.46)',
                            borderRadius: 12,
                            boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
                            padding: 22,
                            color: '#ead6a0',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <div>
                                <div style={{ fontSize: 13, letterSpacing: 3, color: '#c9a85e', marginBottom: 6 }}>HELP</div>
                                <div style={{ fontSize: 21, fontWeight: 'bold', color: '#f2dfad' }}>Quick Guide</div>
                            </div>
                            <button
                                onClick={() => setTutorialModalOpen(false)}
                                onMouseDown={() => setTutorialPressedButton('close')}
                                onMouseUp={() => setTutorialPressedButton(null)}
                                onMouseLeave={() => setTutorialPressedButton(null)}
                                style={{
                                    background: tutorialPressedButton === 'close' ? 'rgba(70,54,26,0.28)' : 'none',
                                    border: '1px solid rgba(212,184,112,0.26)',
                                    color: '#bfa06a',
                                    borderRadius: 999,
                                    width: 32,
                                    height: 32,
                                    fontSize: 20,
                                    cursor: 'pointer',
                                    transform: tutorialPressedButton === 'close' ? 'translateY(1px) scale(0.97)' : 'translateY(0) scale(1)',
                                    boxShadow: tutorialPressedButton === 'close' ? 'inset 0 2px 6px rgba(0,0,0,0.35)' : '0 4px 10px rgba(0,0,0,0.14)',
                                    transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease',
                                }}
                                title={text.close}
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(232,214,160,0.8)' }}>
                            <p style={{ margin: '0 0 10px' }}>Choose four champions by clicking their portraits in the Hall of Champions.</p>
                            <p style={{ margin: '0 0 10px' }}>Enter the dungeon and keep your party alive by managing equipment, food, water, health, and magic.</p>
                            <p style={{ margin: '0 0 10px' }}>Watch the walls, floors, doors, pits, and alcoves carefully: many mechanisms, traps, and secrets are hidden in plain sight.</p>
                            <p style={{ margin: '0 0 10px' }}>Save often. Some encounters and puzzles can punish careless exploration.</p>
                            <p style={{ margin: 0 }}>Your ultimate goal is to descend to the bottom of the dungeon, defeat Lord Chaos, and survive the journey.</p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                            <button
                                onClick={() => setTutorialModalOpen(false)}
                                onMouseDown={() => setTutorialPressedButton('continue')}
                                onMouseUp={() => setTutorialPressedButton(null)}
                                onMouseLeave={() => setTutorialPressedButton(null)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(212,184,112,0.4)',
                                    background: tutorialPressedButton === 'continue'
                                        ? 'linear-gradient(180deg, rgba(76,56,24,0.78), rgba(44,31,12,0.82))'
                                        : 'linear-gradient(180deg, rgba(108,78,32,0.62), rgba(58,40,16,0.72))',
                                    color: '#f2dfad',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    boxShadow: tutorialPressedButton === 'continue'
                                        ? '0 4px 10px rgba(0,0,0,0.22), inset 0 2px 6px rgba(0,0,0,0.22)'
                                        : '0 10px 20px rgba(0,0,0,0.2)',
                                    transform: tutorialPressedButton === 'continue' ? 'translateY(1px) scale(0.99)' : 'translateY(0) scale(1)',
                                    transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease',
                                }}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
const HAND_SLOT_LABELS = {
    leftHand: 'MG',
    rightHand: 'MD',
} as const;
