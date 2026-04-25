import React, { useRef, useState } from 'react';
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

type SaveTransferFeedback = { success: boolean; message: string };

export const HudOptionsModal: React.FC<{
    open: boolean;
    text: Translations['hud'];
    keybindings: Record<GameAction, string[] | undefined>;
    rebindingTarget: HudRebindingTarget | null;
    onClose: () => void;
    onToggleBinding: (target: HudRebindingTarget) => void;
    onExportSave: () => Promise<SaveTransferFeedback> | SaveTransferFeedback;
    onImportSave: (file: File) => Promise<SaveTransferFeedback> | SaveTransferFeedback;
}> = ({
    open,
    text,
    keybindings,
    rebindingTarget,
    onClose,
    onToggleBinding,
    onExportSave,
    onImportSave,
}) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [saveTransferMessage, setSaveTransferMessage] = useState<SaveTransferFeedback | null>(null);
    const [saveTransferBusy, setSaveTransferBusy] = useState(false);
    const [confirmImportOpen, setConfirmImportOpen] = useState(false);

    if (!open) return null;

    const handleExport = async () => {
        setSaveTransferBusy(true);
        try {
            setSaveTransferMessage(await onExportSave());
        } finally {
            setSaveTransferBusy(false);
        }
    };

    const handleImportClick = () => {
        setConfirmImportOpen(true);
    };

    const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setSaveTransferBusy(true);
        try {
            setSaveTransferMessage(await onImportSave(file));
        } finally {
            setSaveTransferBusy(false);
            setConfirmImportOpen(false);
        }
    };

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
                                    gridTemplateColumns: '40px 1fr 112px 112px',
                                    gap: 8,
                                    alignItems: 'center',
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: '1px solid rgba(212,184,112,0.18)',
                                    background: 'rgba(0,0,0,0.28)',
                                }}
                            >
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 999,
                                        border: '1px solid rgba(212,184,112,0.28)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#f0d060',
                                        fontSize: 19,
                                    }}
                                >
                                    {icon}
                                </div>
                                <div style={{ fontSize: 14, color: '#ecd9a8' }}>
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
                                                minHeight: 32,
                                                padding: '7px 8px',
                                                borderRadius: 6,
                                                border: `1px solid ${waiting ? 'rgba(240,208,96,0.78)' : 'rgba(212,184,112,0.3)'}`,
                                                background: waiting ? 'rgba(18,12,0,0.96)' : 'rgba(0,0,0,0.62)',
                                                color: waiting ? '#ffe9aa' : '#d8c08b',
                                                fontSize: 13,
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
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '40px 1fr 112px 112px',
                            gap: 8,
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(212,184,112,0.18)',
                            background: 'rgba(0,0,0,0.22)',
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 999,
                                border: '1px solid rgba(212,184,112,0.28)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#f0d060',
                                fontSize: 14,
                                fontFamily: '"Courier New", monospace',
                                fontWeight: 'bold',
                            }}
                        >
                            II
                        </div>
                        <div style={{ fontSize: 14, color: '#ecd9a8' }}>
                            {text.actionLabels.pause}
                        </div>
                        <div
                            style={{
                                gridColumn: 'span 2',
                                minHeight: 32,
                                padding: '7px 8px',
                                borderRadius: 6,
                                border: '1px solid rgba(212,184,112,0.22)',
                                background: 'rgba(0,0,0,0.42)',
                                color: '#bfae82',
                                fontSize: 13,
                                fontFamily: '"Courier New", monospace',
                                letterSpacing: 1,
                                textAlign: 'center',
                                boxSizing: 'border-box',
                            }}
                        >
                            Esc
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(212,184,112,0.18)' }}>
                    <div style={{ fontSize: 13, letterSpacing: 2, color: '#c9a85e', marginBottom: 8 }}>
                        {text.saveTransfer.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(232,214,160,0.72)', marginBottom: 14 }}>
                        {text.saveTransferDescription}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <button
                            onClick={() => { void handleExport(); }}
                            disabled={saveTransferBusy}
                            title={text.exportSaveTitle}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 6,
                                border: '1px solid rgba(212,184,112,0.3)',
                                background: 'rgba(0,0,0,0.62)',
                                color: '#d8c08b',
                                fontSize: 14,
                                cursor: saveTransferBusy ? 'default' : 'pointer',
                                opacity: saveTransferBusy ? 0.72 : 1,
                            }}
                        >
                            {text.exportSave}
                        </button>
                        <button
                            onClick={handleImportClick}
                            disabled={saveTransferBusy}
                            title={text.importSaveTitle}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 6,
                                border: '1px solid rgba(212,184,112,0.3)',
                                background: 'rgba(0,0,0,0.62)',
                                color: '#d8c08b',
                                fontSize: 14,
                                cursor: saveTransferBusy ? 'default' : 'pointer',
                                opacity: saveTransferBusy ? 0.72 : 1,
                            }}
                        >
                            {text.importSave}
                        </button>
                    </div>
                    {confirmImportOpen && (
                        <div
                            style={{
                                marginTop: 14,
                                padding: 12,
                                borderRadius: 8,
                                border: '1px solid rgba(212,184,112,0.28)',
                                background: 'rgba(0,0,0,0.42)',
                            }}
                        >
                            <div style={{ fontSize: 12, lineHeight: 1.6, color: '#e7d39f', marginBottom: 10 }}>
                                {text.importSaveWarning}
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setConfirmImportOpen(false);
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        border: '1px solid rgba(212,184,112,0.24)',
                                        background: 'rgba(0,0,0,0.55)',
                                        color: '#d8c08b',
                                        fontSize: 13,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {text.importSaveNo}
                                </button>
                                <button
                                    onClick={() => {
                                        fileInputRef.current?.click();
                                    }}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: 6,
                                        border: '1px solid rgba(240,208,96,0.5)',
                                        background: 'rgba(20,14,0,0.9)',
                                        color: '#ffe9aa',
                                        fontSize: 13,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {text.importSaveYes}
                                </button>
                            </div>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.dmsave,.txt,application/json"
                        onChange={(event) => { void handleImportChange(event); }}
                        style={{ display: 'none' }}
                    />
                    <div
                        style={{
                            minHeight: 20,
                            marginTop: 12,
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: saveTransferMessage
                                ? (saveTransferMessage.success ? '#8fd18f' : '#de9a7a')
                                : 'rgba(232,214,160,0.62)',
                        }}
                    >
                        {saveTransferBusy
                            ? text.saveTransferBusy
                            : (saveTransferMessage?.message ?? text.saveTransferHint)}
                    </div>
                </div>
            </div>
        </div>
    );
};
