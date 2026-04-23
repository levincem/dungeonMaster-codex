import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../engine/store';
import { en } from '../../i18n/en';
import { didPartyTakeSingleStep } from './hudDerivedState';

type TutorialZoneKey =
    | 'dungeon-view'
    | 'party-portraits'
    | 'party-formation'
    | 'magic-rune-grid'
    | 'magic-caster-row'
    | 'magic-spell-composer'
    | 'combat-grid'
    | 'movement-grid';

type TutorialOverlayState =
    | { kind: 'hidden' }
    | { kind: 'hall-intro' }
    | { kind: 'guided-prompt' }
    | { kind: 'guided'; stepIndex: number };

type TutorialRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};

const HALL_START_POSITION: [number, number] = [3, 1];
const STARTING_GATE_PLATE_POSITION: [number, number] = [9, 6];
const INTRO_STEP_THRESHOLD = 2;

const HIGHLIGHT_PADDING_BY_ZONE: Record<TutorialZoneKey, number> = {
    'dungeon-view': 16,
    'party-portraits': 8,
    'party-formation': 8,
    'magic-rune-grid': 8,
    'magic-caster-row': 8,
    'magic-spell-composer': 8,
    'combat-grid': 8,
    'movement-grid': 8,
};

const ZONE_SELECTORS: Record<Exclude<TutorialZoneKey, 'dungeon-view'>, string> = {
    'party-portraits': '[data-tutorial-zone="party-portraits"]',
    'party-formation': '[data-tutorial-zone="party-formation"]',
    'magic-rune-grid': '[data-tutorial-zone="magic-rune-grid"]',
    'magic-caster-row': '[data-tutorial-zone="magic-caster-row"]',
    'magic-spell-composer': '[data-tutorial-zone="magic-spell-composer"]',
    'combat-grid': '[data-tutorial-zone="combat-grid"]',
    'movement-grid': '[data-tutorial-zone="movement-grid"]',
};

function isSamePosition(a: [number, number], b: [number, number]): boolean {
    return a[0] === b[0] && a[1] === b[1];
}

function rectFromDomRect(rect: DOMRect, padding: number): TutorialRect {
    return {
        left: Math.max(0, rect.left - padding),
        top: Math.max(0, rect.top - padding),
        width: Math.max(0, rect.width + padding * 2),
        height: Math.max(0, rect.height + padding * 2),
    };
}

function getFallbackRect(zone: TutorialZoneKey): TutorialRect | null {
    if (typeof window === 'undefined') return null;

    if (zone === 'dungeon-view') {
        return {
            left: 0,
            top: 0,
            width: window.innerWidth * 0.67,
            height: window.innerHeight,
        };
    }

    return null;
}

function getTutorialZoneRect(zone: TutorialZoneKey): TutorialRect | null {
    if (typeof document === 'undefined') return getFallbackRect(zone);
    if (zone === 'dungeon-view') return getFallbackRect(zone);

    const selector = ZONE_SELECTORS[zone];
    const element = selector ? document.querySelector<HTMLElement>(selector) : null;
    if (!element) return getFallbackRect(zone);
    return rectFromDomRect(
        element.getBoundingClientRect(),
        HIGHLIGHT_PADDING_BY_ZONE[zone],
    );
}

