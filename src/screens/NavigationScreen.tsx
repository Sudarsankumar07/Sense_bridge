import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import config from '../constants/config';
import { NavigationRoute, GeocodingResult } from '../types';
import { speak, speakAndWait, stopSpeaking } from '../services/voiceEngine';
import { hapticSelection, hapticSuccess, hapticWarning } from '../services/haptics';
import {
    geocodeAddress,
    getWalkingRoute,
    getCurrentStepIndex,
    hasArrived,
    formatDistance,
    formatDuration,
} from '../services/navigationService';
import {
    getCurrentLocation,
    startLocationTracking,
    stopLocationTracking,
    LocationCoords,
} from '../services/locationService';
import { NavigationMap } from '../components/NavigationMap';
import { MicFAB } from '../components/MicFAB';
import { useVolumeButtonTrigger } from '../hooks/useVolumeButtonTrigger';

type NavState = 'idle' | 'asking' | 'searching' | 'navigating' | 'arrived' | 'error';

export const NavigationScreen: React.FC = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const [navState, setNavState] = useState<NavState>('idle');
    const [destinationName, setDestinationName] = useState('');
    const [currentInstruction, setCurrentInstruction] = useState('');
    const [distanceToTurn, setDistanceToTurn] = useState('');
    const [totalRemaining, setTotalRemaining] = useState('');
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [fabDisabled, setFabDisabled] = useState(false);

    const routeRef = useRef<NavigationRoute | null>(null);
    const destCoordsRef = useRef<[number, number] | null>(null);
    const activeRef = useRef(true);
    const lastAnnouncedStepRef = useRef(-1);
    const lastInstructionTimeRef = useRef(0);
    const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

    // Ref that MicFAB exposes its trigger into (used by volume key hook)
    const micTriggerRef = useRef<(() => void) | null>(null);

    // ── Stop navigation and clean up ──
    const stopNav = useCallback(async () => {
        activeRef.current = false;
        await stopLocationTracking();
        stopSpeaking();
    }, []);

    // ── Go back ──
    const goBack = useCallback(async () => {
        await stopNav();
        hapticSelection();
        navigation.goBack();
    }, [stopNav, navigation]);

    // ── Handle GPS updates during navigation ──
    const handleLocationUpdate = useCallback((coords: LocationCoords) => {
        const route = routeRef.current;
        const destCoords = destCoordsRef.current;
        if (!route || !destCoords || !activeRef.current) return;

        setUserCoords([coords.longitude, coords.latitude]);

        const destLat = destCoords[1];
        const destLon = destCoords[0];
        if (hasArrived(destLat, destLon, coords.latitude, coords.longitude)) {
            setNavState('arrived');
            setCurrentInstruction('You have arrived!');
            hapticSuccess();
            speak(config.MESSAGES.NAV_ARRIVED);
            stopLocationTracking();
            return;
        }

        const stepIdx = getCurrentStepIndex(route, coords.latitude, coords.longitude);
        setCurrentStepIdx(stepIdx);

        const step = route.steps[stepIdx];
        if (!step) return;

        setCurrentInstruction(step.instruction);
        setDistanceToTurn(formatDistance(step.distance));

        let remaining = 0;
        for (let i = stepIdx; i < route.steps.length; i++) {
            remaining += route.steps[i].distance;
        }
        setTotalRemaining(formatDistance(remaining));

        const now = Date.now();
        const shouldAnnounce =
            stepIdx !== lastAnnouncedStepRef.current ||
            (now - lastInstructionTimeRef.current) > config.NAVIGATION.INSTRUCTION_REPEAT_INTERVAL;

        if (shouldAnnounce) {
            lastAnnouncedStepRef.current = stepIdx;
            lastInstructionTimeRef.current = now;
            const msg = config.MESSAGES.NAV_TURN(step.instruction, formatDistance(step.distance));
            speak(msg);

            if (step.distance <= config.NAVIGATION.UPCOMING_TURN_DISTANCE) {
                hapticWarning();
            }
        }
    }, []);

    // ── Main navigation flow ──
    // Now uses a SINGLE listenForCommand call (triggered by FAB / volume keys)
    // instead of a continuous listen loop.
    useEffect(() => {
        activeRef.current = true;

        const runFlow = async () => {
            const MAX_RETRIES = 3;
            let destination: GeocodingResult | null = null;
            let userLocation = null;

            // ── Phase 1: Ask for destination ──
            // Disable FAB while we run the guided TTS flow
            setFabDisabled(true);

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                if (!activeRef.current) return;

                setNavState('asking');
                if (attempt === 0) {
                    await speakAndWait(
                        config.MESSAGES.NAV_ASK_DESTINATION +
                        ' Press both volume keys or tap the mic button to speak.'
                    );
                } else {
                    await speakAndWait('Please say the place name again. Tap the mic button when ready.');
                }

                if (!activeRef.current) return;

                // Enable FAB so user can press it (or use volume keys)
                setFabDisabled(false);
                setNavState('asking');

                // Wait for the user to press FAB/volume keys.
                // MicFAB will fire onCommandReceived which resolves this promise.
                const spokenText = await waitForMicInput();

                setFabDisabled(true);

                if (!activeRef.current) return;

                if (!spokenText) {
                    await speakAndWait('I did not hear anything. Please try again.');
                    continue;
                }

                setDestinationName(spokenText);
                setNavState('searching');
                await speakAndWait(config.MESSAGES.NAV_SEARCHING(spokenText));

                if (!activeRef.current) return;

                userLocation = await getCurrentLocation();

                if (!activeRef.current) return;

                if (!userLocation) {
                    await speakAndWait('GPS not available. Please enable location services.');
                }

                let focusPoint: [number, number] | undefined;
                if (userLocation) {
                    focusPoint = [userLocation.longitude, userLocation.latitude];
                }
                const results = await geocodeAddress(spokenText, focusPoint);

                if (!activeRef.current) return;

                if (results.length === 0) {
                    await speakAndWait(config.MESSAGES.NAV_NOT_FOUND + ' Let me try again.');
                    continue;
                }

                destination = results[0];
                break;
            }

            if (!destination) {
                setNavState('error');
                await speakAndWait('Could not find a destination after multiple attempts. Going back.');
                navigation.goBack();
                return;
            }

            setDestinationName(destination.name);
            destCoordsRef.current = destination.coordinates;

            // ── Phase 2: Get walking route ──
            let from: [number, number];
            if (userLocation) {
                from = [userLocation.longitude, userLocation.latitude];
            } else {
                from = [destination.coordinates[0] - 0.005, destination.coordinates[1] - 0.005];
            }
            const to = destination.coordinates;
            const route = await getWalkingRoute(from, to);

            if (!activeRef.current) return;

            if (!route || route.steps.length === 0) {
                setNavState('error');
                await speakAndWait('Could not find a walking route to that destination.');
                navigation.goBack();
                return;
            }

            routeRef.current = route;

            // ── Phase 3: Start navigation ──
            setNavState('navigating');
            const totalDist = formatDistance(route.totalDistance);
            setTotalRemaining(totalDist);
            setCurrentInstruction(route.steps[0]?.instruction || 'Start walking');
            setDistanceToTurn(formatDistance(route.steps[0]?.distance || 0));

            hapticSuccess();
            await speakAndWait(config.MESSAGES.NAV_STARTED(destination.name, totalDist));

            if (!activeRef.current) return;

            if (route.steps[0]) {
                await speakAndWait(
                    config.MESSAGES.NAV_TURN(route.steps[0].instruction, formatDistance(route.steps[0].distance))
                );
            }

            if (userLocation) {
                await startLocationTracking(handleLocationUpdate);
            }

            // Now re-enable FAB for in-navigation commands (stop / repeat / back)
            setFabDisabled(false);
            await speakAndWait(
                'Navigation started. Press both volume keys or tap mic to say stop, repeat, or back.'
            );
        };

        const timer = setTimeout(() => runFlow(), 500);

        return () => {
            activeRef.current = false;
            clearTimeout(timer);
            stopLocationTracking();
        };
    }, []);

    // ── Wait for MicFAB input (promise-based) ──
    // MicFAB resolves the pending resolver when a command is received.
    const pendingMicResolve = useRef<((text: string | null) => void) | null>(null);

    const waitForMicInput = useCallback((): Promise<string | null> => {
        return new Promise(resolve => {
            pendingMicResolve.current = resolve;
        });
    }, []);

    // ── Handle in-navigation voice commands (stop / repeat / back) ──
    const handleNavCommand = useCallback(
        async (text: string) => {
            const normalized = text.toLowerCase();

            // If we're waiting for destination input, resolve the promise
            if (pendingMicResolve.current) {
                const resolver = pendingMicResolve.current;
                pendingMicResolve.current = null;
                resolver(text);
                return;
            }

            // In-navigation commands
            if (navState === 'navigating') {
                const stopCmds = config.VOICE_COMMANDS.STOP_NAVIGATION;
                const backCmds = config.VOICE_COMMANDS.BACK;
                const repeatCmds = config.VOICE_COMMANDS.REPEAT;

                if (stopCmds?.some((c: string) => normalized.includes(c))) {
                    await stopNav();
                    speak(config.MESSAGES.NAV_STOPPED);
                    hapticSelection();
                    navigation.goBack();
                    return;
                }

                if (backCmds?.some((c: string) => normalized.includes(c))) {
                    await goBack();
                    return;
                }

                if (repeatCmds?.some((c: string) => normalized.includes(c))) {
                    const route = routeRef.current;
                    if (route && route.steps[currentStepIdx]) {
                        const step = route.steps[currentStepIdx];
                        speakAndWait(config.MESSAGES.NAV_TURN(step.instruction, formatDistance(step.distance)));
                    }
                }
            }
        },
        [navState, currentStepIdx, stopNav, goBack, navigation]
    );

    // ── Volume Up + Down combo → fire MicFAB ──
    useVolumeButtonTrigger({
        enabled: isFocused,
        onTrigger: () => {
            micTriggerRef.current?.();
        },
    });

    // ── Render helpers ──
    const getStateIcon = (): string => {
        switch (navState) {
            case 'asking':    return 'mic';
            case 'searching': return 'search';
            case 'navigating': return 'navigate';
            case 'arrived':   return 'checkmark-circle';
            case 'error':     return 'alert-circle';
            default:          return 'navigate';
        }
    };

    const getStateColor = (): string => {
        switch (navState) {
            case 'asking':    return theme.colors.primary;
            case 'searching': return theme.colors.warning;
            case 'navigating': return theme.colors.accent;
            case 'arrived':   return theme.colors.success;
            case 'error':     return theme.colors.danger;
            default:          return theme.colors.primary;
        }
    };

    const getStateLabel = (): string => {
        switch (navState) {
            case 'idle':      return 'Starting...';
            case 'asking':    return fabDisabled
                ? 'Listen for instructions...'
                : 'Tap mic or press Vol↑+Vol↓ to say destination';
            case 'searching': return `Searching: "${destinationName}"`;
            case 'navigating': return `Navigating to ${destinationName}`;
            case 'arrived':   return 'Arrived!';
            case 'error':     return 'Navigation error';
            default:          return '';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={goBack}
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Navigation</Text>
                <Text style={styles.subtitle}>Voice-guided walking directions</Text>
            </LinearGradient>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
                {/* State indicator */}
                <View style={[styles.stateCard, { borderColor: getStateColor() }]}>
                    <View style={styles.stateRow}>
                        <Ionicons
                            name={getStateIcon() as any}
                            size={28}
                            color={getStateColor()}
                        />
                        <Text style={[styles.stateLabel, { color: getStateColor() }]}>
                            {getStateLabel()}
                        </Text>
                    </View>
                </View>

                {/* Map view */}
                <NavigationMap
                    routeGeometry={routeRef.current?.geometry}
                    userPosition={userCoords}
                    destination={destCoordsRef.current}
                    height={250}
                />

                {/* Current instruction */}
                {navState === 'navigating' && (
                    <>
                        <View style={styles.instructionCard}>
                            <MaterialCommunityIcons
                                name="directions-fork"
                                size={32}
                                color={theme.colors.accent}
                                style={styles.instructionIcon}
                            />
                            <Text style={styles.instructionText}>
                                {currentInstruction}
                            </Text>
                            <Text style={styles.distanceText}>
                                {distanceToTurn}
                            </Text>
                        </View>

                        <View style={styles.progressRow}>
                            <View style={styles.progressItem}>
                                <Text style={styles.progressLabel}>Remaining</Text>
                                <Text style={styles.progressValue}>{totalRemaining}</Text>
                            </View>
                            <View style={styles.progressItem}>
                                <Text style={styles.progressLabel}>Step</Text>
                                <Text style={styles.progressValue}>
                                    {currentStepIdx + 1} / {routeRef.current?.steps.length || '—'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.stopButton}
                            onPress={async () => {
                                await stopNav();
                                speak(config.MESSAGES.NAV_STOPPED);
                                hapticSelection();
                                navigation.goBack();
                            }}
                            accessibilityLabel="Stop navigation"
                            accessibilityRole="button"
                        >
                            <Ionicons name="close-circle" size={24} color="#fff" />
                            <Text style={styles.stopButtonText}>Stop Navigation</Text>
                        </TouchableOpacity>
                    </>
                )}

                {/* Arrived state */}
                {navState === 'arrived' && (
                    <View style={styles.arrivedCard}>
                        <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
                        <Text style={styles.arrivedText}>
                            You have arrived at {destinationName}
                        </Text>
                        <TouchableOpacity
                            style={styles.doneButton}
                            onPress={goBack}
                            accessibilityLabel="Done"
                            accessibilityRole="button"
                        >
                            <Text style={styles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Floating Mic FAB — bottom-right */}
            <MicFAB
                triggerRef={micTriggerRef}
                listenTimeoutMs={5000}
                disabled={fabDisabled}
                onCommandReceived={handleNavCommand}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    hero: {
        padding: theme.spacing.lg,
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        top: theme.spacing.md,
        left: theme.spacing.md,
        width: 40,
        height: 40,
        borderRadius: theme.radius.md,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.sm,
    },
    content: {
        flex: 1,
        padding: theme.spacing.lg,
    },
    contentInner: {
        gap: theme.spacing.lg,
        paddingBottom: 100, // Space for FAB
    },
    stateCard: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 2,
    },
    stateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    stateLabel: {
        ...theme.typography.bodyStrong,
        flex: 1,
    },
    instructionCard: {
        padding: theme.spacing.xl,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        alignItems: 'center',
    },
    instructionIcon: {
        marginBottom: theme.spacing.md,
    },
    instructionText: {
        ...theme.typography.h2,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: theme.spacing.sm,
    },
    distanceText: {
        ...theme.typography.display,
        color: theme.colors.accent,
        textAlign: 'center',
    },
    progressRow: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    progressItem: {
        flex: 1,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    progressLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
    },
    progressValue: {
        ...theme.typography.bodyStrong,
        color: theme.colors.text,
        marginTop: theme.spacing.xs,
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.danger,
    },
    stopButtonText: {
        ...theme.typography.bodyStrong,
        color: '#fff',
    },
    arrivedCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
    },
    arrivedText: {
        ...theme.typography.h2,
        color: theme.colors.text,
        textAlign: 'center',
    },
    doneButton: {
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.primary,
    },
    doneButtonText: {
        ...theme.typography.bodyStrong,
        color: theme.colors.background,
    },
});
