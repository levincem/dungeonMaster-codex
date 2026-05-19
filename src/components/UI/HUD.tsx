import React, { Suspense, lazy, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
    useStore,
} from '../../engine/store';
import { playStep, playWallBump } from '../../engine/sounds';
import type { ChampionCombat, ChampionTemporaryXP, ChampionXP, GameAction } from '../../engine/runtimeTypes';
import { getDisplayedItemName } from '../../data/itemDisplay';
import { isChargeDepleted } from '../../data/itemChargeState';
import { WEAPON_TYPES, resolveItemName } from '../../data/items';
import { getGameMap } from '../../data/mapLoader';
import type { Champion } from '../../data/champions';
import type { ChampionEquipment } from '../../types/game';
import { getEquippedItemImage } from '../../data/itemImages';
import { getPreferredCombatItem, QUIVER_SLOT_KEYS } from '../../data/equipment';
import { formatKeybinding, matchesKeybinding, normalizeBindingKey } from '../../engine/options';
import { importPersistedSave } from '../../engine/saveGame';
import { findSpell, getOriginalPreparedRuneManaCost, getOriginalRuneSelectionManaCost } from '../../data/runes';
import { itemsPath } from '../../data/assetPaths';
import { setLocale, useI18n, useLocale } from '../../i18n';
import { getActionCharges } from '../../engine/systems/storeCombatRuntime';
import { HudMagicPanel } from './HudMagicPanel';
import { HudPartyPanel } from './HudPartyPanel';
import { MinimapOverlay } from './MinimapOverlay';
import {
    getWeaponAttackOptions,
    getRequiredAmmoRawClass,
    isPhysicalAttack,
    isShootAttack,
    isThrowAttack,
    matchesRequiredAmmoRawClass,
    type WeaponAttackOption,
} from '../../data/weaponAttacks';
import { BASIC_SKILL_KEYS, getChampionSkillLevel, mapOriginalSkillNumberToSkillKey } from '../../data/skillProgression';
import {
    buildChampionRecentDamageMap,
    buildHudCastState,
    buildCombatGridSlotState,
    buildHudFrontStateSummary,
    didPartyTakeSingleStep,
    getPreparedHudRunes,
    prunePreparedHudRunes,
    setPreparedHudRunes,
} from './hudDerivedState';
import { recordChampionStatHighlights, type HighlightStatKey } from './championStatHighlights';
import { isChampionInRearRank, resolveAttackFrontContext } from '../../engine/systems/attackFrontContext';

const ManualModal = lazy(() =>
    import('./ManualModal').then((module) => ({ default: module.ManualModal })),
);

const HudOptionsModal = lazy(() =>
    import('./HudOptionsModal').then((module) => ({ default: module.HudOptionsModal })),
);

const DEV_PERF_PANEL_ENABLED = import.meta.env.DEV;

type DevPerformanceSnapshot = {
    fps: number | null;
    frameMs: number | null;
    heapUsedMb: number | null;
};

