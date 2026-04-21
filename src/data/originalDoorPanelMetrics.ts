const FRONT_DOOR_REFERENCE_WIDTH = 96;
const FRONT_DOOR_REFERENCE_HEIGHT = 88;
const FRONT_DOOR_LEFT_FRAME_WIDTH = 18;
const FRONT_DOOR_SWITCH_WIDTH = 14;
const FRONT_DOOR_SWITCH_HEIGHT = 39;

export const ORIGINAL_FRONT_DOOR_REFERENCE_WIDTH = FRONT_DOOR_REFERENCE_WIDTH;
export const ORIGINAL_FRONT_DOOR_REFERENCE_HEIGHT = FRONT_DOOR_REFERENCE_HEIGHT;
export const ORIGINAL_FRONT_DOOR_LEFT_FRAME_WIDTH = FRONT_DOOR_LEFT_FRAME_WIDTH;
export const ORIGINAL_FRONT_DOOR_SWITCH_WIDTH = FRONT_DOOR_SWITCH_WIDTH;
export const ORIGINAL_FRONT_DOOR_SWITCH_HEIGHT = FRONT_DOOR_SWITCH_HEIGHT;

export function getOriginalDoorButtonStripWidthRatio(): number {
    return FRONT_DOOR_LEFT_FRAME_WIDTH / FRONT_DOOR_REFERENCE_WIDTH;
}

export function getOriginalDoorButtonWidthRatio(): number {
    return FRONT_DOOR_SWITCH_WIDTH / FRONT_DOOR_REFERENCE_WIDTH;
}

export function getOriginalDoorButtonAspectRatio(): number {
    return FRONT_DOOR_SWITCH_HEIGHT / FRONT_DOOR_SWITCH_WIDTH;
}

export function getOriginalDoorButtonHeightRatio(): number {
    return getOriginalDoorButtonWidthRatio() * getOriginalDoorButtonAspectRatio();
}