export const GameplayTutorialOverlay: React.FC = () => {
    const text = en.gameTutorial;
    const {
        gamePhase,
        level,
        position,
        party,
        tutorialOverlayActive,
        setTutorialOverlayActive,
    } = useStore(useShallow((state) => ({
        gamePhase: state.gamePhase,
        level: state.level,
        position: state.position,
        party: state.party,
        tutorialOverlayActive: state.tutorialOverlayActive,
        setTutorialOverlayActive: state.setTutorialOverlayActive,
    })));

    const [overlayState, setOverlayState] = useState<TutorialOverlayState>({ kind: 'hidden' });
    const [hallStepCount, setHallStepCount] = useState(0);
    const [hallIntroSeen, setHallIntroSeen] = useState(false);
    const [guidedPromptResolved, setGuidedPromptResolved] = useState(false);
    const [guidedCompleted, setGuidedCompleted] = useState(false);
    const [highlightRect, setHighlightRect] = useState<TutorialRect | null>(null);
    const previousPositionRef = useRef<{ level: number; position: [number, number] } | null>(null);
    const hallTutorialEligibleRef = useRef(false);

    const guidedSteps = useMemo(
        () => [
            { zone: 'dungeon-view' as const, message: text.steps.dungeonView },
            { zone: 'party-portraits' as const, message: text.steps.partyPortraits },
            { zone: 'party-formation' as const, message: text.steps.partyFormation },
            { zone: 'magic-rune-grid' as const, message: text.steps.runeSelection },
            { zone: 'magic-caster-row' as const, message: text.steps.spellCaster },
            { zone: 'magic-spell-composer' as const, message: text.steps.spellComposer },
            { zone: 'combat-grid' as const, message: text.steps.combatButtons },
            { zone: 'movement-grid' as const, message: text.steps.movementButtons },
        ],
        [text.steps],
    );

    useEffect(() => {
        if (gamePhase === 'title') {
            hallTutorialEligibleRef.current = false;
            setHallStepCount(0);
            setHallIntroSeen(false);
            setGuidedPromptResolved(false);
            setGuidedCompleted(false);
            setOverlayState({ kind: 'hidden' });
            previousPositionRef.current = null;
            return;
        }

        const isFreshHallStart =
            gamePhase === 'exploration' &&
            level === 0 &&
            isSamePosition(position, HALL_START_POSITION) &&
            party.length === 0;

        if (isFreshHallStart && !hallTutorialEligibleRef.current) {
            hallTutorialEligibleRef.current =
                true;
            setHallStepCount(0);
            setHallIntroSeen(false);
            setGuidedPromptResolved(false);
            setGuidedCompleted(false);
            setOverlayState({ kind: 'hidden' });
            previousPositionRef.current = { level, position };
        }
    }, [gamePhase, level, party.length, position]);

    useEffect(() => {
        const previous = previousPositionRef.current;
        const tookSingleStep = didPartyTakeSingleStep({
            previousLevel: previous?.level ?? null,
            nextLevel: level,
            previousPosition: previous?.position ?? null,
            nextPosition: position,
        });

        if (hallTutorialEligibleRef.current && gamePhase === 'exploration' && tookSingleStep) {
            if (!hallIntroSeen) {
                setHallStepCount((current) => current + 1);
            }

            const enteredGatePlate =
                isSamePosition(position, STARTING_GATE_PLATE_POSITION) &&
                !isSamePosition(previous?.position ?? [-1, -1], STARTING_GATE_PLATE_POSITION);

            if (
                enteredGatePlate &&
                party.length > 0 &&
                !guidedPromptResolved &&
                !guidedCompleted &&
                overlayState.kind === 'hidden'
            ) {
                setGuidedPromptResolved(true);
                setHallIntroSeen(true);
                setOverlayState({ kind: 'guided-prompt' });
            }
        }

        previousPositionRef.current = { level, position };
    }, [
        gamePhase,
        guidedCompleted,
        guidedPromptResolved,
        hallIntroSeen,
        level,
        overlayState.kind,
        party.length,
        position,
    ]);

    useEffect(() => {
        if (
            hallTutorialEligibleRef.current &&
            !hallIntroSeen &&
            hallStepCount >= INTRO_STEP_THRESHOLD &&
            overlayState.kind === 'hidden'
        ) {
            setHallIntroSeen(true);
            setOverlayState({ kind: 'hall-intro' });
        }
    }, [hallIntroSeen, hallStepCount, overlayState.kind]);

    useEffect(() => {
        const active = overlayState.kind !== 'hidden';
        if (tutorialOverlayActive !== active) {
            setTutorialOverlayActive(active);
        }
    }, [overlayState.kind, setTutorialOverlayActive, tutorialOverlayActive]);

    useEffect(() => {
        if (overlayState.kind !== 'guided') {
            setHighlightRect(null);
            return;
        }

        const step = guidedSteps[overlayState.stepIndex];
        const measure = () => {
            setHighlightRect(step ? getTutorialZoneRect(step.zone) : null);
        };

        measure();
        const rafId = window.requestAnimationFrame(measure);
        window.addEventListener('resize', measure);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', measure);
        };
    }, [guidedSteps, overlayState]);

    useEffect(() => {
        return () => {
            if (tutorialOverlayActive) {
                setTutorialOverlayActive(false);
            }
        };
    }, [setTutorialOverlayActive, tutorialOverlayActive]);

    if (overlayState.kind === 'hidden' || gamePhase === 'title') {
        return null;
    }

    const advanceGuidedStep = () => {
        if (overlayState.kind !== 'guided') return;
        const nextStepIndex = overlayState.stepIndex + 1;
        if (nextStepIndex >= guidedSteps.length) {
            setGuidedCompleted(true);
            setOverlayState({ kind: 'hidden' });
            return;
        }
        setOverlayState({ kind: 'guided', stepIndex: nextStepIndex });
    };

    const centerPanelStyle: React.CSSProperties = {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(760px, 86vw)',
        padding: '24px 28px',
        borderRadius: 14,
        border: '2px solid rgba(240, 204, 112, 0.72)',
        background: 'linear-gradient(180deg, rgba(8,8,8,0.98), rgba(20,16,10,0.98))',
        boxShadow: '0 24px 80px rgba(0,0,0,0.64)',
        color: '#f2dfad',
        textAlign: 'center',
        zIndex: 272,
    };

    if (overlayState.kind === 'hall-intro') {
        return (
            <div
                data-tutorial-overlay="true"
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.74)',
                    zIndex: 270,
                }}
            >
                <div style={centerPanelStyle}>
                    <div style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>{text.hallIntroTitle}</div>
                    <div style={{ fontSize: 20, lineHeight: 1.65 }}>{text.hallIntroMessage}</div>
                    <div style={{ marginTop: 26 }}>
                        <button
                            onClick={() => setOverlayState({ kind: 'hidden' })}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 999,
                                border: '1px solid rgba(240, 204, 112, 0.72)',
                                background: 'rgba(28,20,10,0.96)',
                                color: '#f2dfad',
                                fontSize: 16,
                                cursor: 'pointer',
                            }}
                        >
                            {text.continue}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (overlayState.kind === 'guided-prompt') {
        return (
            <div
                data-tutorial-overlay="true"
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.76)',
                    zIndex: 270,
                }}
            >
                <div style={centerPanelStyle}>
                    <div style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>{text.guidedPromptTitle}</div>
                    <div style={{ fontSize: 20, lineHeight: 1.65 }}>{text.guidedPromptMessage}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 28 }}>
                        <button
                            onClick={() => {
                                setGuidedCompleted(true);
                                setOverlayState({ kind: 'hidden' });
                            }}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 999,
                                border: '1px solid rgba(212,184,112,0.44)',
                                background: 'rgba(18,18,18,0.96)',
                                color: '#d8c48f',
                                fontSize: 16,
                                cursor: 'pointer',
                            }}
                        >
                            {text.no}
                        </button>
                        <button
                            onClick={() => setOverlayState({ kind: 'guided', stepIndex: 0 })}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 999,
                                border: '1px solid rgba(240, 204, 112, 0.72)',
                                background: 'rgba(28,20,10,0.96)',
                                color: '#f2dfad',
                                fontSize: 16,
                                cursor: 'pointer',
                            }}
                        >
                            {text.yes}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentStep = guidedSteps[overlayState.stepIndex];

    return (
        <div
            data-tutorial-overlay="true"
            onClick={advanceGuidedStep}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 270,
                cursor: 'pointer',
            }}
        >
            {highlightRect ? (
                <>
                    <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: highlightRect.top, background: 'rgba(0,0,0,0.76)' }} />
                    <div style={{ position: 'fixed', left: 0, top: highlightRect.top, width: highlightRect.left, height: highlightRect.height, background: 'rgba(0,0,0,0.76)' }} />
                    <div
                        style={{
                            position: 'fixed',
                            left: highlightRect.left + highlightRect.width,
                            top: highlightRect.top,
                            right: 0,
                            height: highlightRect.height,
                            background: 'rgba(0,0,0,0.76)',
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            left: 0,
                            top: highlightRect.top + highlightRect.height,
                            width: '100%',
                            bottom: 0,
                            background: 'rgba(0,0,0,0.76)',
                        }}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            left: highlightRect.left,
                            top: highlightRect.top,
                            width: highlightRect.width,
                            height: highlightRect.height,
                            borderRadius: 16,
                            border: '3px solid rgba(250, 216, 120, 0.98)',
                            boxShadow: '0 0 0 1px rgba(255,244,196,0.42), 0 0 22px rgba(255,196,96,0.32)',
                            pointerEvents: 'none',
                        }}
                    />
                </>
            ) : (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.76)' }} />
            )}

            <div
                style={{
                    ...centerPanelStyle,
                    pointerEvents: 'none',
                }}
            >
                <div style={{ fontSize: 20, lineHeight: 1.7, marginBottom: 16 }}>{currentStep.message}</div>
                <div style={{ fontSize: 13, letterSpacing: 2.4, color: '#d0ae62' }}>{text.clickToContinue}</div>
            </div>
        </div>
    );
};