const DevPerformancePanel: React.FC = () => {
    const {
        level,
        creatures,
        floorItems,
        projectiles,
        activePoisonClouds,
        hydratedLevels,
        pendingGeneratorSpawns,
        gamePhase,
        paused,
    } = useStore(useShallow((state) => ({
        level: state.level,
        creatures: state.creatures,
        floorItems: state.floorItems,
        projectiles: state.projectiles,
        activePoisonClouds: state.activePoisonClouds,
        hydratedLevels: state.hydratedLevels,
        pendingGeneratorSpawns: state.pendingGeneratorSpawns,
        gamePhase: state.gamePhase,
        paused: state.paused,
    })));

    const [snapshot, setSnapshot] = useState<DevPerformanceSnapshot>({
        fps: null,
        frameMs: null,
        heapUsedMb: null,
    });

    useEffect(() => {
        let rafId = 0;
        let cancelled = false;
        let lastTs: number | null = null;
        let lastCommitTs = 0;
        const samples: number[] = [];
        const MAX_SAMPLES = 45;

        const readHeapUsedMb = () => {
            type PerformanceWithMemory = Performance & {
                memory?: {
                    usedJSHeapSize?: number;
                };
            };
            const memory = (performance as PerformanceWithMemory).memory;
            const bytes = memory?.usedJSHeapSize;
            return typeof bytes === 'number' ? Math.round((bytes / (1024 * 1024)) * 10) / 10 : null;
        };

        const tick = (ts: number) => {
            if (cancelled) return;

            if (lastTs !== null) {
                const deltaMs = ts - lastTs;
                if (Number.isFinite(deltaMs) && deltaMs > 0) {
                    samples.push(deltaMs);
                    if (samples.length > MAX_SAMPLES) samples.shift();
                }
            }
            lastTs = ts;

            if ((ts - lastCommitTs) >= 500) {
                const averageFrameMs = samples.length > 0
                    ? samples.reduce((sum, value) => sum + value, 0) / samples.length
                    : null;
                setSnapshot({
                    frameMs: averageFrameMs !== null ? Math.round(averageFrameMs * 10) / 10 : null,
                    fps: averageFrameMs !== null && averageFrameMs > 0
                        ? Math.round((1000 / averageFrameMs) * 10) / 10
                        : null,
                    heapUsedMb: readHeapUsedMb(),
                });
                lastCommitTs = ts;
            }

            rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
        return () => {
            cancelled = true;
            window.cancelAnimationFrame(rafId);
        };
    }, []);

    const counts = useMemo(() => {
        let aliveCreatures = 0;
        let creaturesOnLevel = 0;
        let aliveCreaturesOnLevel = 0;
        for (const creature of creatures) {
            if (creature.alive) aliveCreatures += 1;
            if (creature.mapIndex !== level) continue;
            creaturesOnLevel += 1;
            if (creature.alive) aliveCreaturesOnLevel += 1;
        }

        let floorItemsOnLevel = 0;
        for (const item of floorItems) {
            if (item.mapIndex === level) floorItemsOnLevel += 1;
        }

        let projectilesOnLevel = 0;
        for (const projectile of projectiles) {
            if (projectile.level === level) projectilesOnLevel += 1;
        }

        let poisonCloudsOnLevel = 0;
        for (const cloud of activePoisonClouds) {
            if (cloud.level === level) poisonCloudsOnLevel += 1;
        }

        let pendingSpawnsOnLevel = 0;
        for (const spawn of pendingGeneratorSpawns) {
            if (
                spawn &&
                typeof spawn === 'object' &&
                'level' in spawn &&
                typeof spawn.level === 'number' &&
                spawn.level === level
            ) {
                pendingSpawnsOnLevel += 1;
            }
        }

        const hydratedLevelList = [...hydratedLevels].sort((left, right) => left - right);
        return {
            aliveCreatures,
            creaturesOnLevel,
            aliveCreaturesOnLevel,
            floorItemsOnLevel,
            projectilesOnLevel,
            poisonCloudsOnLevel,
            pendingSpawnsOnLevel,
            hydratedLevelList,
        };
    }, [activePoisonClouds, creatures, floorItems, hydratedLevels, level, pendingGeneratorSpawns, projectiles]);

    return (
        <div
            style={{
                position: 'fixed',
                top: 12,
                right: 12,
                zIndex: 420,
                minWidth: 220,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(8, 10, 14, 0.82)',
                border: '1px solid rgba(186, 162, 108, 0.35)',
                color: '#d9c89a',
                fontFamily: '"Courier New", monospace',
                fontSize: 11,
                lineHeight: 1.35,
                whiteSpace: 'pre-line',
                pointerEvents: 'none',
                userSelect: 'text',
                boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
            }}
        >
            {[
                `DEV PERF | lvl ${level} | ${gamePhase}${paused ? ' (paused)' : ''}`,
                `fps ${snapshot.fps?.toFixed(1) ?? '--'} | frame ${snapshot.frameMs?.toFixed(1) ?? '--'} ms | heap ${snapshot.heapUsedMb?.toFixed(1) ?? '--'} MB`,
                `creatures ${counts.aliveCreatures}/${creatures.length} alive | here ${counts.aliveCreaturesOnLevel}/${counts.creaturesOnLevel}`,
                `floor items ${floorItems.length} total | here ${counts.floorItemsOnLevel}`,
                `projectiles ${projectiles.length} total | here ${counts.projectilesOnLevel}`,
                `poison clouds ${activePoisonClouds.length} total | here ${counts.poisonCloudsOnLevel}`,
                `pending spawns ${pendingGeneratorSpawns.length} total | here ${counts.pendingSpawnsOnLevel}`,
                `hydrated ${hydratedLevels.size}: [${counts.hydratedLevelList.map((entry) => entry + 1).join(', ')}]`,
            ].join('\n')}
        </div>
    );
};

// Combat grid
const CombatGrid: React.FC<{
    party: Champion[];
    championCombat: Record<number, ChampionCombat>;
    championEquipment: Record<number, ChampionEquipment>;
    championXP: Record<number, ChampionXP>;
    championTemporaryXP: Record<number, ChampionTemporaryXP>;
    attackFront: (id: number, attackType?: number) => void;
}> = ({ party, championCombat, championEquipment, championXP, championTemporaryXP, attackFront }) => {
    const i18n = useI18n();
    const text = i18n.hud;
    const runtimeText = i18n.runtime;
    const [flash, setFlash] = useState([false, false, false, false]);
    const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
    const torchBurnStart = useStore((s) => s.torchBurnStart);
    const paused = useStore((s) => s.paused);
    const pausedAt = useStore((s) => s.pausedAt ?? null);
    const direction = useStore((s) => s.direction);
    const level = useStore((s) => s.level);
    const position = useStore((s) => s.position);
    const creatures = useStore((s) => s.creatures);
    const emptyWeaponImage = itemsPath('hands_1.png');
    const weaponImageNow = paused && typeof pausedAt === 'number' ? pausedAt : Date.now();

    const resolveCombatItem = (equipment: ChampionEquipment | undefined) => getPreferredCombatItem(equipment, {
        getWeaponAttackOptions,
        isThrowAttack,
    })?.item;

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
        if (allAttacks.length === 1) {
            triggerAttack(i, champ, (usableAttacks[0] ?? allAttacks[0]).attackType);
            return;
        }
        setOpenMenuIndex((current) => current === i ? null : i);
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 126px)', gap: 10, justifyContent: 'start' }}>
            {[0, 1, 2, 3].map(i => {
                const champ = party[i];
                const frontAttackContext = champ
                    ? resolveAttackFrontContext(level, position, direction, creatures, party, champ.id)
                    : null;
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
                        const weapon = resolveCombatItem(equipment);
                        return weapon ? getEquippedItemImage(weapon, torchBurnStart, weaponImageNow) : emptyWeaponImage;
                    },
                    resolveWeaponName: (_championId, equipment, facingDirection) => {
                        const weapon = resolveCombatItem(equipment);
                        if (!weapon) return text.fist;
                        return weapon.category === 'Weapon'
                            ? (WEAPON_TYPES[weapon.typeId]?.name ?? weapon.rawName ?? '?')
                            : getDisplayedItemName(
                                resolveItemName(weapon.category, weapon.typeId, weapon.rawName),
                                weapon,
                                facingDirection,
                            );
                    },
                    getAllAttacks: (_championId, equipment) => getWeaponAttackOptions(resolveCombatItem(equipment)),
                    getAttackMasteryLevel: getMasteryForAttack,
                    getAttackBlockedReason: (championId, equipment, attack) => {
                        const attackItem = resolveCombatItem(equipment);
                        if (isShootAttack(attack)) {
                            if (!attackItem) return null;
                            const requiredAmmoRawClass = getRequiredAmmoRawClass(attackItem);
                            if (requiredAmmoRawClass !== null) {
                                const hasCompatibleAmmo = QUIVER_SLOT_KEYS.some((slot) =>
                                    matchesRequiredAmmoRawClass(equipment[slot], requiredAmmoRawClass),
                                );
                                if (!hasCompatibleAmmo) return runtimeText.noCompatibleAmmo;
                            }
                        }
                        const rearRankContactAttack = isChampionInRearRank(party, championId)
                            && Boolean(frontAttackContext?.target)
                            && isPhysicalAttack(attack)
                            && !isThrowAttack(attack)
                            && !isShootAttack(attack);
                        if (rearRankContactAttack) return runtimeText.targetOutOfReach;
                        if (attack.requiresCharges) {
                            const charges = getActionCharges(equipment.rightHand);
                            if (charges !== null && charges <= 0) return runtimeText.noChargesRemaining;
                        }
                        return null;
                    },
                });
                const {
                    allAttacks,
                    blockedAttackReasons,
                    cooldownRatio,
                    ready,
                    usableAttacks,
                    weaponImage,
                    weaponName,
                } = slotState;
                const combatItem = champ ? resolveCombatItem(championEquipment[champ.id]) : null;
                const combatItemDepleted = isChargeDepleted(combatItem);
                const isFlash = flash[i];
                const menuOpen = openMenuIndex === i && ready && !!champ && allAttacks.length > 1;
                const singleBlockedReason = allAttacks.length === 1
                    ? (blockedAttackReasons[allAttacks[0]?.attackType] ?? null)
                    : null;
                const slotBlocked = Boolean(singleBlockedReason) && usableAttacks.length === 0;
                const slotTitle = singleBlockedReason ? `${weaponName} | ${singleBlockedReason}` : weaponName;

                return (
                    <div
                        key={i}
                        onClick={() => handleClick(i, champ, ready, allAttacks, usableAttacks)}
                        style={{
                            position: 'relative', overflow: 'hidden',
                            background: isFlash
                                ? 'rgba(220,180,60,0.28)'
                                : slotBlocked
                                    ? 'rgba(8,8,8,0.92)'
                                    : champ ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.55)',
                            border: `1px solid ${
                                isFlash
                                    ? 'rgba(220,180,60,0.7)'
                                    : slotBlocked
                                        ? 'rgba(212,184,112,0.34)'
                                        : champ ? 'rgba(212,184,112,0.62)' : 'rgba(212,184,112,0.24)'
                            }`,
                            borderRadius: 4,
                            cursor: champ && ready ? 'pointer' : 'default',
                            width: 126,
                            height: 126,
                            userSelect: 'none',
                            transition: 'background 0.08s, border-color 0.08s',
                        }}
                        title={slotBlocked ? slotTitle : undefined}
                    >
                        {champ ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                    <div
                                        title={slotTitle}
                                        style={{
                                            width: 88,
                                            height: 100,
                                            borderRadius: 8,
                                            border: '2px solid rgba(212,184,112,0.92)',
                                            background: 'rgba(255,255,255,1)',
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
                                                    opacity: slotBlocked ? 0.45 : combatItemDepleted ? 0.7 : 1,
                                                    filter: combatItemDepleted ? 'grayscale(1)' : undefined,
                                                }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: 42, color: '#8a5c18', lineHeight: 1 }}>?</span>
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
                                {slotBlocked && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(42, 42, 42, 0.38)',
                                            boxShadow: 'inset 0 0 0 1px rgba(212,184,112,0.14)',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                )}
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
                                            const blockedReason = blockedAttackReasons[attack.attackType] ?? null;
                                            const attackEnabled = !blockedReason;
                                            return (
                                                <button
                                                    key={attack.attackType}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!attackEnabled) return;
                                                        triggerAttack(i, champ, attack.attackType);
                                                    }}
                                                    aria-disabled={!attackEnabled}
                                                    style={{
                                                        flex: 1,
                                                        minHeight: 0,
                                                        background: attackEnabled ? 'rgba(0,0,0,0.94)' : 'rgba(22,22,22,0.94)',
                                                        border: `1px solid ${attackEnabled ? 'rgba(212,184,112,0.68)' : 'rgba(212,184,112,0.28)'}`,
                                                        color: attackEnabled ? '#e4c684' : 'rgba(228,198,132,0.46)',
                                                        borderRadius: 3,
                                                        fontSize: 9,
                                                        fontWeight: 'bold',
                                                        letterSpacing: 0.5,
                                                        cursor: attackEnabled ? 'pointer' : 'default',
                                                        padding: '2px 4px',
                                                        textAlign: 'center',
                                                        opacity: attackEnabled ? 1 : 0.8,
                                                    }}
                                                    title={`${attack.displayName} \u00b7 ${text.fatigue} ${attack.attack.staminaCost} \u00b7 ${text.speed} ${attack.attack.disableTime}/6s${blockedReason ? ` \u00b7 ${blockedReason}` : ''}`}
                                                >
                                                    {attack.displayName}
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
type HeldMovementKey = 'fwd' | 'bck' | 'sl' | 'sr';

