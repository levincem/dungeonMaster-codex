import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getGameMap } from '../../data/mapLoader';
import { useStore, isSelfRevealingWallTile } from '../../engine/store';
import {
    computeVisibleMinimapTileMemory,
    parseMinimapTileKey,
    type MinimapSeenTileKind,
} from '../../engine/systems/minimapDiscovery';
import { useI18n } from '../../i18n';

const MINIMAP_DIAMETER = 168;
const MINIMAP_PADDING = 14;
const MINIMAP_TILE_SIZE = 12;
const MINIMAP_VIEW_SIZE = MINIMAP_DIAMETER - (MINIMAP_PADDING * 2);
const FULL_MAP_TILE_SIZE = 18;
const PHASES_WITH_MINIMAP = new Set(['exploration', 'endgame', 'alternate_ending']);

type RenderedTile = {
    key: string;
    x: number;
    y: number;
    kind: MinimapSeenTileKind;
};

function shouldTrackMinimap(gamePhase: string): boolean {
    return PHASES_WITH_MINIMAP.has(gamePhase);
}

function getArrowRotation(direction: 'NORTH' | 'EAST' | 'SOUTH' | 'WEST'): number {
    switch (direction) {
        case 'EAST':
            return 90;
        case 'SOUTH':
            return 180;
        case 'WEST':
            return -90;
        default:
            return 0;
    }
}

function renderPlayerMarker(size: 'mini' | 'full'): React.ReactNode {
    if (size === 'mini') {
        return (
            <>
                <circle cx={0} cy={0} r={5.2} fill="#1a1306" stroke="#ffe29c" strokeWidth={1.6} />
                <path d="M 0 -8 L 6 6 L 0 3 L -6 6 Z" fill="#ffe29c" />
            </>
        );
    }

    return (
        <>
            <circle cx={0} cy={0} r={7.2} fill="#1a1306" stroke="#ffe29c" strokeWidth={2} />
            <path d="M 0 -12 L 8 8 L 0 4 L -8 8 Z" fill="#ffe29c" />
        </>
    );
}

