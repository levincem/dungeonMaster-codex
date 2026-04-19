import React from 'react';
import type { Champion } from '../../data/champions';
import { canEquipItemInSlot } from '../../data/equipment';
import { miscPath } from '../../data/assetPaths';
import { getEquippedItemImage } from '../../data/itemImages';
import type { ChampionVitals } from '../../engine/runtimeTypes';
import { useStore } from '../../engine/store';
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

const HAND_SLOT_LABELS = {
    leftHand: 'MG',
    rightHand: 'MD',
} as const;

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
    const imageSrc = item ? getEquippedItemImage(item, torchBurnStart) : null;
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
                    ? (selected ? `Fiche de ${champion.name}` : `Selectionner ${champion.name}`)
                    : `Slot ${slotIndex + 1}`
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
    pickupItemToChampion: (itemId: string, championId: number) => void;
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
    const selectedChampion = party[selectedChampionIndex];
    const selectedVitals = selectedChampion ? championVitals[selectedChampion.id] : undefined;
    const selectedChampionClass = selectedChampion?.class ?? '';
    const selectedChampionColor = selectedChampionClass ? HUD_CLASS_COLORS[selectedChampionClass] : '#d8d0b8';

    return (
        <div style={panelStyle}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <div style={{ flex: '0 0 80%', display: 'flex', gap: 6, minWidth: 0 }}>
                    {[0, 1, 2, 3].map((index) => (
                        <div key={index} style={{ flex: '1 1 20%', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                            <ChampionCard
                                champion={party[index]}
                                vitals={party[index] ? championVitals[party[index].id] : undefined}
                                equip={party[index] ? (championEquipment[party[index].id] ?? {}) : {}}
                                recentDamage={party[index] ? (recentDamageByChampionId[party[index].id] ?? []) : []}
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
                                    pickupItemToChampion(activeFloorDrag.itemId, targetChampion.id);
                                    endFloorDrag();
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
                                    pickupItemToChampion(activeFloorDrag.itemId, targetChampion.id);
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

            {selectedChampion && (
                <div
                    style={{
                        marginTop: 7,
                        paddingTop: 6,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <span style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 1, color: selectedChampionColor }}>
                        {selectedChampion.name ?? ''}
                    </span>
                    <span style={{ fontSize: 10, color: '#887878', letterSpacing: 1 }}>
                        {selectedChampionClass.toUpperCase()}
                        {selectedVitals && (
                            <span style={{ color: '#5080c0', marginLeft: 7 }}>
                                {Math.floor(selectedVitals.mana)}/{selectedChampion.mana} MP
                            </span>
                        )}
                    </span>
                </div>
            )}
        </div>
    );
};
