import { useStore } from '../../engine/store';
import { useTemporalFlag } from './useWallClock';

export const SEE_THROUGH_WALL_OPACITY = 0.34;

export function useWallTransparencyState(): { wallTransparent: boolean; wallOpacity: number } {
    const seeThroughWallsUntil = useStore((state) => state.seeThroughWallsUntil);
    const wallTransparent = useTemporalFlag(seeThroughWallsUntil, 120);
    return {
        wallTransparent,
        wallOpacity: wallTransparent ? SEE_THROUGH_WALL_OPACITY : 1,
    };
}