const HELD_MOVEMENT_REPEAT_MS = 60;
const LEVEL_UP_HIGHLIGHT_MS = 30_000;
const MAX_IMPORTED_SAVE_BYTES = 512 * 1024;

function buildExportedSaveFilename(): string {
    const now = new Date();
    const iso = [
        now.getFullYear().toString().padStart(4, '0'),
        (now.getMonth() + 1).toString().padStart(2, '0'),
        now.getDate().toString().padStart(2, '0'),
    ].join('-');
    const time = [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0'),
    ].join('-');
    return `dungeon-master-remastered-save-${iso}_${time}.dmsave.json`;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

function removeHeldMovementKey(keys: HeldMovementKey[], key: HeldMovementKey): HeldMovementKey[] {
    return keys.filter((entry) => entry !== key);
}

export const HUD = () => {
    const translations = useI18n();
    const currentLocale = useLocale();
    const text = translations.hud;
    const manual = translations.manual;
    const {
        party, level, position, direction,
        selectedChampionIndex, selectChampion, openPartyMember, reorderParty,
        moveForward, moveBackward, strafeLeft, strafeRight, turnLeft, turnRight,
        championVitals, spendPreparedSpellMana, castSpell: storeCastSpell, lastCastResult,
        championXP, championTemporaryXP, championCombat, attackFront, championEquipment, gameOptions,
        damageEvents, optionsModalOpen, openOptionsModal, closeOptionsModal, setGameOptions,
        buildSaveExportPayload, saveGame,
        activeFloorDrag, inventoryFullFeedback, pickupItemToChampion, pickupItemToChampionSlot, endFloorDrag, giveItem, giveEquippedItem, equipItem,
        openDoors, openWalls, openPits, openTeleporters, paused, tutorialOverlayActive,
    } = useStore(useShallow((state) => ({
        party: state.party,
        level: state.level,
        position: state.position,
        direction: state.direction,
        selectedChampionIndex: state.selectedChampionIndex,
        selectChampion: state.selectChampion,
        openPartyMember: state.openPartyMember,
        reorderParty: state.reorderParty,
        moveForward: state.moveForward,
        moveBackward: state.moveBackward,
        strafeLeft: state.strafeLeft,
        strafeRight: state.strafeRight,
        turnLeft: state.turnLeft,
        turnRight: state.turnRight,
        championVitals: state.championVitals,
        spendPreparedSpellMana: state.spendPreparedSpellMana,
        castSpell: state.castSpell,
        lastCastResult: state.lastCastResult,
        championXP: state.championXP,
        championTemporaryXP: state.championTemporaryXP,
        championCombat: state.championCombat,
        attackFront: state.attackFront,
        championEquipment: state.championEquipment,
        gameOptions: state.gameOptions,
        damageEvents: state.damageEvents,
        optionsModalOpen: state.optionsModalOpen,
        openOptionsModal: state.openOptionsModal,
        closeOptionsModal: state.closeOptionsModal,
        setGameOptions: state.setGameOptions,
        buildSaveExportPayload: state.buildSaveExportPayload,
        saveGame: state.saveGame,
        activeFloorDrag: state.activeFloorDrag,
        inventoryFullFeedback: state.inventoryFullFeedback,
        pickupItemToChampion: state.pickupItemToChampion,
        pickupItemToChampionSlot: state.pickupItemToChampionSlot,
        endFloorDrag: state.endFloorDrag,
        giveItem: state.giveItem,
        giveEquippedItem: state.giveEquippedItem,
        equipItem: state.equipItem,
        openDoors: state.openDoors,
        openWalls: state.openWalls,
        openPits: state.openPits,
        openTeleporters: state.openTeleporters,
        paused: state.paused,
        tutorialOverlayActive: state.tutorialOverlayActive,
    })));
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
        openTeleporters,
    });
    const recentDamageByChampionId = buildChampionRecentDamageMap({
        party,
        damageEvents,
    });
    // Flash
    const [flashKey, setFlashKey] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heldMovementKeysRef = useRef<HeldMovementKey[]>([]);
    const heldMovementFrameRef = useRef<number | null>(null);
    const heldMovementLastAttemptAtRef = useRef(0);
    const processHeldMovementFrameRef = useRef<(now: number) => void>(() => {});
    const previousPartyStepRef = useRef<{ level: number; position: [number, number] } | null>({
        level,
        position,
    });
    const [rebindingTarget, setRebindingTarget] = useState<RebindingTarget | null>(null);
    const [tutorialModalOpen, setTutorialModalOpen] = useState(false);
    const [activeManualSectionId, setActiveManualSectionId] = useState<string | null>(manual.sections[0]?.id ?? null);
    const [levelUpChampionIds, setLevelUpChampionIds] = useState<number[]>([]);
    const previousBasicSkillLevelsRef = useRef<Record<number, number[]>>({});
    const previousChampionStatsRef = useRef<Record<number, Record<HighlightStatKey, number>>>({});
    const levelUpTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
    const handleCloseOptionsModal = useCallback(() => {
        setRebindingTarget(null);
        closeOptionsModal();
    }, [closeOptionsModal, setRebindingTarget]);
    const handleExportSave = useCallback(async () => {
        try {
            const payload = buildSaveExportPayload();
            if (!payload) {
                return { success: false, message: text.exportSaveUnavailable };
            }
            const blob = new Blob([payload], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = buildExportedSaveFilename();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
            return { success: true, message: text.exportSaveSuccess };
        } catch {
            return { success: false, message: text.exportSaveUnavailable };
        }
    }, [buildSaveExportPayload, text.exportSaveSuccess, text.exportSaveUnavailable]);
    const handleSaveGame = useCallback(() => {
        const ok = saveGame();
        return { success: ok, message: ok ? text.saveSuccess : text.saveFailed };
    }, [saveGame, text.saveFailed, text.saveSuccess]);
    const handleImportSave = useCallback(async (file: File) => {
        try {
            if (file.size > MAX_IMPORTED_SAVE_BYTES) {
                return {
                    success: false,
                    message: text.importSaveTooLarge(Math.round(MAX_IMPORTED_SAVE_BYTES / 1024)),
                };
            }
            const payload = await file.text();
            const result = importPersistedSave(payload);
            if (result.kind === 'success') {
                window.location.reload();
                return { success: true };
            }
            if (result.kind === 'incompatible') {
                return {
                    success: false,
                    message: text.importSaveIncompatible(
                        result.savedBuildVersion,
                        result.savedSchemaVersion,
                        result.currentBuildVersion,
                        result.currentSchemaVersion,
                    ),
                };
            }
            return {
                success: false,
                message: result.kind === 'storage_failed' ? text.importSaveStorageFailed : text.importSaveCorrupt,
            };
        } catch {
            return { success: false, message: text.importSaveCorrupt };
        }
    }, [text]);
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

    useEffect(() => {
        const nextBasicSkillLevels: Record<number, number[]> = {};
        const nextChampionStats: Record<number, Record<HighlightStatKey, number>> = {};
        const levelUpsThisTick: number[] = [];
        const statKeys: HighlightStatKey[] = [
            'strength',
            'dexterity',
            'wisdom',
            'vitality',
            'luck',
            'antiMagic',
            'antiFire',
        ];

        for (const champion of party) {
            const basicLevels = BASIC_SKILL_KEYS.map((skill) =>
                getChampionSkillLevel(
                    championXP[champion.id],
                    championTemporaryXP[champion.id],
                    skill,
                    { ignoreTemporary: true },
                ),
            );
            const previousBasicLevels = previousBasicSkillLevelsRef.current[champion.id];
            const currentChampionStats = {
                strength: champion.strength,
                dexterity: champion.dexterity,
                wisdom: champion.wisdom,
                vitality: champion.vitality,
                luck: champion.luck,
                antiMagic: champion.antiMagic,
                antiFire: champion.antiFire,
            };
            const previousChampionStats = previousChampionStatsRef.current[champion.id];

            if (
                previousBasicLevels &&
                basicLevels.some((value, index) => value > (previousBasicLevels[index] ?? 0))
            ) {
                levelUpsThisTick.push(champion.id);
                const increasedStats = statKeys.filter((stat) =>
                    currentChampionStats[stat] > (previousChampionStats?.[stat] ?? currentChampionStats[stat]));
                recordChampionStatHighlights(champion.id, increasedStats, LEVEL_UP_HIGHLIGHT_MS);
                const existingTimeout = levelUpTimeoutsRef.current[champion.id];
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                }
                levelUpTimeoutsRef.current[champion.id] = setTimeout(() => {
                    setLevelUpChampionIds((current) => current.filter((id) => id !== champion.id));
                    delete levelUpTimeoutsRef.current[champion.id];
                }, 2200);
            }

            nextBasicSkillLevels[champion.id] = basicLevels;
            nextChampionStats[champion.id] = currentChampionStats;
        }

        if (levelUpsThisTick.length > 0) {
            queueMicrotask(() => {
                setLevelUpChampionIds((current) => {
                    const additions = levelUpsThisTick.filter((id) => !current.includes(id));
                    return additions.length > 0 ? [...current, ...additions] : current;
                });
            });
        }

        previousBasicSkillLevelsRef.current = nextBasicSkillLevels;
        previousChampionStatsRef.current = nextChampionStats;
    }, [party, championXP, championTemporaryXP]);

    const flash = useCallback((key: string, action: () => void) => {
        action();
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlashKey(key);
        flashTimer.current = setTimeout(() => setFlashKey(null), 150);
    }, []);

    // Like flash but also plays wall-bump feedback for blocked movement actions
    const move = useCallback((key: string, action: () => void) => {
        const runtimeState = useStore.getState();
        if (runtimeState.paused || runtimeState.tutorialOverlayActive) return;
        const cooldown = runtimeState.movementCooldown;
        if (Number.isFinite(cooldown) && cooldown > 0) return;
        const posBefore = runtimeState.position;
        action();
        const posAfter = useStore.getState().position;
        const moved = posAfter[0] !== posBefore[0] || posAfter[1] !== posBefore[1];
        if (!moved) playWallBump();
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlashKey(key);
        flashTimer.current = setTimeout(() => setFlashKey(null), 150);
    }, []);

    const runHeldMovement = useCallback((key: HeldMovementKey) => {
        switch (key) {
            case 'fwd':
                move('fwd', moveForward);
                return;
            case 'bck':
                move('bck', moveBackward);
                return;
            case 'sl':
                move('sl', strafeLeft);
                return;
            case 'sr':
                move('sr', strafeRight);
                return;
        }
    }, [move, moveBackward, moveForward, strafeLeft, strafeRight]);

    const stopHeldMovementLoop = useCallback(() => {
        if (heldMovementFrameRef.current !== null) {
            window.cancelAnimationFrame(heldMovementFrameRef.current);
            heldMovementFrameRef.current = null;
        }
    }, []);

    const clearHeldMovementState = useCallback(() => {
        heldMovementKeysRef.current = [];
        stopHeldMovementLoop();
    }, [stopHeldMovementLoop]);

    const processHeldMovementFrame = useCallback((now: number) => {
        const activeKey = heldMovementKeysRef.current[heldMovementKeysRef.current.length - 1];
        if (!activeKey) {
            heldMovementFrameRef.current = null;
            return;
        }

        const cooldown = useStore.getState().movementCooldown;
        if (
            (!Number.isFinite(cooldown) || cooldown <= 0) &&
            now - heldMovementLastAttemptAtRef.current >= HELD_MOVEMENT_REPEAT_MS
        ) {
            heldMovementLastAttemptAtRef.current = now;
            runHeldMovement(activeKey);
        }

        heldMovementFrameRef.current = window.requestAnimationFrame((nextNow) => {
            processHeldMovementFrameRef.current(nextNow);
        });
    }, [runHeldMovement]);

    useEffect(() => {
        processHeldMovementFrameRef.current = processHeldMovementFrame;
    }, [processHeldMovementFrame]);

    const ensureHeldMovementLoop = useCallback(() => {
        if (heldMovementFrameRef.current !== null) return;
        heldMovementFrameRef.current = window.requestAnimationFrame((now) => {
            processHeldMovementFrameRef.current(now);
        });
    }, []);

    const setHeldMovementPressed = useCallback((key: HeldMovementKey, pressed: boolean) => {
        const currentKeys = heldMovementKeysRef.current;
        heldMovementKeysRef.current = pressed
            ? [...removeHeldMovementKey(currentKeys, key), key]
            : removeHeldMovementKey(currentKeys, key);

        if (heldMovementKeysRef.current.length === 0) {
            stopHeldMovementLoop();
            return;
        }

        if (pressed) {
            ensureHeldMovementLoop();
        }
    }, [ensureHeldMovementLoop, stopHeldMovementLoop]);

    const resolveHeldMovementKey = useCallback((key: string): HeldMovementKey | null => {
        if (matchesKeybinding(keybindings.moveForward, key)) return 'fwd';
        if (matchesKeybinding(keybindings.moveBackward, key)) return 'bck';
        if (matchesKeybinding(keybindings.strafeLeft, key)) return 'sl';
        if (matchesKeybinding(keybindings.strafeRight, key)) return 'sr';
        return null;
    }, [keybindings.moveBackward, keybindings.moveForward, keybindings.strafeLeft, keybindings.strafeRight]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (paused || tutorialOverlayActive) return;
            if (optionsModalOpen || tutorialModalOpen) return;
            if (isTextEntryTarget(e.target)) return;
            const heldMovementKey = resolveHeldMovementKey(e.key);
            if (heldMovementKey) {
                e.preventDefault();
                if (heldMovementKeysRef.current.includes(heldMovementKey)) return;
                setHeldMovementPressed(heldMovementKey, true);
                heldMovementLastAttemptAtRef.current = performance.now();
                runHeldMovement(heldMovementKey);
                return;
            }

            const { keybindings } = gameOptions;
            if (matchesKeybinding(keybindings.turnLeft, e.key)) { e.preventDefault(); flash('tl', turnLeft); return; }
            if (matchesKeybinding(keybindings.turnRight, e.key)) { e.preventDefault(); flash('tr', turnRight); return; }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const heldMovementKey = resolveHeldMovementKey(e.key);
            if (!heldMovementKey) return;
            setHeldMovementPressed(heldMovementKey, false);
        };
        window.addEventListener('keydown', handleKey);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', clearHeldMovementState);
        return () => {
            window.removeEventListener('keydown', handleKey);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', clearHeldMovementState);
        };
    }, [
        clearHeldMovementState,
        flash,
        gameOptions,
        optionsModalOpen,
        paused,
        resolveHeldMovementKey,
        runHeldMovement,
        setHeldMovementPressed,
        tutorialOverlayActive,
        tutorialModalOpen,
        turnLeft,
        turnRight,
    ]);

    useEffect(() => {
        if (!optionsModalOpen && !tutorialModalOpen && !tutorialOverlayActive) return;
        clearHeldMovementState();
    }, [clearHeldMovementState, optionsModalOpen, tutorialModalOpen, tutorialOverlayActive]);

    useEffect(() => () => {
        clearHeldMovementState();
        for (const timeoutId of Object.values(levelUpTimeoutsRef.current)) {
            clearTimeout(timeoutId);
        }
    }, [clearHeldMovementState]);

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
    const [activeSpellCasterId, setActiveSpellCasterId] = useState<number | null>(() => party[selectedChampionIndex]?.id ?? party[0]?.id ?? null);

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
    const [preparedRunesByChampionId, setPreparedRunesByChampionId] = useState<Record<number, string[]>>({});
    const resolvedActiveSpellCasterId = party.some((champion) => champion.id === activeSpellCasterId)
        ? activeSpellCasterId
        : (party[selectedChampionIndex]?.id ?? party[0]?.id ?? null);
    const selectedRunes = getPreparedHudRunes(preparedRunesByChampionId, resolvedActiveSpellCasterId);

    useEffect(() => {
        setPreparedRunesByChampionId((prev) => prunePreparedHudRunes(prev, party));
    }, [party]);

    const setSelectedRunes = useCallback((value: React.SetStateAction<string[]>) => {
        setPreparedRunesByChampionId((prev) => {
            const currentRunes = getPreparedHudRunes(prev, resolvedActiveSpellCasterId);
            const nextRunes = typeof value === 'function'
                ? (value as (previousState: string[]) => string[])(currentRunes)
                : value;
            return setPreparedHudRunes(prev, resolvedActiveSpellCasterId, nextRunes);
        });
    }, [resolvedActiveSpellCasterId]);

    const selectRune = (runeId: string) => {
        const existingIndex = selectedRunes.indexOf(runeId);
        if (existingIndex !== -1) {
            setSelectedRunes(selectedRunes.slice(0, existingIndex));
            return;
        }
        if (selectedRunes.length >= 4 || resolvedActiveSpellCasterId === null) {
            return;
        }

        const manaCost = getOriginalRuneSelectionManaCost(selectedRunes, runeId);
        if (manaCost === null || !spendPreparedSpellMana(resolvedActiveSpellCasterId, manaCost)) {
            return;
        }

        setSelectedRunes([...selectedRunes, runeId]);
    };
    const handleCast = () => {
        if (!castState.casterChampion) return;
        storeCastSpell(castState.casterChampion.id, selectedRunes);
        setSelectedRunes([]);
    };
    const clearRunes = () => setSelectedRunes([]);
    const castState = buildHudCastState({
        selectedRunes,
        activeCasterChampionId: resolvedActiveSpellCasterId,
        party,
        championVitals,
        championCombat,
        findSpell,
        runeFamilyCount: 4,
    });
    const spell = castState.spell;
    const canCast = castState.canCast;
    const displayedSpellManaCost = spell ? getOriginalPreparedRuneManaCost(spell.runes) : null;
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
        }}
        data-tutorial-zone="hud-root"
        >
            <MinimapOverlay />
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
                levelUpChampionIds={levelUpChampionIds}
                inventoryFullFeedback={inventoryFullFeedback}
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
                pickupItemToChampionSlot={pickupItemToChampionSlot}
                endFloorDrag={endFloorDrag}
                giveItem={giveItem}
                giveEquippedItem={giveEquippedItem}
                equipItem={equipItem}
            />

            <HudMagicPanel
                panelStyle={panel}
                text={text}
                party={party}
                activeCasterChampionId={resolvedActiveSpellCasterId}
                activeCasterMana={castState.casterChampionMana}
                activeCasterCooldown={castState.casterChampionCooldown}
                selectedRunes={selectedRunes}
                currentFamilyIdx={castState.currentFamilyIdx}
                spell={spell}
                displayManaCost={displayedSpellManaCost}
                canCast={canCast}
                lastCastResult={lastCastResult}
                onSelectCaster={setActiveSpellCasterId}
                onTruncateRunes={(slotIndex) => setSelectedRunes((prev) => prev.slice(0, slotIndex))}
                onSelectRune={selectRune}
                onCast={handleCast}
                onClear={clearRunes}
            />
            {/* Combat */}
            <div style={panel}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }} data-tutorial-zone="combat-grid">
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
                    }}
                    data-tutorial-zone="movement-grid"
                    >
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

            {DEV_PERF_PANEL_ENABLED && <DevPerformancePanel />}

            {/* Debug */}
            <div style={{ fontSize: 10, color: '#993322', fontFamily: 'monospace', textAlign: 'center', opacity: 0.6 }}>
                {text.debugPrimary(
                    globalX,
                    globalY,
                    direction,
                    level,
                    frontGlobalX,
                    frontGlobalY,
                    frontLocalX,
                    frontLocalY,
                    frontState,
                )}
            </div>
            <div style={{ fontSize: 9, color: '#7a4a24', fontFamily: 'monospace', textAlign: 'center', opacity: 0.5, marginTop: 2 }}>
                {text.debugSecondary(
                    position[1],
                    position[0],
                    currentMap.mapOffset?.x ?? 0,
                    currentMap.mapOffset?.y ?? 0,
                )}
            </div>
            <Suspense fallback={null}>
                <HudOptionsModal
                    open={optionsModalOpen}
                    text={text}
                    currentLocale={currentLocale}
                    showMinimap={gameOptions.showMinimap}
                    keybindings={gameOptions.keybindings}
                    rebindingTarget={rebindingTarget}
                    onClose={handleCloseOptionsModal}
                    onChangeLocale={setLocale}
                    onToggleMinimap={() => {
                        setGameOptions({ showMinimap: !gameOptions.showMinimap });
                    }}
                    onSaveGame={handleSaveGame}
                    onExportSave={handleExportSave}
                    onImportSave={handleImportSave}
                    onToggleBinding={(target) => {
                        setRebindingTarget((current) =>
                            current?.action === target.action && current.slot === target.slot ? null : target,
                        );
                    }}
                />
            </Suspense>
            {tutorialModalOpen && (
                <Suspense fallback={null}>
                    <ManualModal
                        manual={manual}
                        text={text}
                        activeSectionId={activeManualSectionId}
                        onSelectSection={setActiveManualSectionId}
                        onClose={() => setTutorialModalOpen(false)}
                    />
                </Suspense>
            )}
        </div>
    );
};
