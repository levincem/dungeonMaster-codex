import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    CRITICAL_FOOD_THRESHOLD,
    CRITICAL_WATER_THRESHOLD,
    LOW_FOOD_THRESHOLD,
    LOW_WATER_THRESHOLD,
    MAX_FOOD,
    MAX_WATER,
    useStore,
    xpToLevel,
} from '../../engine/store';
import { playStep, playCry, onSoundPlayed } from '../../engine/sounds';
import type { ChampionCombat, ChampionXP } from '../../engine/runtimeTypes';
import { WEAPON_TYPES } from '../../data/items';
import { getGameMap } from '../../data/mapLoader';
import type { Champion } from '../../data/champions';
import type { ChampionEquipment } from '../../types/game';
import { getEquippedItemImage } from '../../data/itemImages';
import { RUNES_BY_FAMILY, RUNES_BY_ID, findSpell } from '../../data/runes';
import type { RuneFamily } from '../../data/runes';
import {
    getAttackOptionUnusableReason,
    getWeaponAttackOptions,
    isAttackOptionUsableAtMastery,
    mapOriginalSkillNumberToBasicSkill,
    type WeaponAttackOption,
} from '../../data/weaponAttacks';

const HAND_SLOT_LABELS = {
    leftHand: 'MG',
    rightHand: 'MD',
} as const;