function renderMinimapTile(tile: RenderedTile, tileSize: number): React.ReactNode {
    const left = tile.x * tileSize;
    const top = tile.y * tileSize;
    const inset = Math.max(1, Math.round(tileSize * 0.12));
    const centerX = left + (tileSize / 2);
    const centerY = top + (tileSize / 2);
    const floorRect = (
        <rect
            x={left + inset}
            y={top + inset}
            width={tileSize - (inset * 2)}
            height={tileSize - (inset * 2)}
            rx={Math.max(1, tileSize * 0.12)}
            fill="#d9c89a"
            opacity={0.92}
        />
    );

    switch (tile.kind) {
        case 'doorClosed':
            return (
                <g key={tile.key}>
                    {floorRect}
                    <line
                        x1={left + 2}
                        y1={centerY}
                        x2={left + tileSize - 2}
                        y2={centerY}
                        stroke="#f2a84a"
                        strokeWidth={Math.max(2, tileSize * 0.18)}
                        strokeLinecap="round"
                    />
                </g>
            );
        case 'doorOpen':
            return (
                <g key={tile.key}>
                    {floorRect}
                    <line
                        x1={left + 3}
                        y1={centerY}
                        x2={left + tileSize - 3}
                        y2={centerY}
                        stroke="#8e7045"
                        strokeWidth={Math.max(1.6, tileSize * 0.12)}
                        strokeLinecap="round"
                    />
                </g>
            );
        case 'pit':
            return (
                <g key={tile.key}>
                    <rect
                        x={left + inset}
                        y={top + inset}
                        width={tileSize - (inset * 2)}
                        height={tileSize - (inset * 2)}
                        rx={Math.max(1, tileSize * 0.12)}
                        fill="#0b0b0d"
                    />
                    <rect
                        x={left + inset + 1}
                        y={top + inset + 1}
                        width={tileSize - (inset * 2) - 2}
                        height={tileSize - (inset * 2) - 2}
                        rx={Math.max(1, tileSize * 0.08)}
                        fill="none"
                        stroke="#5f5b58"
                        strokeWidth={1}
                        opacity={0.7}
                    />
                </g>
            );
        case 'teleporter':
            return (
                <g key={tile.key}>
                    {floorRect}
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={tileSize * 0.22}
                        fill="none"
                        stroke="#73d4ea"
                        strokeWidth={Math.max(1.5, tileSize * 0.12)}
                    />
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={tileSize * 0.08}
                        fill="#73d4ea"
                        opacity={0.9}
                    />
                </g>
            );
        case 'stairs':
        case 'stairsUp':
        case 'stairsDown':
            return (
                <g key={tile.key}>
                    {floorRect}
                    <path
                        d={[
                            `M ${left + (tileSize * 0.24)} ${top + (tileSize * 0.72)}`,
                            `L ${left + (tileSize * 0.5)} ${top + (tileSize * 0.38)}`,
                            `L ${left + (tileSize * 0.76)} ${top + (tileSize * 0.72)}`,
                        ].join(' ')}
                        fill="none"
                        stroke="#f0d060"
                        strokeWidth={Math.max(1.8, tileSize * 0.14)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </g>
            );
        case 'water':
            return (
                <g key={tile.key}>
                    <rect
                        x={left + inset}
                        y={top + inset}
                        width={tileSize - (inset * 2)}
                        height={tileSize - (inset * 2)}
                        rx={Math.max(1, tileSize * 0.18)}
                        fill="#6e9ddd"
                        opacity={0.92}
                    />
                </g>
            );
        default:
            return <g key={tile.key}>{floorRect}</g>;
    }
}

function buildCurrentLevelTiles(
    minimapTiles: Record<string, MinimapSeenTileKind>,
    level: number,
): RenderedTile[] {
    const tiles: RenderedTile[] = [];
    for (const [key, kind] of Object.entries(minimapTiles)) {
        const parsed = parseMinimapTileKey(key);
        if (!parsed || parsed.level !== level) continue;
        tiles.push({
            key,
            x: parsed.x,
            y: parsed.y,
            kind,
        });
    }
    return tiles;
}

export const MinimapOverlay: React.FC = () => {
    const text = useI18n().hud;
    const [modalOpen, setModalOpen] = useState(false);
    const {
        level,
        position,
        direction,
        gamePhase,
        showMinimap,
        minimapTiles,
        openDoors,
        openPits,
        openTeleporters,
        openWalls,
        updateMinimapTiles,
    } = useStore(useShallow((state) => ({
        level: state.level,
        position: state.position,
        direction: state.direction,
        gamePhase: state.gamePhase,
        showMinimap: state.gameOptions.showMinimap,
        minimapTiles: state.minimapTiles,
        openDoors: state.openDoors,
        openPits: state.openPits,
        openTeleporters: state.openTeleporters,
        openWalls: state.openWalls,
        updateMinimapTiles: state.updateMinimapTiles,
    })));

    const trackMinimap = shouldTrackMinimap(gamePhase);
    const map = getGameMap(level);

    const visibleMinimapTiles = useMemo(
        () => trackMinimap
            ? computeVisibleMinimapTileMemory({
                map,
                level,
                position,
                direction,
                openDoors,
                openPits,
                openTeleporters,
                openWalls,
                isSelfRevealingWallTile,
            })
            : {},
        [direction, level, map, openDoors, openPits, openTeleporters, openWalls, position, trackMinimap],
    );

    useEffect(() => {
        if (!trackMinimap) return;
        updateMinimapTiles(visibleMinimapTiles);
    }, [trackMinimap, updateMinimapTiles, visibleMinimapTiles]);

    useEffect(() => {
        if (showMinimap && trackMinimap) return;
        setModalOpen(false);
    }, [showMinimap, trackMinimap]);

    useEffect(() => {
        if (!modalOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modalOpen]);

    const currentLevelTiles = useMemo(
        () => buildCurrentLevelTiles(minimapTiles, level),
        [level, minimapTiles],
    );

    const miniMapOffsetX = (MINIMAP_VIEW_SIZE / 2) - ((position[1] + 0.5) * MINIMAP_TILE_SIZE);
    const miniMapOffsetY = (MINIMAP_VIEW_SIZE / 2) - ((position[0] + 0.5) * MINIMAP_TILE_SIZE);
    const playerMiniMapX = MINIMAP_VIEW_SIZE / 2;
    const playerMiniMapY = MINIMAP_VIEW_SIZE / 2;
    const fullMapWidth = map.width * FULL_MAP_TILE_SIZE;
    const fullMapHeight = map.height * FULL_MAP_TILE_SIZE;
    const playerModalX = (position[1] + 0.5) * FULL_MAP_TILE_SIZE;
    const playerModalY = (position[0] + 0.5) * FULL_MAP_TILE_SIZE;
    const arrowRotation = getArrowRotation(direction);

    if (!showMinimap || !trackMinimap) {
        return null;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setModalOpen(true)}
                title={text.minimapOpenFullMap}
                aria-label={text.minimapOpenFullMap}
                style={{
                    position: 'fixed',
                    top: 14,
                    left: 14,
                    zIndex: 118,
                    width: MINIMAP_DIAMETER,
                    height: MINIMAP_DIAMETER,
                    padding: 0,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '1px solid rgba(212,184,112,0.46)',
                    background: 'radial-gradient(circle at 48% 44%, rgba(33,27,16,0.96), rgba(10,8,5,0.98))',
                    boxShadow: '0 16px 42px rgba(0,0,0,0.38)',
                    cursor: 'pointer',
                }}
            >
                <div
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        top: 8,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        fontFamily: '"Courier New", monospace',
                        fontSize: 11,
                        fontWeight: 'bold',
                        letterSpacing: 2,
                        color: '#f0d060',
                        pointerEvents: 'none',
                    }}
                >
                    N
                </div>
                <div
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        right: 12,
                        bottom: 10,
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: 'rgba(0,0,0,0.46)',
                        border: '1px solid rgba(212,184,112,0.18)',
                        fontFamily: '"Courier New", monospace',
                        fontSize: 11,
                        color: '#d8c89f',
                        pointerEvents: 'none',
                    }}
                >
                    {map.name}
                </div>
                <svg
                    viewBox={`0 0 ${MINIMAP_VIEW_SIZE} ${MINIMAP_VIEW_SIZE}`}
                    style={{
                        position: 'absolute',
                        left: MINIMAP_PADDING,
                        top: MINIMAP_PADDING,
                        width: MINIMAP_VIEW_SIZE,
                        height: MINIMAP_VIEW_SIZE,
                        pointerEvents: 'none',
                    }}
                >
                    <rect
                        x={0}
                        y={0}
                        width={MINIMAP_VIEW_SIZE}
                        height={MINIMAP_VIEW_SIZE}
                        fill="#14110b"
                    />
                    <g transform={`translate(${miniMapOffsetX} ${miniMapOffsetY})`}>
                        {currentLevelTiles.map((tile) => renderMinimapTile(tile, MINIMAP_TILE_SIZE))}
                    </g>
                    <g transform={`translate(${playerMiniMapX} ${playerMiniMapY}) rotate(${arrowRotation})`}>
                        {renderPlayerMarker('mini')}
                    </g>
                </svg>
            </button>

            {modalOpen && (
                <div
                    onClick={() => setModalOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 235,
                        background: 'rgba(0,0,0,0.78)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            width: 'min(78vw, 980px)',
                            maxHeight: '82vh',
                            overflow: 'hidden',
                            background: 'linear-gradient(180deg, rgba(7,7,7,0.98), rgba(18,15,10,0.98))',
                            border: '1px solid rgba(212,184,112,0.46)',
                            borderRadius: 12,
                            boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
                            padding: 22,
                            color: '#ead6a0',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                            <div>
                                <div style={{ fontSize: 13, letterSpacing: 3, color: '#c9a85e', marginBottom: 6 }}>
                                    {text.minimapModalTitle.toUpperCase()}
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 'bold', color: '#f2dfad' }}>{map.name}</div>
                                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(232,214,160,0.72)', marginTop: 6 }}>
                                    {text.minimapModalSubtitle}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                title={text.minimapClose}
                                aria-label={text.minimapClose}
                                style={{
                                    background: 'none',
                                    border: '1px solid rgba(212,184,112,0.26)',
                                    color: '#bfa06a',
                                    borderRadius: 999,
                                    width: 32,
                                    height: 32,
                                    fontSize: 20,
                                    cursor: 'pointer',
                                    flex: '0 0 auto',
                                }}
                            >
                                {'\u00d7'}
                            </button>
                        </div>

                        <div
                            style={{
                                maxHeight: '68vh',
                                overflow: 'auto',
                                borderRadius: 10,
                                border: '1px solid rgba(212,184,112,0.18)',
                                background: 'rgba(0,0,0,0.22)',
                                padding: 16,
                            }}
                        >
                            <div
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                }}
                            >
                                <svg
                                    viewBox={`0 0 ${fullMapWidth} ${fullMapHeight}`}
                                    style={{
                                        display: 'block',
                                        width: 'min(100%, 920px)',
                                        height: 'auto',
                                        maxHeight: '64vh',
                                        background: '#14110b',
                                        borderRadius: 10,
                                        border: '1px solid rgba(212,184,112,0.16)',
                                    }}
                                >
                                    <rect x={0} y={0} width={fullMapWidth} height={fullMapHeight} fill="#14110b" />
                                    {currentLevelTiles.map((tile) => renderMinimapTile(tile, FULL_MAP_TILE_SIZE))}
                                    <g transform={`translate(${playerModalX} ${playerModalY}) rotate(${arrowRotation})`}>
                                        {renderPlayerMarker('full')}
                                    </g>
                                </svg>
                                <div
                                    aria-hidden="true"
                                    style={{
                                        position: 'absolute',
                                        top: 10,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        fontFamily: '"Courier New", monospace',
                                        fontSize: 12,
                                        fontWeight: 'bold',
                                        letterSpacing: 2,
                                        color: '#f0d060',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    N
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
