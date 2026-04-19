import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    useStore,
} from '../../engine/store';
import { playStep, playWallBump, onSoundPlayed } from '../../engine/sounds';
import type { ChampionCombat, ChampionTemporaryXP, ChampionXP, GameAction } from '../../engine/runtimeTypes';
import { getDisplayedItemName } from '../../data/itemDisplay';
import { WEAPON_TYPES, resolveItemName } from '../../data/items';
import { getGameMap } from '../../data/mapLoader';
import type { Champion } from '../../data/champions';
import type { ChampionEquipment } from '../../types/game';
import { getEquippedItemImage } from '../../data/itemImages';
import { formatKeybinding, matchesKeybinding, normalizeBindingKey } from '../../engine/options';
import { findSpell } from '../../data/runes';
import { itemsPath } from '../../data/assetPaths';
import { useI18n } from '../../i18n';
import { ManualModal } from './ManualModal';
import { HudMagicPanel } from './HudMagicPanel';
import { HudOptionsModal } from './HudOptionsModal';
import { HudPartyPanel } from './HudPartyPanel';
import {
    getAttackOptionUnusableReason,
    getWeaponAttackOptions,
    isAttackOptionUsableAtMastery,
    type WeaponAttackOption,
} from '../../data/weaponAttacks';
import { getChampionSkillLevel, mapOriginalSkillNumberToSkillKey } from '../../data/skillProgression';
import {
    buildChampionRecentDamageMap,
    buildHudCastState,
    buildCombatGridSlotState,
    buildHudFrontStateSummary,
    didPartyTakeSingleStep,
    selectHudRunes,
} from './hudDerivedState';

// Combat grid
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
    const direction = useStore((s) => s.direction);
    const emptyWeaponImage = itemsPath('hands_1.png');

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
                const getMasteryForAttack = (championId: number, attack: WeaponAttackOption) => {
                    if (!champ) return 0;
                    const skill = mapOriginalSkillNumberToSkillKey(attack.attack.skillNumber);
                    return getChampionSkillLevel(
                        championXP[championId],
                        championTemporaryXP[championId],
                        skill,
                    );
                };
                const slotState = buildCombatGridSlotState({
                    champion: champ,
                    championCombat,
                    championEquipment,
                    emptyWeaponImage,
                    fistLabel: text.fist,
                    direction,
                    resolveWeaponImage: (_championId, equipment) => {
                        const weapon = equipment.rightHand;
                        return weapon ? getEquippedItemImage(weapon, torchBurnStart) : emptyWeaponImage;
                    },
                    resolveWeaponName: (_championId, equipment, facingDirection) => {
                        const weapon = equipment.rightHand;
                        if (!weapon) return text.fist;
                        return weapon.category === 'Weapon'
                            ? (WEAPON_TYPES[weapon.typeId]?.name ?? weapon.rawName ?? '?')
                            : getDisplayedItemName(
                                resolveItemName(weapon.category, weapon.typeId, weapon.rawName),
                                weapon,
                                facingDirection,
                            );
                    },
                    getAllAttacks: (_championId, equipment) => getWeaponAttackOptions(equipment.rightHand),
                    getAttackMasteryLevel: getMasteryForAttack,
                });
                const { allAttacks, cooldownRatio, ready, usableAttacks, weaponImage, weaponName } = slotState;
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
                                            const masteryLevel = champ ? getMasteryForAttack(champ.id, attack) : 0;
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
                                                        ? `${attack.displayName} \u00b7 ${text.fatigue} ${attack.attack.staminaCost} \u00b7 ${text.speed} ${attack.attack.disableTime}/6s`
                                                        : `${attack.displayName} \u00b7 ${unusableReason ?? text.attackUnavailable}`}
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

// Portrait helper
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

type RebindingTarget = { action: GameAction; slot: 0 | 1 };

function isTextEntryTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

