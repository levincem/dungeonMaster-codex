import React from 'react';
import { formatKeybinding } from '../../engine/options';
import type { GameAction } from '../../engine/runtimeTypes';
import type { Translations } from '../../i18n';

const MOVEMENT_ACTIONS: Array<{ action: GameAction; icon: string }> = [
    { action: 'moveForward', icon: '\u2191' },
    { action: 'moveBackward', icon: '\u2193' },
    { action: 'turnLeft', icon: '\u21ba' },
    { action: 'turnRight', icon: '\u21bb' },
    { action: 'strafeLeft', icon: '\u2190' },
    { action: 'strafeRight', icon: '\u2192' },
];

export type HudRebindingTarget = { action: GameAction; slot: 0 | 1 };

export const HudOptionsModal: React.FC<{
    open: boolean;
    text: Translations['hud'];
    keybindings: Record<GameAction, string[] | undefined>;
    rebindingTarget: HudRebindingTarget | null;
    onClose: () => void;
    onToggleBinding: (target: HudRebindingTarget) => void;
}> = ({ open, text, keybindings, rebindingTarget, onClose, onToggleBinding }) => {
    if (!open) return null;

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.72)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 220,
                padding: 24,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(560px, 92vw)',
                    background: 'linear-gradient(180deg, rgba(7,7,7,0.98), rgba(18,15,10,0.98))',
                    border: '1px solid rgba(212,184,112,0.46)',
                    borderRadius: 12,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
                    padding: 22,
                    color: '#ead6a0',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                        <div style={{ fontSize: 13, letterSpacing: 3, color: '#c9a85e', marginBottom: 6 }}>{text.options.toUpperCase()}</div>
                        <div style={{ fontSize: 21, fontWeight: 'bold', color: '#f2dfad' }}>{text.keybindings}</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: '1px solid rgba(212,184,112,0.26)',
                            color: '#bfa06a',
                            borderRadius: 999,
                            width: 32,
                            height: 32,
                            fontSize: 20,
                            cursor: 'pointer',
                        }}
                        title={text.close}
                    >
                        {'\u00d7'}
                    </button>
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(232,214,160,0.72)', marginBottom: 20 }}>
                    {rebindingTarget === null ? text.clickToReassign : `${text.pressNewKey} ${text.pressEscToCancel}`}
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                    {MOVEMENT_ACTIONS.map(({ action, icon }) => {
                        const bindings = keybindings[action] ?? [];
                        return (
                            <div
                                key={action}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '48px 1fr 140px 140px',
                                    gap: 12,
                                    alignItems: 'center',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(212,184,112,0.18)',
                                    background: 'rgba(0,0,0,0.28)',
                                }}
                            >
                                <div
                                    style={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: 999,
                                        border: '1px solid rgba(212,184,112,0.28)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#f0d060',
                                        fontSize: 22,
                                    }}
                                >
                                    {icon}
                                </div>
                                <div style={{ fontSize: 15, color: '#ecd9a8' }}>
                                    {text.actionLabels[action]}
                                </div>
                                {[0, 1].map((slotIndex) => {
                                    const waiting = rebindingTarget?.action === action && rebindingTarget.slot === slotIndex;
                                    const binding = bindings[slotIndex] ? formatKeybinding([bindings[slotIndex]]) : '\u2014';
                                    return (
                                        <button
                                            key={`${action}-${slotIndex}`}
                                            onClick={() => onToggleBinding({ action, slot: slotIndex as 0 | 1 })}
                                            style={{
                                                padding: '9px 12px',
                                                borderRadius: 6,
                                                border: `1px solid ${waiting ? 'rgba(240,208,96,0.78)' : 'rgba(212,184,112,0.3)'}`,
                                                background: waiting ? 'rgba(18,12,0,0.96)' : 'rgba(0,0,0,0.62)',
                                                color: waiting ? '#ffe9aa' : '#d8c08b',
                                                fontSize: 15,
                                                cursor: 'pointer',
                                                fontFamily: '"Courier New", monospace',
                                                letterSpacing: 1,
                                            }}
                                        >
                                            {waiting ? text.pressNewKey : binding}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
