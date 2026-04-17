import React, { useRef, useState } from 'react';
import { CHAMPIONS } from '../../data/champions';
import type { Champion } from '../../data/champions';
import { getGameMap } from '../../data/mapLoader';
import { getMechanismsAt } from '../../data/mechanisms';
import { hasOriginalWallOverlayAt } from '../../data/originalWallOverlays';
import { getDisplayedItemName } from '../../data/itemDisplay';
import { isAltarWallFace as isAltarWallFaceSystem } from '../../engine/systems/resurrection';
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
import { MISC_TYPES, getPotionDef, resolveItemName } from '../../data/items';
import type { Direction } from '../../engine/runtimeTypes';
import type { EquipSlotKey } from '../../types/items';
import type { FloorItem, ChampionEquipment } from '../../types/game';
import { getEquippedItemImage, getInventoryItemImage } from '../../data/itemImages';
import { canDrinkFromContainer, canFillWaterContainer, isWaterContainer } from '../../data/waterContainers';
import { miscPath } from '../../data/assetPaths';
import { playPlate } from '../../engine/sounds';
import { getDragPayload, setDragPayload, type DragPayload } from './dragPayload';
import { useI18n } from '../../i18n';
import {
    getEquippableSlots,
    getTotalWeight,
    getChampionMaxLoad,
    getEffectiveChampionStatsWithBonuses,
    hasAnyChampionWound,
} from '../../data/equipment';

// ─── Slot highlight animation ─────────────────────────────────────────────────
const PULSE_STYLE = `
@keyframes slot-pulse {
  0%,100% { box-shadow: 0 0 0 2px #e0c050, 0 0 6px 1px #e0a83066; }
  50%      { box-shadow: 0 0 0 2px #ffe080, 0 0 14px 4px #e0a830aa; }
}
.slot-valid { animation: slot-pulse 1s ease-in-out infinite; border-color: #e0c050 !important; }
`;

// ─── Skill level names (DM1 original) ─────────────────────────────────────────
const SKILL_LEVEL_NAMES: string[] = [
    'None', 'Novice', 'Apprentice', 'Neophyte', 'Journeyman',
    'Craftsman', 'Artisan', 'Adept', 'Expert', 'LoreKeeper',
    'Wizard', 'Artist', 'Champion', 'Hero', 'Master',
    'HighMaster', 'LegendMaster', 'ArchMaster', 'GrandMaster', 'TimeStone',
];

function getChampionPotionBonusesForSheet(
    champion: Champion,
    vitals: { currentStats?: Partial<{
        luck: number;
        strength: number;
        dexterity: number;
        wisdom: number;
        vitality: number;
        antiMagic: number;
        antiFire: number;
    }> } | undefined,
    activePotionBoosts: Array<{
        championId: number;
        stat: 'strength' | 'dexterity' | 'wisdom' | 'vitality' | 'antiMagic' | 'antiFire';
        amount: number;
        expiresAt: number;
    }>,
    championId: number,
) {
    const now = Date.now();
    const timedBonuses = activePotionBoosts.reduce(
        (sum, boost) => {
            if (boost.championId !== championId || boost.expiresAt <= now) return sum;
            return { ...sum, [boost.stat]: sum[boost.stat] + boost.amount };
        },
        {
            mana: 0,
            strength: 0,
            dexterity: 0,
            wisdom: 0,
            vitality: 0,
            antiMagic: 0,
            antiFire: 0,
            luck: 0,
        },
    );
    const currentStats = vitals?.currentStats;
    if (!currentStats) return timedBonuses;
    return {
        ...timedBonuses,
        strength: timedBonuses.strength + ((currentStats.strength ?? champion.strength) - champion.strength),
        dexterity: timedBonuses.dexterity + ((currentStats.dexterity ?? champion.dexterity) - champion.dexterity),
        wisdom: timedBonuses.wisdom + ((currentStats.wisdom ?? champion.wisdom) - champion.wisdom),
        vitality: timedBonuses.vitality + ((currentStats.vitality ?? champion.vitality) - champion.vitality),
        antiMagic: timedBonuses.antiMagic + ((currentStats.antiMagic ?? champion.antiMagic) - champion.antiMagic),
        antiFire: timedBonuses.antiFire + ((currentStats.antiFire ?? champion.antiFire) - champion.antiFire),
        luck: timedBonuses.luck + ((currentStats.luck ?? champion.luck) - champion.luck),
    };
}

function getSkillLevelName(xp: number): string {
    const lvl = xpToLevel(xp);
    return SKILL_LEVEL_NAMES[Math.min(lvl, SKILL_LEVEL_NAMES.length - 1)] ?? 'GrandMaster';
}

function formatWeight(value: number): string {
    return (Math.round(value * 10) / 10).toFixed(1);
}

function formatDisplayedStamina(value: number): string {
    return `${Math.max(0, Math.floor(value / 10))}`;
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
    parchment:   '#d4b87a',   // background parchment
    parchmentDk: '#b8963e',
    panelBg:     'rgba(0,0,0,0.84)',
    panelBorder: '#7a5c20',
    gold:        '#e0a830',
    goldDim:     '#8a6418',
    cream:       '#f0e0b0',
    creamDim:    '#b0904a',
    red:         '#d83030',
    green:       '#30b050',
    blue:        '#3080c8',
    yellow:      '#d4a820',
    slotBg:      'rgba(255,255,255,0.92)',
    slotBorder:  '#5a3e10',
    text:        '#f4dfa0',
};

function acceptDrag(event: React.DragEvent, onOver?: () => void): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onOver?.();
}