export const HUD = () => {
    const translations = useI18n();
    const text = translations.hud;
    const manual = translations.manual;
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
    const {
        frontGlobalX,
        frontGlobalY,
        frontLocalX,
        frontLocalY,
        frontState,
    } = buildHudFrontStateSummary({
        currentMap,
        level,
        position,
        direction,
        openDoors,
        openWalls,
        openPits,
    });
    const recentDamageByChampionId = buildChampionRecentDamageMap({
        party,
        damageEvents,
    });
    // Sound debug
    const [lastSound, setLastSound] = useState<string>('');
    useEffect(() => {
        return onSoundPlayed((name, file) => setLastSound(`${name} (${file})`));
    }, []);
    // Flash
    const [flashKey, setFlashKey] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousPartyStepRef = useRef<{ level: number; position: [number, number] } | null>({
        level,
        position,
    });
    const [rebindingTarget, setRebindingTarget] = useState<RebindingTarget | null>(null);
    const [tutorialModalOpen, setTutorialModalOpen] = useState(false);
    const [activeManualSectionId, setActiveManualSectionId] = useState<string | null>(manual.sections[0]?.id ?? null);
    const handleCloseOptionsModal = useCallback(() => {
        setRebindingTarget(null);
        closeOptionsModal();
    }, [closeOptionsModal]);
    useEffect(() => {
        const previousStep = previousPartyStepRef.current;
        if (didPartyTakeSingleStep({
            previousLevel: previousStep?.level ?? null,
            nextLevel: level,
            previousPosition: previousStep?.position ?? null,
            nextPosition: position,
        })) {
            playStep();
        }
        previousPartyStepRef.current = { level, position };
    }, [level, position]);

    const flash = useCallback((key: string, action: () => void) => {
        action();
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlashKey(key);
        flashTimer.current = setTimeout(() => setFlashKey(null), 150);
    }, []);

    // Like flash but also plays wall-bump feedback for blocked movement actions
    const move = useCallback((key: string, action: () => void) => {
        const cooldown = useStore.getState().movementCooldown;
        if (Number.isFinite(cooldown) && cooldown > 0) return;
        const posBefore = useStore.getState().position;
        action();
        const posAfter = useStore.getState().position;
        const moved = posAfter[0] !== posBefore[0] || posAfter[1] !== posBefore[1];
        if (!moved) playWallBump();
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
    // Drag-and-drop (champion reorder)
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
    // Rune state
    const [selectedRunes, setSelectedRunes] = useState<string[]>([]);

    const selectRune = (runeId: string) => {
        setSelectedRunes((prev) => selectHudRunes(prev, runeId));
    };
    const handleCast = () => {
        if (!castState.selectedChampion) return;
        storeCastSpell(castState.selectedChampion.id, selectedRunes);
        setSelectedRunes([]);
    };
    const clearRunes = () => setSelectedRunes([]);
    const castState = buildHudCastState({
        selectedRunes,
        selectedChampionIndex,
        party,
        championVitals,
        championCombat,
        findSpell,
        runeFamilyCount: 4,
    });
    const spell = castState.spell;
    const canCast = castState.canCast;
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
                onClick={() => {
                    setActiveManualSectionId((current) => current ?? manual.sections[0]?.id ?? null);
                    setTutorialModalOpen(true);
                }}
                title={text.helpButtonTitle}
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
                {'\u2699'}
            </button>

            <HudPartyPanel
                panelStyle={panel}
                party={party}
                championVitals={championVitals}
                championEquipment={championEquipment}
                recentDamageByChampionId={recentDamageByChampionId}
                selectedChampionIndex={selectedChampionIndex}
                activeFloorDrag={activeFloorDrag}
                dragFrom={dragFrom}
                dragOver={dragOver}
                itemDropOver={itemDropOver}
                handDropOver={handDropOver}
                setDragFrom={setDragFrom}
                setDragOver={setDragOver}
                setItemDropOver={setItemDropOver}
                setHandDropOver={setHandDropOver}
                selectChampion={selectChampion}
                openPartyMember={openPartyMember}
                reorderParty={reorderParty}
                pickupItemToChampion={pickupItemToChampion}
                endFloorDrag={endFloorDrag}
                giveItem={giveItem}
                giveEquippedItem={giveEquippedItem}
                equipItem={equipItem}
            />

            <HudMagicPanel
                panelStyle={panel}
                text={text}
                selectedRunes={selectedRunes}
                currentFamilyIdx={castState.currentFamilyIdx}
                spell={spell}
                canCast={canCast}
                lastCastResult={lastCastResult}
                onTruncateRunes={(slotIndex) => setSelectedRunes((prev) => prev.slice(0, slotIndex))}
                onSelectRune={selectRune}
                onCast={handleCast}
                onClear={clearRunes}
            />
            {/* Combat */}
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
                        <MoveBtn label={'\u21ba'} flash={flashKey === 'tl'}  title={`${text.actionLabels.turnLeft} (${formatKeybinding(gameOptions.keybindings.turnLeft)})`} onClick={() => flash('tl',  turnLeft)} />
                        <MoveBtn label={'\u2191'} flash={flashKey === 'fwd'} title={`${text.actionLabels.moveForward} (${formatKeybinding(gameOptions.keybindings.moveForward)})`} onClick={() => move('fwd', moveForward)} />
                        <MoveBtn label={'\u21bb'} flash={flashKey === 'tr'}  title={`${text.actionLabels.turnRight} (${formatKeybinding(gameOptions.keybindings.turnRight)})`} onClick={() => flash('tr',  turnRight)} />
                        <MoveBtn label={'\u2190'} flash={flashKey === 'sl'}  title={`${text.actionLabels.strafeLeft} (${formatKeybinding(gameOptions.keybindings.strafeLeft)})`} onClick={() => move('sl',  strafeLeft)} />
                        <MoveBtn label={'\u2193'} flash={flashKey === 'bck'} title={`${text.actionLabels.moveBackward} (${formatKeybinding(gameOptions.keybindings.moveBackward)})`} onClick={() => move('bck', moveBackward)} />
                        <MoveBtn label={'\u2192'} flash={flashKey === 'sr'}  title={`${text.actionLabels.strafeRight} (${formatKeybinding(gameOptions.keybindings.strafeRight)})`} onClick={() => move('sr',  strafeRight)} />
                    </div>
                </div>
            </div>

            <div style={{ flex: 1 }} />

            {/* Debug */}
            <div style={{ fontSize: 10, color: '#993322', fontFamily: 'monospace', textAlign: 'center', opacity: 0.6 }}>
                [g:{globalX},{globalY}] {direction} {'\u00b7'} LVL {level} {'\u00b7'} front [g:{frontGlobalX},{frontGlobalY} / l:{frontLocalX},{frontLocalY}] {'\u00b7'} {frontState}
            </div>
            <div style={{ fontSize: 9, color: '#7a4a24', fontFamily: 'monospace', textAlign: 'center', opacity: 0.5, marginTop: 2 }}>
                local [l:{position[1]},{position[0]}] {'\u00b7'} offset [{currentMap.mapOffset?.x ?? 0},{currentMap.mapOffset?.y ?? 0}]
            </div>
            {lastSound && (
                <div style={{ fontSize: 9, color: '#cc8833', fontFamily: 'monospace', textAlign: 'center', opacity: 0.7, marginTop: 2 }}>
                    {'\u266a'} {lastSound}
                </div>
            )}

            <HudOptionsModal
                open={optionsModalOpen}
                text={text}
                keybindings={gameOptions.keybindings}
                rebindingTarget={rebindingTarget}
                onClose={handleCloseOptionsModal}
                onToggleBinding={(target) => {
                    setRebindingTarget((current) =>
                        current?.action === target.action && current.slot === target.slot ? null : target,
                    );
                }}
            />
            {tutorialModalOpen && (
                <ManualModal
                    manual={manual}
                    text={text}
                    activeSectionId={activeManualSectionId}
                    onSelectSection={setActiveManualSectionId}
                    onClose={() => setTutorialModalOpen(false)}
                />
            )}
        </div>
    );
};
