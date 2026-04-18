import React from 'react';
import type { Translations } from '../../i18n';

type ManualSection = Translations['manual']['sections'][number];

export const ManualModal: React.FC<{
    manual: Translations['manual'];
    text: Translations['hud'];
    activeSectionId: string | null;
    onSelectSection: (sectionId: string) => void;
    onClose: () => void;
}> = ({ manual, text, activeSectionId, onSelectSection, onClose }) => {
    const activeSection: ManualSection | null = manual.sections.find((section) => section.id === activeSectionId)
        ?? manual.sections[0]
        ?? null;

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
                zIndex: 221,
                padding: 20,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    width: 'min(980px, 96vw)',
                    maxHeight: '88vh',
                    background: 'linear-gradient(180deg, rgba(7,7,7,0.98), rgba(18,15,10,0.98))',
                    border: '1px solid rgba(212,184,112,0.46)',
                    borderRadius: 12,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
                    padding: 22,
                    color: '#ead6a0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    overflow: 'hidden',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 13, letterSpacing: 3, color: '#c9a85e', marginBottom: 6 }}>{text.helpLabel}</div>
                        <div style={{ fontSize: 21, fontWeight: 'bold', color: '#f2dfad' }}>{manual.title}</div>
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
                            boxShadow: '0 4px 10px rgba(0,0,0,0.14)',
                            transition: 'box-shadow 0.12s ease, background 0.12s ease',
                        }}
                        title={text.close}
                    >
                        {'\u00d7'}
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 16, minHeight: 0, flex: 1 }}>
                    <div style={{ width: 236, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 4 }}>
                        {manual.sections.map((section) => {
                            const active = section.id === activeSection?.id;
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => onSelectSection(section.id)}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '11px 12px',
                                        borderRadius: 8,
                                        border: `1px solid ${active ? 'rgba(212,184,112,0.72)' : 'rgba(212,184,112,0.18)'}`,
                                        background: active
                                            ? 'linear-gradient(180deg, rgba(94,70,30,0.55), rgba(36,26,10,0.88))'
                                            : 'rgba(18,14,8,0.84)',
                                        color: active ? '#f2dfad' : 'rgba(232,214,160,0.82)',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        fontWeight: active ? 'bold' : 500,
                                        lineHeight: 1.35,
                                    }}
                                >
                                    {section.title}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 0,
                            overflowY: 'auto',
                            border: '1px solid rgba(212,184,112,0.16)',
                            borderRadius: 10,
                            background: 'rgba(10,8,4,0.72)',
                            padding: 20,
                        }}
                    >
                        {activeSection && (
                            <>
                                <div style={{ fontSize: 11, letterSpacing: 3, color: '#c9a85e', marginBottom: 8 }}>{text.helpLabel}</div>
                                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f2dfad', marginBottom: 16 }}>{activeSection.title}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15, lineHeight: 1.75, color: 'rgba(232,214,160,0.84)' }}>
                                    {activeSection.blocks.map((block, index) => (
                                        <p key={`${activeSection.id}-${index}`} style={{ margin: 0 }}>
                                            {block}
                                        </p>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: '1px solid rgba(212,184,112,0.4)',
                            background: 'linear-gradient(180deg, rgba(108,78,32,0.62), rgba(58,40,16,0.72))',
                            color: '#f2dfad',
                            fontSize: 14,
                            cursor: 'pointer',
                            boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                        }}
                    >
                        {text.helpContinue}
                    </button>
                </div>
            </div>
        </div>
    );
};