// ─── Combat grid ──────────────────────────────────────────────────────────────
const CombatGrid: React.FC<{
    party: Champion[];
    championCombat: Record<number, ChampionCombat>;
    championEquipment: Record<number, ChampionEquipment>;
    championXP: Record<number, ChampionXP>;
    attackFront: (id: number, attackType?: number) => void;
}> = ({ party, championCombat, championEquipment, championXP, attackFront }) => {
    const [flash, setFlash] = useState([false, false, false, false]);
    const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {[0, 1, 2, 3].map(i => {
                const champ = party[i];
                const cb = champ ? (championCombat[champ.id] ?? { cooldown: 0, cooldownMax: 1 }) : null;
                const cooldownRatio = cb && cb.cooldownMax > 0 ? Math.min(1, cb.cooldown / cb.cooldownMax) : 0;
                const ready = !cb || cb.cooldown <= 0;
                const equip = champ ? (championEquipment[champ.id] ?? {}) : {};
                const weapon = (equip as ChampionEquipment).rightHand;
                const allAttacks = getWeaponAttackOptions(weapon);
                const getMasteryForAttack = (attack: WeaponAttackOption) => {
                    if (!champ) return 0;
                    const skill = mapOriginalSkillNumberToBasicSkill(attack.attack.skillNumber);
                    return xpToLevel(championXP[champ.id]?.[skill] ?? 0);
                };
                const usableAttacks = allAttacks.filter((attack) =>
                    isAttackOptionUsableAtMastery(attack, getMasteryForAttack(attack)),
                );
                const weaponName = weapon?.category === 'Weapon'
                    ? (WEAPON_TYPES[weapon.typeId]?.name ?? weapon.rawName ?? '?')
                    : '✊ Poing';
                const xp  = champ ? (championXP[champ.id] ?? null) : null;
                const lvl = xp ? xpToLevel(xp.fighter) : 0;
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
                                : champ ? (ready ? 'rgba(20,14,36,0.95)' : 'rgba(10,6,18,0.85)') : 'rgba(6,4,12,0.6)',
                            border: `1px solid ${isFlash ? 'rgba(220,180,60,0.7)' : champ ? (ready ? 'rgba(180,140,80,0.5)' : 'rgba(80,60,100,0.35)') : '#1a1228'}`,
                            borderRadius: 4, padding: '5px 7px',
                            cursor: champ && ready ? 'pointer' : 'default',
                            minHeight: 44, userSelect: 'none',
                            transition: 'background 0.08s, border-color 0.08s',
                        }}
                    >
                        {champ ? (
                            <>
                                <div style={{ fontSize: 10, fontWeight: 'bold', color: ready ? '#d4b870' : '#6a5840', letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {weaponName}
                                </div>
                                <div style={{ fontSize: 9, color: '#6a5858', marginTop: 2, letterSpacing: 0.5 }}>
                                    {champ.name} · Niv {lvl}
                                </div>
                                {/* Cooldown overlay — always rendered, drains from bottom upward */}
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
                                        background: 'rgba(8,5,16,0.96)',
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
                                                        background: usable ? 'rgba(70,46,20,0.95)' : 'rgba(26,22,34,0.95)',
                                                        border: `1px solid ${usable ? 'rgba(212,184,112,0.55)' : 'rgba(96,86,110,0.35)'}`,
                                                        color: usable ? '#e4c684' : '#756b84',
                                                        borderRadius: 3,
                                                        fontSize: 9,
                                                        fontWeight: 'bold',
                                                        letterSpacing: 0.5,
                                                        cursor: usable ? 'pointer' : 'default',
                                                        padding: '2px 4px',
                                                        textAlign: 'center',
                                                    }}
                                                    title={usable
                                                        ? `${attack.displayName} · fatigue ${attack.attack.staminaCost} · tempo ${attack.attack.disableTime}/6s`
                                                        : `${attack.displayName} · ${unusableReason ?? 'attaque indisponible'}`}
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
                            <div style={{ color: '#251e35', fontSize: 10, textAlign: 'center', paddingTop: 8 }}>—</div>
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

const HandSlot: React.FC<{
    slotKey: 'leftHand' | 'rightHand';
    item?: ChampionEquipment['leftHand'];
}> = ({ slotKey, item }) => {
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const imageSrc = item
        ? getEquippedItemImage(item, torchBurnStart)
        : null;

    return (
        <div style={{
            flex: 1,
            height: 36,
            border: '1px solid rgba(120,96,54,0.75)',
            borderRadius: 4,
            background: 'rgba(8,6,14,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
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
                    border: '1px dashed rgba(110,88,48,0.45)',
                }} />
            )}
        </div>
    );
};

const FormationSilhouette: React.FC<{
    champion: Champion | undefined;
    slotIndex: number;
    isDragOver: boolean;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: () => void;
}> = ({ champion, slotIndex, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) => {
    const color = champion ? CLASS_COLORS[champion.class] : '#4a405a';

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
                border: `2px solid ${isDragOver ? '#f0d060' : champion ? color : '#342a44'}`,
                background: isDragOver ? 'rgba(240,208,96,0.12)' : 'rgba(8,6,16,0.92)',
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
                <span style={{ fontSize: 12, color: '#514660', fontFamily: 'monospace' }}>{slotIndex + 1}</span>
            )}
        </div>
    );
};

const CLASS_COLORS: Record<string, string> = {
    Fighter: '#e05040', Ninja: '#40cc70', Wizard: '#a060e0', Priest: '#4090e0',
};
const FAMILY_COLORS: Record<RuneFamily, string> = {
    power: '#f0b030', element: '#50d0f0', form: '#b070f0', alignment: '#50e090',
};
const FAMILY_LABELS: Record<RuneFamily, string> = {
    power: 'PUISSANCE', element: 'ÉLÉMENT', form: 'FORME', alignment: 'ALIGNEMENT',
};

function getAlertFrameColor(value: number, lowThreshold: number, criticalThreshold: number): string | undefined {
    if (value <= criticalThreshold) return '#b83a30';
    if (value <= lowThreshold) return 'rgba(212, 168, 32, 0.7)';
    return undefined;
}


