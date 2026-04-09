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

export function secondsToMs(seconds: number): number {
    return seconds * 1000;
}

export function minutesToMs(minutes: number): number {
    return secondsToMs(minutes * 60);
}

export function quantizeMsToOriginalVbls(ms: number): number {
    return vblsToMs(Math.max(1, Math.round(ms / ORIGINAL_VBL_MS)));
}

export function quantizeMsToOriginalTimerTicks(ms: number): number {
    return originalTimerTicksToMs(Math.max(1, Math.round(ms / ORIGINAL_TIMER_TICK_MS)));
}

export const DAMAGE_EVENT_LIFETIME_MS = quantizeMsToOriginalVbls(600);
export const TRANSIENT_MESSAGE_LIFETIME_MS = quantizeMsToOriginalVbls(3000);
export const FOOTPRINT_LIFETIME_MS = quantizeMsToOriginalTimerTicks(60_000);
export const CREATURE_ATTACK_WINDOW_MS = quantizeMsToOriginalVbls(900);
export const PROJECTILE_STEP_MS = quantizeMsToOriginalVbls(300);
export const PHYSICAL_PROJECTILE_STEP_MS = quantizeMsToOriginalVbls(220);
export const DOOR_CLOSE_DURATION_SECONDS = quantizeMsToOriginalVbls(550) / 1000;
export const DOOR_REBOUND_DURATION_SECONDS = quantizeMsToOriginalVbls(380) / 1000;
export const DOOR_RECLOSE_DURATION_SECONDS = quantizeMsToOriginalVbls(500) / 1000;

export function clampFrameDeltaSeconds(deltaSeconds: number): number {
    return Math.min(Math.max(deltaSeconds, 0), MAX_FRAME_DELTA_SECONDS);
}