const SKILL_COLORS: Record<string, string> = {
    fighter: '#d04030',
    ninja:   '#40b060',
    priest:  '#4080c0',
    wizard:  '#8060c0',
};

// ─── Item helpers ─────────────────────────────────────────────────────────────
function getItemName(item: FloorItem, direction?: Direction): string {
    return getDisplayedItemName(
        resolveItemName(item.category, item.typeId, item.rawName),
        item,
        direction,
    );
}

function isConsumable(item: FloorItem): boolean {
    if (isWaterContainer(item)) return canDrinkFromContainer(item);
    if (canDrinkFromContainer(item)) return true;
    if (item.category === 'Potion') return !!getPotionDef(item.typeId, item.rawName)?.drinkable;
    if (item.category === 'Misc') return !!(MISC_TYPES[item.typeId]?.food);
    return false;
}

// ─── Drag/drop ────────────────────────────────────────────────────────────────
// ─── Item thumbnail ───────────────────────────────────────────────────────────
const ItemThumb: React.FC<{ item: FloorItem; size?: number; equipped?: boolean }> = ({ item, size = 32, equipped = false }) => {
    const torchBurnStart = useStore(s => s.torchBurnStart);
    const src = equipped
        ? getEquippedItemImage(item, torchBurnStart)
        : getInventoryItemImage(item);
    return (
        <img
            src={src}
            alt=""
            draggable={false}
            style={{
                width: size,
                height: size,
                objectFit: 'contain',
                imageRendering: 'crisp-edges',
                flexShrink: 0,
                pointerEvents: 'none',
                userSelect: 'none',
                position: 'absolute',
                inset: 0,
                margin: 'auto',
            }}
        />
    );
};

