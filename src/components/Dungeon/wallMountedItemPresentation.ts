import { GRID_SIZE, WALL_HEIGHT } from '../../engine/constants';
import type { FloorItem } from '../../types/game';
import { getOriginalWallOverlayVisual, hasOriginalWallOverlayAt } from '../../data/originalWallOverlays';

const ITEM_MAX_W = GRID_SIZE * 0.42;
const ITEM_MAX_H = WALL_HEIGHT * 0.42;
const RECESSED_SUPPORT_ITEM_SCALE = 0.42;
const RECESSED_SUPPORT_OVERLAYS = ['Vi Altar'] as const;
const FULL_TORCH_HOLDER_OVERLAY = 'Full Torch Holder';
const FULL_TORCH_HOLDER_VISUAL = getOriginalWallOverlayVisual(FULL_TORCH_HOLDER_OVERLAY);
const FULL_TORCH_HOLDER_PICKUP_PLANE_W = GRID_SIZE * (FULL_TORCH_HOLDER_VISUAL?.width ?? 0.24);
const FULL_TORCH_HOLDER_PICKUP_PLANE_H = WALL_HEIGHT * (FULL_TORCH_HOLDER_VISUAL?.height ?? 0.92);

export type WallMountedItemPresentation = {
    renderSprite: boolean;
    spriteScale: number;
    pickupPlaneWidth: number;
    pickupPlaneHeight: number;
};

function isWallMountedTorch(item: FloorItem): boolean {
    return item.category === 'Weapon' && item.typeId === 2;
}

export function getWallMountedItemPresentation(level: number, item: FloorItem): WallMountedItemPresentation {
    const isFullTorchHolderFace = hasOriginalWallOverlayAt(
        level,
        item.x,
        item.y,
        item.tilePos,
        FULL_TORCH_HOLDER_OVERLAY,
    );

    if (isFullTorchHolderFace && isWallMountedTorch(item)) {
        return {
            renderSprite: false,
            spriteScale: 1,
            pickupPlaneWidth: FULL_TORCH_HOLDER_PICKUP_PLANE_W,
            pickupPlaneHeight: FULL_TORCH_HOLDER_PICKUP_PLANE_H,
        };
    }

    const spriteScale = RECESSED_SUPPORT_OVERLAYS.some((overlayName) =>
        hasOriginalWallOverlayAt(level, item.x, item.y, item.tilePos, overlayName),
    )
        ? RECESSED_SUPPORT_ITEM_SCALE
        : 1;

    return {
        renderSprite: true,
        spriteScale,
        pickupPlaneWidth: ITEM_MAX_W * spriteScale,
        pickupPlaneHeight: ITEM_MAX_H * spriteScale,
    };
}
