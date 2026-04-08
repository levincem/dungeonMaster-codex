export const ORIGINAL_VBL_MS = 16;
export const NORMAL_SPEED_VBL_PER_TICK = 15;
export const MAX_FRAME_DELTA_SECONDS = 0.1;

// At normal speed, one logical timer tick in the original runtime advances every 15 VBL.
export const ORIGINAL_TIMER_TICK_MS = ORIGINAL_VBL_MS * NORMAL_SPEED_VBL_PER_TICK;
export const ORIGINAL_TIMER_TICK_SECONDS = ORIGINAL_TIMER_TICK_MS / 1000;

export function originalTimerTicksToSeconds(ticks: number): number {
    return ticks * ORIGINAL_TIMER_TICK_SECONDS;
}

export function originalTimerTicksToMs(ticks: number): number {
    return ticks * ORIGINAL_TIMER_TICK_MS;
}

export function vblsToMs(vbls: number): number {
    return vbls * ORIGINAL_VBL_MS;
}

export function clampFrameDeltaSeconds(deltaSeconds: number): number {
    return Math.min(Math.max(deltaSeconds, 0), MAX_FRAME_DELTA_SECONDS);
}