// ─── Vital bar ────────────────────────────────────────────────────────────────
const VitalBar: React.FC<{
    icon: string;
    label: string;
    value: number;
    max: number;
    color: string;
    frameColor?: string;
    displayValue?: string;
    displayMax?: string;
}> = ({ icon, label, value, max, color, frameColor, displayValue, displayMax }) => {
    const safeMax = Math.max(0, max);
    const fillPercent = safeMax > 0
        ? Math.max(0, Math.min(100, (value / safeMax) * 100))
        : 0;

    return (
    <div style={{ marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 15, lineHeight: 1, width: 18, textAlign: 'center' }}>{icon}</span>
            <span style={{ fontSize: 14, color: T.creamDim, letterSpacing: 1, flex: 1 }}>{label}</span>
            <span style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                {displayValue ?? Math.ceil(value)}
                <span style={{ fontSize: 12, color: T.creamDim, fontWeight: 'normal' }}>/{displayMax ?? safeMax}</span>
            </span>
        </div>
        <div style={{
            height: 9,
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 4,
            border: `1px solid ${frameColor ?? T.slotBorder}`,
            overflow: 'hidden',
            boxShadow: frameColor ? `0 0 0 1px ${frameColor}22` : undefined,
        }}>
            <div style={{ height: '100%', width: `${fillPercent}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 4, transition: 'width 0.3s ease', boxShadow: `0 0 5px ${color}55` }} />
        </div>
    </div>
    );
};

// ─── Equipment slot ───────────────────────────────────────────────────────────
const EquipSlot: React.FC<{
    slotKey: EquipSlotKey; item?: FloorItem; championId: number;
    size?: number; highlight?: boolean; wounded?: boolean;
    onDrop: (p: DragPayload, slot: EquipSlotKey) => void; onUnequip: () => void;
    onDragBegin?: (p: DragPayload) => void; onDragEnd?: () => void;
    labels: Record<EquipSlotKey, string>;
    unequipTitle: string;
}> = ({ slotKey, item, championId, size = 48, highlight = false, wounded = false, onDrop, onUnequip, onDragBegin, onDragEnd, labels, unequipTitle }) => {
    const [over, setOver] = useState(false);
    const borderColor = over ? T.gold : wounded ? T.red : item ? T.panelBorder : T.slotBorder;
    const emptyHandImageSrc = !item && (slotKey === 'leftHand' || slotKey === 'rightHand')
        ? miscPath(slotKey === 'leftHand' ? 'handLeft.png' : 'handRight.png')
        : null;
    const payload: DragPayload | null = item
        ? { itemId: item.id, fromChampionId: championId, fromSlot: slotKey }
        : null;
    return (
        <div
            className={highlight && !over ? 'slot-valid' : undefined}
            draggable={!!item}
            onDragStart={e => {
                if (!payload) return;
                setDragPayload(e, payload);
                onDragBegin?.(payload);
            }}
            onDragEnd={onDragEnd}
            style={{ width: size, height: size, border: `1px solid ${borderColor}`, borderRadius: 3, background: over ? 'rgba(255,248,230,0.98)' : T.slotBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: item ? 'grab' : 'default', position: 'relative', transition: over ? undefined : 'border-color 0.1s', padding: 2, boxSizing: 'border-box', boxShadow: wounded ? `0 0 10px ${T.red}55` : undefined }}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const p = getDragPayload(e); if (p) onDrop(p, slotKey); }}
        >
            <div style={{ fontSize: 7, color: T.goldDim, letterSpacing: 0.5, lineHeight: 1 }}>{labels[slotKey]}</div>
            {item ? (
                <>
                    <ItemThumb item={item} size={size - 16} equipped />
                    <button onClick={onUnequip} title={unequipTitle} draggable={false} style={{ position: 'absolute', top: 1, right: 2, background: 'none', border: 'none', color: T.goldDim, fontSize: 8, cursor: 'pointer', padding: 0, lineHeight: 1, zIndex: 2 }}>x</button>
                </>
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
                            width: size - 18,
                            height: size - 18,
                            border: `1px dashed ${wounded ? T.red : T.slotBorder}`,
                            borderRadius: 2,
                            opacity: wounded ? 0.65 : 0.35,
                            background: 'rgba(255,255,255,0.65)',
                            position: 'relative',
                            zIndex: 1,
                        }}
                    />
                </>
            )}
        </div>
    );
};

// ─── Scroll reader ─────────────────────────────────────────────────────────────
const ScrollPopup: React.FC<{
    item: FloorItem;
    onClose: () => void;
    text: ReturnType<typeof useI18n>['championSheet'];
}> = ({ item, onClose, text }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: 340, background: 'linear-gradient(160deg, #1a1408, #241c08)', border: `1px solid ${T.gold}`, borderRadius: 8, padding: 28, fontFamily: '"Courier New", monospace', color: T.cream }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: T.goldDim, textAlign: 'center', marginBottom: 14 }}>{text.scroll.toUpperCase()}</div>
            <div style={{ fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 18, color: T.gold }}>{getItemName(item)}</div>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: T.creamDim, textAlign: 'center', fontStyle: 'italic', whiteSpace: 'pre-line' }}>
                {item.rawName && !/^[A-Za-z]+_\d+$/.test(item.rawName) ? item.rawName : text.unreadableRunes}
            </div>
            <button onClick={onClose} style={{ display: 'block', margin: '20px auto 0', background: 'none', border: `1px solid ${T.goldDim}`, borderRadius: 4, color: T.goldDim, fontSize: 11, letterSpacing: 2, cursor: 'pointer', padding: '6px 20px', fontFamily: '"Courier New", monospace' }}>{text.close.toUpperCase()}</button>
        </div>
    </div>
);

// ─── Interactive drop zone (eye / mouth) ──────────────────────────────────────
const DropZone: React.FC<{ icon: React.ReactNode; label: string; title: string; borderColor: string; highlight?: boolean; onDrop: (p: DragPayload) => void }> = ({ icon, label, title, borderColor, highlight = false, onDrop }) => {
    const [over, setOver] = useState(false);
    return (
        <div title={title}
            className={highlight && !over ? 'slot-valid' : undefined}
            style={{ width: 48, height: 48, border: `1px solid ${over ? borderColor : T.slotBorder}`, borderRadius: 3, background: over ? 'rgba(30,15,0,0.9)' : 'rgba(0,0,0,0.58)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, cursor: 'default', transition: over ? undefined : 'border-color 0.1s', position: 'relative', zIndex: 3 }}
            onDragEnter={e => acceptDrag(e, () => setOver(true))}
            onDragOver={e => acceptDrag(e, () => setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); const p = getDragPayload(e); if (p) onDrop(p); }}
        >
            <span style={{ fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>{icon}</span>
            <span style={{ fontSize: 7, color: T.goldDim, letterSpacing: 1 }}>{label}</span>
        </div>
    );
};

const PartyMemberDropTarget: React.FC<{
    championId: number;
    other: Champion;
    onGiveInventory: (targetId: number, itemId: string) => void;
    onGiveEquipped: (targetId: number, slot: EquipSlotKey) => void;
    onOpen: (targetId: number) => void;
    title: string;
}> = ({ championId, other, onGiveInventory, onGiveEquipped, onOpen, title }) => {
    const [over, setOver] = useState(false);

    return (
        <div title={title}
            style={{ width: 84, border: `2px solid ${over ? T.gold : T.slotBorder}`, borderRadius: 4, background: over ? 'rgba(255,248,230,0.98)' : T.slotBg, cursor: over ? 'copy' : 'pointer', transition: 'border-color 0.12s', overflow: 'hidden' }}
            onClick={() => onOpen(other.id)}
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
                e.preventDefault();
                setOver(false);
                const p = getDragPayload(e);
                if (!p || p.fromChampionId !== championId) return;
                if (p.fromSlot === 'inventory') onGiveInventory(other.id, p.itemId);
                else onGiveEquipped(other.id, p.fromSlot as EquipSlotKey);
            }}
        >
            <img src={other.portrait} alt={other.name} style={{ width: 84, height: 84, objectFit: 'cover', objectPosition: 'top center', display: 'block', background: '#fff' }} />
            <div style={{ fontSize: 9, textAlign: 'center', padding: '5px 0', background: 'rgba(0,0,0,0.94)', letterSpacing: 1, color: T.gold }}>{other.name.substring(0, 9).toUpperCase()}</div>
        </div>
    );
};

// ─── Backpack (17 slots, 5 cols) ──────────────────────────────────────────────
const BACKPACK_SLOTS = 17;
const BackpackGrid: React.FC<{
    inv: FloorItem[]; equip: ChampionEquipment; champion: Champion;
    onEquip: (item: FloorItem) => void; onDropToFloor: (id: string) => void;
    onReadScroll: (item: FloorItem) => void; onUseItem: (id: string) => void;
    onUnequipToInventory: (e: React.DragEvent) => void;
    onItemDragStart: (p: DragPayload) => void; onItemDragEnd: () => void;
    direction: Direction;
    text: ReturnType<typeof useI18n>['championSheet'];
}> = ({ inv, champion, onEquip, onDropToFloor, onReadScroll, onUseItem, onUnequipToInventory, onItemDragStart, onItemDragEnd, direction, text }) => (
    <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
        onDragOver={e => e.preventDefault()} onDrop={onUnequipToInventory}
    >
        <div style={{ fontSize: 10, letterSpacing: 3, color: T.gold, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>{text.backpack.toUpperCase()}</span>
            <span style={{ color: inv.length >= BACKPACK_SLOTS ? T.red : T.creamDim, fontSize: 10 }}>{inv.length}/{BACKPACK_SLOTS}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {Array.from({ length: BACKPACK_SLOTS }).map((_, i) => {
                const item = inv[i];
                if (!item) return <div key={i} style={{ aspectRatio: '1', border: `1px dashed ${T.slotBorder}`, borderRadius: 3, background: T.slotBg, opacity: 0.72 }} />;
                return (
                    <div key={item.id} draggable
                        onDragStart={e => { const p: DragPayload = { itemId: item.id, fromChampionId: champion.id, fromSlot: 'inventory' }; setDragPayload(e, p); onItemDragStart(p); }}
                        onDragEnd={onItemDragEnd}
                        title={getItemName(item, direction)}
                        style={{ aspectRatio: '1', border: `1px solid ${T.slotBorder}`, borderRadius: 3, background: T.slotBg, cursor: 'grab', position: 'relative', overflow: 'hidden' }}>
                        <ItemThumb item={item} size={72} />
                        <div style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: '3px 3px 2px',
                            background: 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.88) 38%, rgba(0,0,0,0.94))',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}>
                            <div style={{ fontSize: 8, color: T.cream, textAlign: 'center', lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}>
                                {getItemName(item, direction).substring(0, 12)}
                            </div>
                            <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                                {getEquippableSlots(item).length > 0 && <button onClick={() => onEquip(item)} title={text.equip} style={{ background: T.goldDim, border: 'none', borderRadius: 2, color: '#000', fontSize: 7, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>↑</button>}
                                {item.category === 'Scroll' && <button onClick={() => onReadScroll(item)} title={text.read} style={{ background: '#4a3010', border: 'none', borderRadius: 2, color: T.cream, fontSize: 7, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>📜</button>}
                                {isConsumable(item) && <button onClick={() => onUseItem(item.id)} title={text.use} style={{ background: '#103010', border: 'none', borderRadius: 2, color: '#60d060', fontSize: 7, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>✓</button>}
                                <button onClick={() => onDropToFloor(item.id)} title={text.drop} style={{ background: '#180808', border: 'none', borderRadius: 2, color: T.red, fontSize: 7, cursor: 'pointer', padding: '1px 3px', lineHeight: 1 }}>↓</button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export const ChampionSheet: React.FC = () => {
    const text = useI18n().championSheet;
    const {
        activePartyMemberId, party, level, position, direction,
        closePartyMember, openPartyMember, removeFromParty,
        championInventories, championEquipment, championVitals, championXP, firedSensors,
        equipItem, unequipItem, dropItem, giveItem, giveEquippedItem, sleeping,
        useItem: consumeItem, fillWaterContainer, sleep, saveGame, showTransientMessage, useItemOnFrontWall: frontWallItemAction,
    } = useStore();
    const activePotionBoosts = useStore((s) => s.activePotionBoosts);

    const [scrollItem, setScrollItem] = useState<FloorItem | null>(null);
    const [draggingItem, setDraggingItem] = useState<FloorItem | null>(null);
    const [saveFlash, setSaveFlash] = useState(false);
    const saveFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const validSlots = new Set<EquipSlotKey>(draggingItem ? getEquippableSlots(draggingItem) : []);
    const highlightEye   = draggingItem?.category === 'Scroll';
    const highlightMouth = draggingItem ? isConsumable(draggingItem) : false;
    const highlightFountain = draggingItem ? canFillWaterContainer(draggingItem) : false;

    const handleDragBegin = (p: DragPayload, localEquip: ChampionEquipment, localInv: FloorItem[]) => {
        const item = p.fromSlot === 'inventory'
            ? localInv.find(i => i.id === p.itemId)
            : localEquip[p.fromSlot as EquipSlotKey];
        setDraggingItem(item ?? null);
    };
    const clearDragState = () => setDraggingItem(null);
    const handleDragEnd = () => clearDragState();
    const triggerSaveFeedback = () => {
        playPlate();
        if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current);
        setSaveFlash(true);
        saveFlashTimerRef.current = setTimeout(() => {
            setSaveFlash(false);
            saveFlashTimerRef.current = null;
        }, 180);
    };

    if (activePartyMemberId === null) return null;
    const champion = CHAMPIONS.find(c => c.id === activePartyMemberId);
    if (!champion) return null;

    const inv        = championInventories[champion.id] ?? [];
    const equip      = championEquipment[champion.id]   ?? {};
    const vitals     = championVitals[champion.id];
    const xp         = championXP?.[champion.id];
    const potionBonuses = getChampionPotionBonusesForSheet(champion, vitals, activePotionBoosts, champion.id);
    const effectiveStats = getEffectiveChampionStatsWithBonuses(champion, equip, potionBonuses);
    const weight     = getTotalWeight(equip, inv);
    const maxWeight  = getChampionMaxLoad(champion, equip, vitals?.stamina, vitals?.wounds, potionBonuses);
    const overloaded = weight > maxWeight;
    const loadWarn   = !overloaded && (weight * 8) > (maxWeight * 5);
    const loadColor  = overloaded ? T.red : loadWarn ? T.yellow : T.cream;
    const woundText  = hasAnyChampionWound(vitals?.wounds)
        ? [
            vitals?.wounds.legs ? text.injuredLegs : null,
            vitals?.wounds.feet ? text.injuredFeet : null,
        ].filter(Boolean).join(' · ')
        : '';

    const hp      = vitals?.hp      ?? champion.health;
    const stamina = vitals?.stamina ?? champion.stamina;
    const mana    = vitals?.mana    ?? effectiveStats.mana;
    const food    = vitals?.food    ?? MAX_FOOD;
    const water   = vitals?.water   ?? MAX_WATER;
    const foodFrame = food <= CRITICAL_FOOD_THRESHOLD ? '#b83a30' : food <= LOW_FOOD_THRESHOLD ? 'rgba(212, 168, 32, 0.7)' : undefined;
    const waterFrame = water <= CRITICAL_WATER_THRESHOLD ? '#b83a30' : water <= LOW_WATER_THRESHOLD ? 'rgba(212, 168, 32, 0.7)' : undefined;
    const frontTileY = direction === 'NORTH' ? position[0] - 1 : direction === 'SOUTH' ? position[0] + 1 : position[0];
    const frontTileX = direction === 'EAST' ? position[1] + 1 : direction === 'WEST' ? position[1] - 1 : position[1];
    const frontWallFace = direction === 'NORTH' ? 'South' : direction === 'SOUTH' ? 'North' : direction === 'EAST' ? 'West' : 'East';
    const frontTile = getGameMap(level).tiles[frontTileY]?.[frontTileX];
    const facingFountain = !!frontTile &&
        (frontTile.type === 'Wall' || frontTile.type === 'TrickWall') &&
        hasOriginalWallOverlayAt(level, frontTileX, frontTileY, frontWallFace, 'Fountain');
    const facingAltar = !!frontTile &&
        (frontTile.type === 'Wall' || frontTile.type === 'TrickWall') &&
        isAltarWallFaceSystem(level, frontTileX, frontTileY, frontWallFace, (mapLevel, tileX, tileY) => getGameMap(mapLevel).tiles[tileY]?.[tileX]);
    const frontWallItemMechanism = !!frontTile &&
        (frontTile.type === 'Wall' || frontTile.type === 'TrickWall')
        ? getMechanismsAt(level, frontTileX, frontTileY, frontWallFace).find((mechanism) =>
            mechanism.trigger === 'wall-lock' || mechanism.trigger === 'alcove' || mechanism.trigger === 'object-exchanger',
        ) ?? null
        : null;
    const canDismissChampion = level === 0 && !firedSensors.has('0_64');
    const getDraggedItem = (payload: DragPayload) => (
        payload.fromSlot === 'inventory'
            ? inv.find((item) => item.id === payload.itemId)
            : equip[payload.fromSlot as EquipSlotKey]
    );

    const handleDropOnSlot = (payload: DragPayload, targetSlot: EquipSlotKey) => {
        if (payload.fromChampionId !== champion.id) {
            giveItem(payload.fromChampionId, champion.id, payload.itemId);
            clearDragState();
            return;
        }
        if (payload.fromSlot === 'inventory') {
            const item = inv.find(i => i.id === payload.itemId);
            if (!item || !getEquippableSlots(item).includes(targetSlot)) return;
            equipItem(champion.id, targetSlot, payload.itemId);
            clearDragState();
        } else {
            const src = payload.fromSlot as EquipSlotKey;
            if (src === targetSlot) return;
            const srcItem = equip[src];
            if (!srcItem || !getEquippableSlots(srcItem).includes(targetSlot)) return;
            unequipItem(champion.id, src);
            equipItem(champion.id, targetSlot, srcItem.id);
            clearDragState();
        }
    };

    const handleUnequipToInventory = (e: React.DragEvent) => {
        e.preventDefault();
        const p = getDragPayload(e);
        if (!p || p.fromChampionId !== champion.id || p.fromSlot === 'inventory') return;
        unequipItem(champion.id, p.fromSlot as EquipSlotKey);
        clearDragState();
    };

    const handleEquipItem = (item: FloorItem) => {
        const slots = getEquippableSlots(item);
        const slot = slots.find(s => !equip[s]) ?? slots[0];
        if (slot) equipItem(champion.id, slot, item.id);
    };

    const handleConsume = (payload: DragPayload) => {
        consumeItem(champion.id, payload.itemId, payload.fromSlot);
        clearDragState();
    };

    const handleReadScroll = (payload: DragPayload) => {
        const item = getDraggedItem(payload);
        if (item?.category === 'Scroll') {
            setScrollItem(item);
            clearDragState();
        }
    };

    const handleFillAtFountain = (payload: DragPayload) => {
        if (!facingFountain) return;
        fillWaterContainer(champion.id, payload.itemId);
        clearDragState();
    };

    const handleUseOnWallMechanism = (payload: DragPayload) => {
        const used = frontWallItemAction(payload.fromChampionId, payload.itemId, payload.fromSlot);
        if (used) clearDragState();
    };

    const skills = [
        { key: 'fighter', label: text.skillLabels.fighter },
        { key: 'ninja',   label: text.skillLabels.ninja },
        { key: 'priest',  label: text.skillLabels.priest },
        { key: 'wizard',  label: text.skillLabels.wizard },
    ] as const;
    const slotLabels = text.slotLabels;

    // Equipment layout — 7 body slots only (no 'hands', no 'belt')
    const BODY_SLOTS: EquipSlotKey[] = ['head','neck','torso','rightHand','leftHand','legs','feet'];
    const QUIVER_SLOTS: EquipSlotKey[] = ['quiver1','quiver2','quiver3','quiver4'];
    const POCKET_SLOTS: EquipSlotKey[] = ['pocket1','pocket2'];
    const slotWounds: Partial<Record<EquipSlotKey, boolean>> = {
        head: vitals?.wounds.head,
        torso: vitals?.wounds.torso,
        rightHand: vitals?.wounds.rightHand,
        leftHand: vitals?.wounds.leftHand,
        legs: vitals?.wounds.legs,
        feet: vitals?.wounds.feet,
    };

    const otherMembers = party.filter(c => c.id !== champion.id);

    return (
        <div onClick={closePartyMember} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, fontFamily: '"Courier New", Courier, monospace' }}>
            <style>{PULSE_STYLE}</style>
            <div onClick={e => e.stopPropagation()} style={{
                width: 'min(1100px, 98vw)',
                maxHeight: '96vh',
                overflowY: 'auto',
                backgroundImage: `url(${miscPath('parchemin.png')})`,
                backgroundRepeat: 'repeat',
                backgroundSize: 'auto',
                border: `3px solid ${T.goldDim}`,
                borderRadius: 8,
                boxShadow: `0 0 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.15)`,
                padding: 16,
                color: T.text,
                position: 'relative',
            }}>
                {/* ── Header bar ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${T.goldDim}` }}>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1a0800', letterSpacing: 3, textShadow: '1px 1px 0 rgba(255,200,80,0.4)' }}>
                        {champion.name.toUpperCase()}
                        {champion.title && <span style={{ fontSize: 12, fontWeight: 'normal', color: T.goldDim, marginLeft: 12 }}>{champion.title}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                            data-sleep-toggle="true"
                            onClick={() => sleep()}
                            title={text.sleepTitle}
                            style={{
                                width: 36,
                                height: 36,
                                background: sleeping ? 'rgba(120,80,170,0.35)' : T.panelBg,
                                border: `1px solid ${sleeping ? T.gold : T.panelBorder}`,
                                borderRadius: 4,
                                color: T.cream,
                                fontSize: 18,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: sleeping ? '0 0 14px rgba(180,140,255,0.35)' : 'none',
                            }}
                        >
                            🛏
                        </button>
                        <button
                            onClick={() => {
                                triggerSaveFeedback();
                                const ok = saveGame();
                                showTransientMessage(ok ? text.saveSuccess : text.saveFailed, ok);
                            }}
                            title={text.saveGame}
                            style={{
                                width: 36,
                                height: 36,
                                background: saveFlash ? 'rgba(255,245,210,0.96)' : T.panelBg,
                                border: `1px solid ${saveFlash ? T.gold : T.panelBorder}`,
                                borderRadius: 4,
                                color: saveFlash ? '#1a1204' : T.cream,
                                fontSize: 18,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: saveFlash ? '0 0 12px rgba(208,168,80,0.55)' : 'none',
                                transform: saveFlash ? 'scale(0.96)' : 'scale(1)',
                                transition: 'background 0.08s, border-color 0.08s, color 0.08s, box-shadow 0.08s, transform 0.08s',
                            }}
                        >
                            💾
                        </button>
                        <button onClick={closePartyMember} style={{ width: 36, height: 36, background: 'none', border: 'none', color: T.goldDim, fontSize: 28, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                </div>

                {/* ── 3-column ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr 500px', gap: 12, alignItems: 'start' }}>

                    {/* ── COL 1: Portrait + Vitals + Stats ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch' }}>

                        {/* Portrait — fills available space */}
                        <div style={{ background: '#ffffff', border: `1px solid ${T.panelBorder}`, borderRadius: 5, overflow: 'hidden', minHeight: 198, height: 198, flex: '0 0 auto' }}>
                            <img src={champion.portrait} alt={champion.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }} />
                        </div>

                        {/* Vitals */}
                        <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 5, padding: '10px 12px' }}>
                            <VitalBar icon="❤" label={text.health} value={hp} max={champion.health} color={T.red} />
                            <VitalBar
                                icon="⚡"
                                label={text.stamina}
                                value={stamina}
                                max={champion.stamina}
                                color={T.yellow}
                                displayValue={formatDisplayedStamina(stamina)}
                                displayMax={formatDisplayedStamina(champion.stamina)}
                            />
                            <VitalBar icon="🍗" label={text.hunger} value={food} max={MAX_FOOD} color="#d88b2d" frameColor={foodFrame} />
                            <VitalBar icon="💧" label={text.thirst} value={water} max={MAX_WATER} color="#3aa0d8" frameColor={waterFrame} />
                            <VitalBar icon="🔮" label="MANA" value={mana} max={effectiveStats.mana} color={T.blue} />
                        </div>

                        {/* Base stats */}
                        <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 5, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, letterSpacing: 3, color: T.gold, marginBottom: 8 }}>{text.attributes}</div>
                            {[
                                { label: text.statLabels.strength, val: effectiveStats.strength,  color: T.red    },
                                { label: text.statLabels.dexterity, val: effectiveStats.dexterity, color: T.green  },
                                { label: text.statLabels.wisdom, val: effectiveStats.wisdom, color: T.blue   },
                                { label: text.statLabels.vitality, val: effectiveStats.vitality, color: T.yellow },
                                { label: text.statLabels.luck, val: effectiveStats.luck, color: T.gold   },
                                { label: text.statLabels.antiMagic, val: effectiveStats.antiMagic, color: '#60c0a0'},
                                { label: text.statLabels.antiFire, val: effectiveStats.antiFire, color: '#d08030'},
                            ].map(s => (
                                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 12, color: T.creamDim }}>{s.label}</span>
                                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                        <div style={{ width: 50, height: 3, background: 'rgba(0,0,0,0.4)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, s.val))}%`, background: s.color, borderRadius: 2 }} />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 'bold', color: s.color, minWidth: 24, textAlign: 'right' }}>{s.val}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    {/* ── COL 2: Equipment silhouette ── */}
                    <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 5, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>

                        {/* Header: title + weight on same line */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 10, letterSpacing: 3, color: T.gold }}>{text.equipment}</span>
                            <span style={{ fontSize: 11, fontWeight: 'bold', color: loadColor }}>
                                ⚖ {formatWeight(weight)}<span style={{ fontSize: 10, color: T.creamDim, fontWeight: 'normal' }}>/{formatWeight(maxWeight)} kg</span>{overloaded && <span style={{ color: T.red }}> ⚠</span>}
                            </span>
                        </div>

                        {woundText && (
                            <div style={{ marginTop: -2, marginBottom: 4, fontSize: 9, color: '#d88b2d', letterSpacing: 1 }}>
                                {woundText.toUpperCase()}
                            </div>
                        )}
                        {/* Eye + Context + Mouth */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, marginBottom: 0, position: 'relative', zIndex: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 18 }}>
                                <DropZone
                                    icon={<img src={miscPath('eye.png')} alt="" draggable={false} style={{ width: 22, height: 22, objectFit: 'contain', imageRendering: 'crisp-edges' }} />}
                                    label={text.readDropZone}
                                    title={text.readDropZoneTitle}
                                    borderColor="#d4a840"
                                    highlight={highlightEye}
                                    onDrop={handleReadScroll}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', minHeight: 48 }}>
                                {facingFountain ? (
                                    <DropZone
                                        icon="??"
                                        label={text.fountain}
                                        title={text.fountainTitle}
                                        borderColor="#3aa0d8"
                                        highlight={highlightFountain}
                                        onDrop={handleFillAtFountain}
                                    />
                                ) : facingAltar ? (
                                    <DropZone
                                        icon="VI"
                                        label={text.altar}
                                        title={text.altarTitle}
                                        borderColor="#d4a840"
                                        onDrop={handleUseOnWallMechanism}
                                    />
                                ) : frontWallItemMechanism ? (
                                    <DropZone
                                        icon={frontWallItemMechanism.trigger === 'alcove' ? '??' : frontWallItemMechanism.trigger === 'object-exchanger' ? '??' : '??'}
                                        label={frontWallItemMechanism.trigger === 'alcove' ? text.alcove : frontWallItemMechanism.trigger === 'object-exchanger' ? text.receptacle : text.lock}
                                        title={frontWallItemMechanism.trigger === 'alcove'
                                            ? text.alcoveTitle
                                            : frontWallItemMechanism.trigger === 'object-exchanger'
                                                ? text.receptacleTitle
                                                : text.lockTitle}
                                        borderColor="#d4a840"
                                        onDrop={handleUseOnWallMechanism}
                                    />
                                ) : null}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 18 }}>
                                <DropZone
                                    icon={<img src={miscPath('mouth.png')} alt="" draggable={false} style={{ width: 22, height: 22, objectFit: 'contain', imageRendering: 'crisp-edges' }} />}
                                    label={text.eat}
                                    title={text.eatTitle}
                                    borderColor="#d04040"
                                    highlight={highlightMouth}
                                    onDrop={handleConsume}
                                />
                            </div>
                        </div>

                        {/* Equipment grid with silhouette */}

                        <div style={{ position: 'relative', marginTop: -36 }}>
                            {/* Silhouette */}

                            {/* Slots grid — quivers under rhand, pockets under lhand */}
                            <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateAreas: `
                                ". head ."
                                ". neck ."
                                "lhand torso rhand"
                                "pockets legs quivers"
                                ". feet ."
                            `, gridTemplateColumns: '112px 112px 112px', justifyContent: 'center', gap: 8 }}>

                                {/* Body slots */}
                                {BODY_SLOTS.map(s => (
                                    <div key={s} style={{ gridArea: s === 'rightHand' ? 'rhand' : s === 'leftHand' ? 'lhand' : s, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <EquipSlot slotKey={s} item={equip[s]} championId={champion.id} size={112} highlight={validSlots.has(s)} wounded={!!slotWounds[s]} labels={slotLabels} unequipTitle={text.unequip}
                                            onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)}
                                            onDragBegin={p => handleDragBegin(p, equip, inv)} onDragEnd={handleDragEnd} />
                                    </div>
                                ))}

                                {/* Quivers: 2×2 under right hand */}
                                <div style={{ gridArea: 'quivers', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <div style={{ fontSize: 8, color: T.goldDim, letterSpacing: 2 }}>{text.quivers}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                                        {QUIVER_SLOTS.map(s => <EquipSlot key={s} slotKey={s} item={equip[s]} championId={champion.id} size={54} highlight={validSlots.has(s)} labels={slotLabels} unequipTitle={text.unequip}
                                            onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)}
                                            onDragBegin={p => handleDragBegin(p, equip, inv)} onDragEnd={handleDragEnd} />)}
                                    </div>
                                </div>

                                {/* Pockets: 1×2 under left hand */}
                                <div style={{ gridArea: 'pockets', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <div style={{ fontSize: 8, color: T.goldDim, letterSpacing: 2 }}>{text.pouches}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                                        {POCKET_SLOTS.map(s => <EquipSlot key={s} slotKey={s} item={equip[s]} championId={champion.id} size={54} highlight={validSlots.has(s)} labels={slotLabels} unequipTitle={text.unequip}
                                            onDrop={handleDropOnSlot} onUnequip={() => unequipItem(champion.id, s)}
                                            onDragBegin={p => handleDragBegin(p, equip, inv)} onDragEnd={handleDragEnd} />)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skills block — below equipment silhouette */}
                    </div>


                    {/* ── COL 3: Backpack + Team portraits ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <BackpackGrid
                            inv={inv} equip={equip} champion={champion}
                            onEquip={handleEquipItem}
                            onDropToFloor={id => dropItem(id, champion.id)}
                            onReadScroll={setScrollItem}
                            onUseItem={id => consumeItem(champion.id, id)}
                            onUnequipToInventory={handleUnequipToInventory}
                            onItemDragStart={p => handleDragBegin(p, equip, inv)}
                            onItemDragEnd={handleDragEnd}
                            direction={direction}
                            text={text}
                        />

                        <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, letterSpacing: 3, color: T.gold, marginBottom: 10 }}>{text.classes}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 18px' }}>
                                {skills.map(({ key, label }) => {
                                    const skillXP = xp?.[key] ?? 0;
                                    const name = getSkillLevelName(skillXP);
                                    const color = SKILL_COLORS[key];
                                    if (name === 'None') return null;
                                    return (
                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 2 }}>
                                            <span style={{ fontSize: 14, color: T.creamDim }}>{label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 'bold', color }}>{name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {skills.every(({ key }) => (xp?.[key] ?? 0) === 0) && (
                                <div style={{ fontSize: 14, color: T.goldDim, fontStyle: 'italic' }}>{text.beginner}</div>
                            )}
                        </div>
                        {otherMembers.length > 0 && (
                            <div style={{ background: T.panelBg, border: `1px solid ${T.panelBorder}`, borderRadius: 6, padding: '10px 12px', minHeight: 118, display: 'flex', alignItems: 'center' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 84px)', gap: 10, alignItems: 'start', width: '100%', justifyContent: 'space-between' }}>
                                    {otherMembers.map(other => (
                                        <PartyMemberDropTarget
                                            key={other.id}
                                            championId={champion.id}
                                            other={other}
                                            onGiveInventory={(targetId, itemId) => giveItem(champion.id, targetId, itemId)}
                                            onGiveEquipped={(targetId, slot) => giveEquippedItem(champion.id, slot, targetId)}
                                            onOpen={openPartyMember}
                                            title={text.giveTo(other.name)}
                                        />
                                    ))}
                                    <DungeonHandoffTarget
                                        label={text.dungeon}
                                        title={text.dungeonDropTitle}
                                        onHandoff={() => {
                                            clearDragState();
                                            closePartyMember();
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {canDismissChampion && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.goldDim}`, display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => { removeFromParty(champion.id); closePartyMember(); }}
                            style={{ padding: '6px 14px', background: 'rgba(80,10,10,0.8)', border: `1px solid ${T.red}`, borderRadius: 4, color: '#ffaaaa', fontSize: 11, letterSpacing: 2, cursor: 'pointer', fontFamily: '"Courier New", monospace' }}>
                            {text.dismiss}
                        </button>
                    </div>
                )}
            </div>

            {scrollItem && <ScrollPopup item={scrollItem} onClose={() => setScrollItem(null)} text={text} />}
        </div>
    );
};

const DungeonHandoffTarget: React.FC<{
    label: string;
    title: string;
    onHandoff: () => void;
}> = ({ label, title, onHandoff }) => {
    const [over, setOver] = useState(false);

    const triggerHandoff = (e: React.DragEvent) => {
        const payload = getDragPayload(e);
        if (!payload) return;
        e.preventDefault();
        setOver(true);
        onHandoff();
    };

    return (
        <div
            title={title}
            style={{
                width: 84,
                border: `2px solid ${over ? T.gold : T.slotBorder}`,
                borderRadius: 4,
                background: over
                    ? 'linear-gradient(180deg, rgba(255,248,230,0.98), rgba(214,190,138,0.94))'
                    : 'linear-gradient(180deg, rgba(31,24,13,0.96), rgba(12,10,8,0.98))',
                cursor: 'alias',
                transition: 'border-color 0.12s, background 0.12s',
                overflow: 'hidden',
                boxShadow: over ? '0 0 14px rgba(224,168,48,0.28)' : 'inset 0 0 18px rgba(0,0,0,0.35)',
            }}
            onDragEnter={triggerHandoff}
            onDragOver={triggerHandoff}
            onDragLeave={() => setOver(false)}
        >
            <div style={{
                width: 84,
                height: 84,
                position: 'relative',
                background: over
                    ? 'linear-gradient(180deg, #74603a 0%, #2d2518 100%)'
                    : 'linear-gradient(180deg, #4b3b22 0%, #17130d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{
                    position: 'absolute',
                    inset: 10,
                    border: `2px solid ${over ? '#f3d27a' : '#8a6418'}`,
                    borderRadius: 6,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.4)',
                }} />
                <div style={{
                    position: 'relative',
                    width: 34,
                    height: 44,
                    borderRadius: '18px 18px 6px 6px',
                    background: over ? '#0f1216' : '#050608',
                    border: `2px solid ${over ? '#f3d27a' : '#a27a2a'}`,
                    boxShadow: `0 0 14px ${over ? 'rgba(243,210,122,0.22)' : 'rgba(0,0,0,0.4)'}`,
                }}>
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 8,
                        width: 4,
                        height: 20,
                        transform: 'translateX(-50%)',
                        background: over ? 'rgba(243,210,122,0.5)' : 'rgba(255,214,120,0.16)',
                        borderRadius: 999,
                    }} />
                    <div style={{
                        position: 'absolute',
                        left: 7,
                        right: 7,
                        bottom: 6,
                        height: 6,
                        background: over ? '#3b4a58' : '#23303a',
                        borderRadius: 999,
                    }} />
                </div>
            </div>
            <div style={{ fontSize: 9, textAlign: 'center', padding: '5px 0', background: 'rgba(0,0,0,0.94)', letterSpacing: 1, color: T.gold }}>
                {label}
            </div>
        </div>
    );
};