// ─── Tiny 3-bar vitals strip ───────────────────────────────────────────────────
const VitalsStrip: React.FC<{
    hp: number; maxHp: number;
    sta: number; maxSta: number;
    mana: number; maxMana: number;
    food: number; maxFood: number;
    water: number; maxWater: number;
}> = (
    { hp, maxHp, sta, maxSta, mana, maxMana, food, maxFood, water, maxWater }
) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '3px 4px', background: '#060408' }}>
        {([
            { val: hp, max: maxHp, color: '#c0251a', frameColor: undefined },
            { val: sta, max: maxSta, color: '#1e9940', frameColor: undefined },
            { val: mana, max: maxMana, color: '#1a6ec0', frameColor: undefined },
            { val: food, max: maxFood, color: '#c47b24', frameColor: getAlertFrameColor(food, LOW_FOOD_THRESHOLD, CRITICAL_FOOD_THRESHOLD) },
            { val: water, max: maxWater, color: '#2d91d0', frameColor: getAlertFrameColor(water, LOW_WATER_THRESHOLD, CRITICAL_WATER_THRESHOLD) },
        ] as const).map(({ val, max, color, frameColor }, i) => (
            <div key={i} style={{
                height: 3,
                background: '#1a1220',
                borderRadius: 1,
                border: frameColor ? `1px solid ${frameColor}` : '1px solid transparent',
                boxSizing: 'border-box',
                boxShadow: frameColor ? `0 0 0 1px ${frameColor}18` : undefined,
            }}>
                <div style={{
                    height: '100%',
                    width: max > 0 ? `${Math.max(0, Math.min(100, (val / max) * 100))}%` : '0%',
                    background: color,
                    borderRadius: 1,
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
    slotIndex: number;
    selected: boolean;
    isDragOver: boolean;
    onSelect: () => void;
    onOpenSheet: () => void;
}> = ({ champion, vitals, equip, slotIndex, selected, isDragOver, onSelect, onOpenSheet }) => {
    const W = 92;
    const PORTRAIT_H = 55; // clip height — shows upper portion (face), no deformation
    const color = champion ? CLASS_COLORS[champion.class] : '#2a2a3a';

    return (
        <div
            onClick={() => champion && (selected ? onOpenSheet() : onSelect())}
            title={champion
                ? (selected ? `Fiche de ${champion.name}` : `Sélectionner ${champion.name}`)
                : `Slot ${slotIndex + 1}`}
            style={{
                width: W,
                border: `2px solid ${isDragOver ? '#f0d060' : selected ? color : champion ? color + '77' : '#252535'}`,
                borderRadius: 5,
                overflow: 'hidden',
                cursor: champion ? 'pointer' : 'default',
                background: isDragOver ? 'rgba(240,208,80,0.15)' : selected ? `${color}22` : '#0a080f',
                outline: selected ? `3px solid ${color}55` : 'none',
                outlineOffset: 2,
                transition: 'border-color 0.15s',
                userSelect: 'none',
            }}
        >
            {champion ? (
                <>
                    {/* Portrait — clipped to PORTRAIT_H, image centered horizontally */}
                    <div style={{ height: PORTRAIT_H, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                        <img src={champion.portrait} alt={champion.name} style={getPortraitStyle(W)} />
                    </div>
                    {/* HP / Stamina / Mana bars */}
                    {vitals ? (
                        <VitalsStrip
                            hp={vitals.hp}       maxHp={champion.health}
                            sta={vitals.stamina} maxSta={champion.stamina}
                            mana={vitals.mana}   maxMana={champion.mana}
                            food={vitals.food}   maxFood={MAX_FOOD}
                            water={vitals.water} maxWater={MAX_WATER}
                        />
                    ) : (
                        <div style={{ height: 23, background: '#060408' }} />
                    )}
                    {/* Name strip */}
                    <div style={{
                        textAlign: 'center', fontSize: 9, letterSpacing: 0.5,
                        color: selected ? color : '#887060', padding: '2px 0',
                        background: '#060408', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {champion.name.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', gap: 4, padding: 4, background: '#05030a' }}>
                        <HandSlot slotKey="leftHand" item={equip.leftHand} />
                        <HandSlot slotKey="rightHand" item={equip.rightHand} />
                    </div>
                </>
            ) : (
                <div style={{
                    height: PORTRAIT_H + 60, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#252535', fontSize: 18,
                }}>
                    {slotIndex + 1}
                </div>
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
    const fColor = FAMILY_COLORS[rune?.family ?? 'power'];

    return (
        <button
            onClick={onClick}
            title={rune?.name}
            style={{
                flex: '1 1 0',
                aspectRatio: '1',
                padding: 2,
                background: selected ? `${fColor}28` : 'rgba(8,6,20,0.9)',
                border: `1px solid ${selected ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.18)'}`,
                borderRadius: 3,
                cursor: 'pointer',
                outline: selected ? `2px solid ${fColor}70` : 'none',
                outlineOffset: 1,
                transition: 'background 0.1s',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 2,
                minWidth: 0,
            }}
        >
            <img
                src={`/runes/${runeId}.png`}
                alt={rune?.name}
                style={{ width: '74%', height: '74%', objectFit: 'contain' }}
                draggable={false}
            />
            <span style={{
                fontSize: 9, letterSpacing: 1,
                color: selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
                fontFamily: 'monospace', lineHeight: 1,
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
        disabled={disabled}
        title={title}
        style={{
            width: '100%', aspectRatio: '1',
            background: disabled
                ? 'rgba(10,8,18,0.75)'
                : flash ? 'rgba(220,195,110,0.40)' : 'rgba(14,10,26,0.90)',
            border: `1px solid ${disabled
                ? 'rgba(54,48,72,0.55)'
                : flash ? 'rgba(240,210,100,0.80)' : 'rgba(100,85,130,0.60)'}`,
            borderRadius: 6,
            color: disabled ? '#5a526c' : flash ? '#ffe898' : '#aa99cc',
            fontSize: 16, cursor: disabled ? 'default' : 'pointer', fontFamily: 'monospace',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.05s, border-color 0.05s, color 0.05s',
            opacity: disabled ? 0.7 : 1,
        }}
    >
        {label}
    </button>
);

const RUNE_FAMILIES: RuneFamily[] = ['power', 'element', 'form', 'alignment'];

// ─── HUD ──────────────────────────────────────────────────────────────────────
export const HUD = () => {
    const {
        party, level, position, direction,
        selectedChampionIndex, selectChampion, openPartyMember, reorderParty,
        moveForward, moveBackward, strafeLeft, strafeRight, turnLeft, turnRight,
        movementCooldown,
        championVitals, castSpell: storeCastSpell, lastCastResult,
        championXP, championCombat, attackFront, championEquipment,
    } = useStore();
    const currentMap = getGameMap(level);
    const globalX = (currentMap.mapOffset?.x ?? 0) + position[1];
    const globalY = (currentMap.mapOffset?.y ?? 0) + position[0];

    // ── Sound debug ─────────────────────────────────────────────────────────
    const [lastSound, setLastSound] = useState<string>('');
    useEffect(() => {
        return onSoundPlayed((name, file) => setLastSound(`${name} (${file})`));
    }, []);

    // ── Flash ───────────────────────────────────────────────────────────────
    const [flashKey, setFlashKey] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
            if (['INPUT', 'TEXTAREA', 'BUTTON'].includes((e.target as HTMLElement)?.tagName)) return;
            switch (e.key) {
                case 'ArrowUp':    case 'z': case 'Z': e.preventDefault(); move('fwd', moveForward);  break;
                case 'ArrowDown':  case 's': case 'S': e.preventDefault(); move('bck', moveBackward); break;
                case 'ArrowLeft':  case 'q': case 'Q': e.preventDefault(); flash('tl', turnLeft);     break;
                case 'ArrowRight': case 'd': case 'D': e.preventDefault(); flash('tr', turnRight);    break;
                case 'a': case 'A':                    e.preventDefault(); move('sl', strafeLeft);    break;
                case 'e': case 'E':                    e.preventDefault(); move('sr', strafeRight);   break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [flash, move, moveForward, moveBackward, turnLeft, turnRight, strafeLeft, strafeRight]);

    // ── Drag-and-drop (champion reorder) ────────────────────────────────────
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);



    // ── Rune state ──────────────────────────────────────────────────────────
    const [selectedRunes, setSelectedRunes] = useState<string[]>([]);
    const currentFamilyIdx = Math.min(selectedRunes.length, RUNE_FAMILIES.length - 1);
    const currentFamily = RUNE_FAMILIES[currentFamilyIdx];

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

    // Disable LANCER if no mana or insufficient mana for the matched spell
    const canCast = selectedRunes.length >= 2 && selectedChamp &&
        (spell ? (selectedVitals?.mana ?? 0) >= spell.manaCost : true);
    const movementBlocked = Number.isFinite(movementCooldown) && movementCooldown > 0;

    // ── Panel wrapper (subtle border/bg, no title) ──────────────────────────
    const panel: React.CSSProperties = {
        background: 'rgba(20,14,6,0.82)',
        border: '1px solid rgba(200,170,110,0.14)',
        borderRadius: 6, padding: '8px 10px', marginBottom: 6,
    };

    return (
        <div style={{
            position: 'fixed', right: 0, top: 0,
            width: '33vw', height: '100vh',
            background: 'rgba(38, 28, 12, 0.92)',
            borderLeft: '1px solid rgba(200,170,110,0.18)',
            display: 'flex', flexDirection: 'column',
            padding: '10px', boxSizing: 'border-box',
            fontFamily: '"Courier New", Courier, monospace',
            color: '#d8d0b8', zIndex: 100,
            overflow: 'hidden',
        }}>

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
                                    slotIndex={i}
                                    selected={selectedChampionIndex === i && !!party[i]}
                                    isDragOver={false}
                                    onSelect={() => selectChampion(i)}
                                    onOpenSheet={() => party[i] && openPartyMember(party[i].id)}
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
                            {selectedChamp.mana > 0 && selectedVitals && (
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
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {Array.from({ length: 4 }).map((_, i) => {
                        const runeId = selectedRunes[i];
                        const rune = runeId ? RUNES_BY_ID[runeId] : undefined;
                        const fColor = rune ? FAMILY_COLORS[rune.family] : undefined;
                        return (
                            <div
                                key={i}
                                onClick={() => runeId && setSelectedRunes(prev => prev.slice(0, i))}
                                title={runeId ? `Retirer ${rune?.name}` : `Slot ${i + 1}`}
                                style={{
                                    flex: 1,
                                    aspectRatio: '1 / 0.68',
                                    background: runeId ? `${fColor}20` : 'rgba(8,6,18,0.85)',
                                    border: `1px solid ${runeId ? 'rgba(255,255,255,0.5)' : '#252535'}`,
                                    borderRadius: 4,
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: 2,
                                    cursor: runeId ? 'pointer' : 'default', padding: 3,
                                }}
                            >
                                {runeId ? (
                                    <>
                                        <img src={`/runes/${runeId}.png`} alt=""
                                            style={{ width: '58%', height: '58%', objectFit: 'contain' }} />
                                        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', letterSpacing: 1, lineHeight: 1 }}>
                                            {rune?.name?.toUpperCase()}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ fontSize: 14, color: '#252535' }}>{i + 1}</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Spell name + cast/clear */}
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {spell ? (
                            <div style={{ fontSize: 12, color: '#f0c840', fontWeight: 'bold', letterSpacing: 0.5 }}>
                                {spell.name}
                                <span style={{ color: '#b09040', fontWeight: 'normal', fontSize: 10, marginLeft: 5 }}>
                                    {spell.manaCost} MP
                                </span>
                            </div>
                        ) : selectedRunes.length > 0 ? (
                            <div style={{ fontSize: 10, color: '#554444', fontStyle: 'italic' }}>combinaison inconnue</div>
                        ) : (
                            <div style={{ fontSize: 10, color: '#332840', fontStyle: 'italic' }}>sélectionner des runes…</div>
                        )}
                    </div>
                    <button onClick={handleCast} disabled={!canCast} style={{
                        padding: '4px 9px',
                        background: canCast ? 'rgba(200,100,0,0.55)' : 'rgba(12,8,24,0.85)',
                        border: `1px solid ${canCast ? '#e07818' : '#2a1a4a'}`,
                        borderRadius: 4,
                        color: canCast ? '#ffb040' : '#3a3050',
                        fontSize: 11, letterSpacing: 1,
                        cursor: canCast ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace', whiteSpace: 'nowrap',
                    }}>✦ LANCER</button>
                    <button onClick={clearRunes} disabled={selectedRunes.length === 0} style={{
                        padding: '4px 7px',
                        background: 'rgba(12,8,24,0.85)',
                        border: '1px solid #252535', borderRadius: 4,
                        color: selectedRunes.length > 0 ? '#776677' : '#252535',
                        fontSize: 11,
                        cursor: selectedRunes.length > 0 ? 'pointer' : 'default',
                        fontFamily: '"Courier New", monospace',
                    }}>✕</button>
                </div>

                {/* Family label */}
                <div style={{ fontSize: 9, letterSpacing: 2, marginBottom: 3, fontWeight: 'bold', color: FAMILY_COLORS[currentFamily] }}>
                    {FAMILY_LABELS[currentFamily]}
                </div>

                {/* Rune row */}
                <div style={{ display: 'flex', gap: 1 }}>
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
                            attackFront={attackFront}
                        />
                    </div>
                    <div style={{
                        flex: '0 0 96px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 4,
                        alignContent: 'center',
                    }}>
                        <MoveBtn label="↺" flash={flashKey === 'tl'}  title="Tourner gauche (Q)"  onClick={() => flash('tl',  turnLeft)} />
                        <MoveBtn label="↑" flash={flashKey === 'fwd'} title="Avancer (Z)"          onClick={() => move('fwd', moveForward)} disabled={movementBlocked} />
                        <MoveBtn label="↻" flash={flashKey === 'tr'}  title="Tourner droite (D)"  onClick={() => flash('tr',  turnRight)} />
                        <MoveBtn label="←" flash={flashKey === 'sl'}  title="Pas gauche (A)"       onClick={() => move('sl',  strafeLeft)} disabled={movementBlocked} />
                        <MoveBtn label="↓" flash={flashKey === 'bck'} title="Reculer (S)"          onClick={() => move('bck', moveBackward)} disabled={movementBlocked} />
                        <MoveBtn label="→" flash={flashKey === 'sr'}  title="Pas droite (E)"       onClick={() => move('sr',  strafeRight)} disabled={movementBlocked} />
                    </div>
                </div>
            </div>

            <div style={{ flex: 1 }} />

            {/* Debug */}
            <div style={{ fontSize: 10, color: '#993322', fontFamily: 'monospace', textAlign: 'center', opacity: 0.6 }}>
                [{globalX},{globalY}] {direction} · LVL {level}
            </div>
            <div style={{ fontSize: 9, color: '#7a4a24', fontFamily: 'monospace', textAlign: 'center', opacity: 0.5, marginTop: 2 }}>
                local [{position[1]},{position[0]}] · offset [{currentMap.mapOffset?.x ?? 0},{currentMap.mapOffset?.y ?? 0}]
            </div>
            {lastSound && (
                <div style={{ fontSize: 9, color: '#cc8833', fontFamily: 'monospace', textAlign: 'center', opacity: 0.7, marginTop: 2 }}>
                    ♪ {lastSound}
                </div>
            )}
        </div>
    );
};
