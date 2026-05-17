import React, { useRef, useState } from 'react';
import { formatKeybinding } from '../../engine/options';
import type { GameAction } from '../../engine/runtimeTypes';
import type { Locale, Translations } from '../../i18n';

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
type OptionsTabId = 'keybindings' | 'display' | 'saves' | 'language';

export const HudOptionsModal: React.FC<{
    open: boolean;
    text: Translations['hud'];
    currentLocale: Locale;
    showMinimap: boolean;
    keybindings: Record<GameAction, string[] | undefined>;
    rebindingTarget: HudRebindingTarget | null;
    onClose: () => void;
    onChangeLocale: (locale: Locale) => void;
    onToggleMinimap: () => void;
    onToggleBinding: (target: HudRebindingTarget) => void;
    onSaveGame: () => Promise<SaveTransferFeedback> | SaveTransferFeedback;
    onExportSave: () => Promise<SaveTransferFeedback> | SaveTransferFeedback;
    onImportSave: (file: File) => Promise<SaveTransferFeedback> | SaveTransferFeedback;
}> = ({
    open,
    text,
    currentLocale,
    showMinimap,
    keybindings,
    rebindingTarget,
    onClose,
    onChangeLocale,
    onToggleMinimap,
    onToggleBinding,
    onSaveGame,
    onExportSave,
    onImportSave,
}) => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [saveManagementMessage, setSaveManagementMessage] = useState<SaveTransferFeedback | null>(null);
    const [saveManagementBusy, setSaveManagementBusy] = useState(false);
    const [confirmImportOpen, setConfirmImportOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<OptionsTabId>('keybindings');

    if (!open) return null;

    const tabs: Array<{ id: OptionsTabId; label: string; subtitle: string }> = [
        { id: 'keybindings', label: text.keybindings, subtitle: text.clickToReassign },
        { id: 'display', label: text.display, subtitle: showMinimap ? text.minimapEnabled : text.minimapDisabled },
        { id: 'saves', label: text.saveManagement, subtitle: text.saveTransfer },
        { id: 'language', label: text.language, subtitle: currentLocale === 'fr' ? text.languageFrench : text.languageEnglish },
    ];

    const localeOptions: Array<{ locale: Locale; flag: string; label: string }> = [
        { locale: 'en', flag: '\uD83C\uDDEC\uD83C\uDDE7', label: text.languageEnglish },
        { locale: 'fr', flag: '\uD83C\uDDEB\uD83C\uDDF7', label: text.languageFrench },
    ];

    const activeTabDescription = activeTab === 'keybindings'
        ? (rebindingTarget === null ? text.clickToReassign : `${text.pressNewKey} ${text.pressEscToCancel}`)
        : activeTab === 'display'
            ? text.displayDescription
        : activeTab === 'saves'
            ? text.saveManagementDescription
            : text.languageDescription;

    const handleSaveGame = async () => {
        setSaveManagementBusy(true);
        try {
            setSaveManagementMessage(await onSaveGame());
        } finally {
            setSaveManagementBusy(false);
        }
    };

    const handleExport = async () => {
        setSaveManagementBusy(true);
        try {
            setSaveManagementMessage(await onExportSave());
        } finally {
            setSaveManagementBusy(false);
        }
    };

    const handleImportClick = () => {
        setConfirmImportOpen(true);
    };

    const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setSaveManagementBusy(true);
        try {
            setSaveManagementMessage(await onImportSave(file));
        } finally {
            setSaveManagementBusy(false);
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
                    width: 'min(880px, 94vw)',
                    maxHeight: 'min(82vh, 780px)',
                    overflow: 'hidden',
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
                        <div style={{ fontSize: 21, fontWeight: 'bold', color: '#f2dfad' }}>
                            {tabs.find((tab) => tab.id === activeTab)?.label ?? text.options}
                        </div>
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
                    {activeTabDescription}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(168px, 196px) minmax(0, 1fr)',
                    gap: 18,
                    alignItems: 'start',
                }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                        {tabs.map((tab) => {
                            const active = tab.id === activeTab;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        border: `1px solid ${active ? 'rgba(240,208,96,0.58)' : 'rgba(212,184,112,0.18)'}`,
                                        background: active
                                            ? 'linear-gradient(180deg, rgba(30,22,10,0.96), rgba(12,9,5,0.98))'
                                            : 'rgba(0,0,0,0.28)',
                                        color: active ? '#f5e5b4' : '#d9c287',
                                        boxShadow: active ? '0 10px 24px rgba(0,0,0,0.22)' : 'none',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 4,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <span style={{ fontSize: 14, fontWeight: 'bold' }}>{tab.label}</span>
                                    <span style={{ fontSize: 11, lineHeight: 1.4, opacity: 0.72 }}>{tab.subtitle}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{
                        minWidth: 0,
                        minHeight: 420,
                        maxHeight: 'min(56vh, 520px)',
                        overflow: 'auto',
                        paddingRight: 4,
                    }}>
                        {activeTab === 'keybindings' && (
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
                        )}

                        {activeTab === 'display' && (
                            <div style={{ display: 'grid', gap: 12 }}>
                                <div
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: 10,
                                        border: '1px solid rgba(212,184,112,0.22)',
                                        background: 'rgba(0,0,0,0.32)',
                                        color: '#dfc891',
                                        display: 'grid',
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'grid', gap: 4 }}>
                                            <span style={{ fontSize: 15, fontWeight: 'bold', color: '#f5e5b4' }}>{text.minimap}</span>
                                            <span style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>{text.minimapDescription}</span>
                                        </div>
                                        <span
                                            style={{
                                                minWidth: 88,
                                                textAlign: 'right',
                                                fontSize: 12,
                                                letterSpacing: 1,
                                                textTransform: 'uppercase',
                                                color: showMinimap ? '#f0d060' : 'rgba(223,200,145,0.58)',
                                            }}
                                        >
                                            {showMinimap ? text.minimapEnabled : text.minimapDisabled}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onToggleMinimap}
                                        style={{
                                            justifySelf: 'start',
                                            minHeight: 36,
                                            padding: '9px 14px',
                                            borderRadius: 8,
                                            border: `1px solid ${showMinimap ? 'rgba(240,208,96,0.52)' : 'rgba(212,184,112,0.3)'}`,
                                            background: showMinimap ? 'rgba(20,14,0,0.9)' : 'rgba(0,0,0,0.62)',
                                            color: showMinimap ? '#ffe9aa' : '#d8c08b',
                                            fontSize: 13,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {showMinimap ? text.minimapToggleOff : text.minimapToggleOn}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'saves' && (
                            <div style={{ paddingTop: 2 }}>
                                <div style={{ fontSize: 13, letterSpacing: 2, color: '#c9a85e', marginBottom: 8 }}>
                                    {text.saveCurrentRun.toUpperCase()}
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(232,214,160,0.72)', marginBottom: 14 }}>
                                    {text.saveCurrentRunDescription}
                                </div>
                                <div style={{ marginBottom: 18 }}>
                                    <button
                                        onClick={() => { void handleSaveGame(); }}
                                        disabled={saveManagementBusy}
                                        title={text.saveCurrentRunTitle}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 6,
                                            border: '1px solid rgba(212,184,112,0.3)',
                                            background: 'rgba(0,0,0,0.62)',
                                            color: '#d8c08b',
                                            fontSize: 14,
                                            cursor: saveManagementBusy ? 'default' : 'pointer',
                                            opacity: saveManagementBusy ? 0.72 : 1,
                                        }}
                                    >
                                        {text.saveGame}
                                    </button>
                                </div>

                                <div style={{ fontSize: 13, letterSpacing: 2, color: '#c9a85e', marginBottom: 8 }}>
                                    {text.saveTransfer.toUpperCase()}
                                </div>
                                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(232,214,160,0.72)', marginBottom: 14 }}>
                                    {text.saveTransferDescription}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <button
                                        onClick={() => { void handleExport(); }}
                                        disabled={saveManagementBusy}
                                        title={text.exportSaveTitle}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 6,
                                            border: '1px solid rgba(212,184,112,0.3)',
                                            background: 'rgba(0,0,0,0.62)',
                                            color: '#d8c08b',
                                            fontSize: 14,
                                            cursor: saveManagementBusy ? 'default' : 'pointer',
                                            opacity: saveManagementBusy ? 0.72 : 1,
                                        }}
                                    >
                                        {text.exportSave}
                                    </button>
                                    <button
                                        onClick={handleImportClick}
                                        disabled={saveManagementBusy}
                                        title={text.importSaveTitle}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 6,
                                            border: '1px solid rgba(212,184,112,0.3)',
                                            background: 'rgba(0,0,0,0.62)',
                                            color: '#d8c08b',
                                            fontSize: 14,
                                            cursor: saveManagementBusy ? 'default' : 'pointer',
                                            opacity: saveManagementBusy ? 0.72 : 1,
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
                                        color: saveManagementMessage
                                            ? (saveManagementMessage.success ? '#8fd18f' : '#de9a7a')
                                            : 'rgba(232,214,160,0.62)',
                                    }}
                                >
                                    {saveManagementBusy
                                        ? text.saveTransferBusy
                                        : (saveManagementMessage?.message ?? text.saveTransferHint)}
                                </div>
                            </div>
                        )}

                        {activeTab === 'language' && (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {localeOptions.map((option) => {
                                    const selected = option.locale === currentLocale;
                                    const chooseLabel = text.languageChoose.replace('{language}', option.label);
                                    return (
                                        <button
                                            key={option.locale}
                                            type="button"
                                            onClick={() => onChangeLocale(option.locale)}
                                            title={selected ? text.languageSelected : chooseLabel}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '52px 1fr auto',
                                                alignItems: 'center',
                                                gap: 14,
                                                padding: '14px 16px',
                                                borderRadius: 10,
                                                border: `1px solid ${selected ? 'rgba(240,208,96,0.58)' : 'rgba(212,184,112,0.22)'}`,
                                                background: selected
                                                    ? 'linear-gradient(180deg, rgba(34,26,12,0.96), rgba(14,10,6,0.98))'
                                                    : 'rgba(0,0,0,0.32)',
                                                color: selected ? '#f7e5b0' : '#dfc891',
                                                cursor: selected ? 'default' : 'pointer',
                                                textAlign: 'left',
                                                boxShadow: selected ? '0 10px 24px rgba(0,0,0,0.24)' : 'none',
                                                opacity: selected ? 1 : 0.94,
                                            }}
                                            disabled={selected}
                                        >
                                            <span style={{
                                                width: 44,
                                                height: 44,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: 999,
                                                border: '1px solid rgba(212,184,112,0.24)',
                                                background: 'rgba(0,0,0,0.22)',
                                                fontSize: 24,
                                            }}
                                            >
                                                {option.flag}
                                            </span>
                                            <span style={{ display: 'grid', gap: 2 }}>
                                                <span style={{ fontSize: 15, fontWeight: 'bold' }}>{option.label}</span>
                                                <span style={{ fontSize: 12, opacity: 0.76 }}>
                                                    {selected ? text.languageSelected : chooseLabel}
                                                </span>
                                            </span>
                                            <span style={{
                                                minWidth: 88,
                                                textAlign: 'right',
                                                fontSize: 12,
                                                letterSpacing: 1,
                                                textTransform: 'uppercase',
                                                color: selected ? '#f0d060' : 'rgba(223,200,145,0.58)',
                                            }}
                                            >
                                                {selected ? text.languageSelected : ''}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
