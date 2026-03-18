import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import config from '../constants/config';
import { NavigationRoute, GeocodingResult } from '../types';
import { speak, speakAndWait, stopSpeaking, listenForCommand } from '../services/voiceEngine';
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

type NavState = 'asking' | 'searching' | 'navigating' | 'arrived' | 'error';

export const NavigationScreen: React.FC = () => {
    const navigation = useNavigation();
    const [navState, setNavState] = useState<NavState>('asking');
    const [destinationName, setDestinationName] = useState('');
    const [currentInstruction, setCurrentInstruction] = useState('');
    const [distanceToTurn, setDistanceToTurn] = useState('');
    const [totalRemaining, setTotalRemaining] = useState('');
    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    const routeRef = useRef<NavigationRoute | null>(null);
    const destCoordsRef = useRef<[number, number] | null>(null);
    const activeRef = useRef(true);
    const lastAnnouncedStepRef = useRef(-1);
    const lastInstructionTimeRef = useRef(0);
    const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

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

        // Track user position for map
        setUserCoords([coords.longitude, coords.latitude]);

        // Check if arrived
        const destLat = destCoords[1]; // ORS is [lng, lat]
        const destLon = destCoords[0];
        if (hasArrived(destLat, destLon, coords.latitude, coords.longitude)) {
            setNavState('arrived');
            setCurrentInstruction('You have arrived!');
            hapticSuccess();
            speak(config.MESSAGES.NAV_ARRIVED);
            stopLocationTracking();
            return;
        }

        // Determine current step
        const stepIdx = getCurrentStepIndex(route, coords.latitude, coords.longitude);
        setCurrentStepIdx(stepIdx);

        const step = route.steps[stepIdx];
        if (!step) return;

        setCurrentInstruction(step.instruction);
        setDistanceToTurn(formatDistance(step.distance));

        // Calculate total remaining distance
        let remaining = 0;
        for (let i = stepIdx; i < route.steps.length; i++) {
            remaining += route.steps[i].distance;
        }
        setTotalRemaining(formatDistance(remaining));

        // Announce instruction if it's a new step or enough time has passed
        const now = Date.now();
        const shouldAnnounce =
            stepIdx !== lastAnnouncedStepRef.current ||
            (now - lastInstructionTimeRef.current) > config.NAVIGATION.INSTRUCTION_REPEAT_INTERVAL;

        if (shouldAnnounce) {
            lastAnnouncedStepRef.current = stepIdx;
            lastInstructionTimeRef.current = now;
            const msg = config.MESSAGES.NAV_TURN(step.instruction, formatDistance(step.distance));
            speak(msg);

            // Haptic for upcoming turn
            if (step.distance <= config.NAVIGATION.UPCOMING_TURN_DISTANCE) {
                hapticWarning();
            }
        }
    }, []);

    // ── Main navigation flow ──
    useEffect(() => {
        activeRef.current = true;

        const runFlow = async () => {
            // Retry loop for destination input — re-ask on failure instead of exiting
            const MAX_RETRIES = 3;
            let destination = null;
            let userLocation = null;

            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                if (!activeRef.current) return;

                // Step 1: Ask for destination
                setNavState('asking');
                if (attempt === 0) {
                    await speakAndWait(config.MESSAGES.NAV_ASK_DESTINATION);
                } else {
                    await speakAndWait('Please say the place name again.');
                }

                if (!activeRef.current) return;

                // Step 2: Listen for destination
                const result = await listenForCommand(5000);

                if (!activeRef.current) return;

                if (!result.text) {
                    await speakAndWait('I did not hear anything. Let me try again.');
                    continue;
                }

                const query = result.text;
                setDestinationName(query);
                setNavState('searching');
                await speakAndWait(config.MESSAGES.NAV_SEARCHING(query));

                if (!activeRef.current) return;

                // Step 3: Try to get user's current location
                userLocation = await getCurrentLocation();
                console.log('[Navigation] User location:', userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : 'unavailable');

                if (!activeRef.current) return;

                if (!userLocation) {
                    await speakAndWait('GPS location is not available. Please enable location services in your phone settings.');
                }

                // Step 4: Geocode — use focus point if we have location, otherwise global search
                let focusPoint: [number, number] | undefined;
                if (userLocation) {
                    focusPoint = [userLocation.longitude, userLocation.latitude];
                }
                const results = await geocodeAddress(query, focusPoint);

                console.log('[Navigation] Geocode results:', results.length, results.map(r => r.name));

                if (!activeRef.current) return;

                if (results.length === 0) {
                    await speakAndWait(config.MESSAGES.NAV_NOT_FOUND + ' Let me try again.');
                    continue;
                }

                destination = results[0];
                break; // Success — exit retry loop
            }

            // If all retries exhausted, go back
            if (!destination) {
                setNavState('error');
                await speakAndWait('Could not find a destination after multiple attempts. Going back.');
                navigation.goBack();
                return;
            }

            setDestinationName(destination.name);
            destCoordsRef.current = destination.coordinates;

            // Step 5: Get walking route
            // If we have user location, use it as start. Otherwise use destination minus a small offset as demo.
            let from: [number, number];
            if (userLocation) {
                from = [userLocation.longitude, userLocation.latitude];
            } else {
                // On web without GPS: use a point near the destination for demo purposes
                console.log('[Navigation] No GPS — using nearby point as start for route preview');
                from = [destination.coordinates[0] - 0.005, destination.coordinates[1] - 0.005];
            }
            const to = destination.coordinates;
            const route = await getWalkingRoute(from, to);

            console.log('[Navigation] Route:', route ? `${route.steps.length} steps, ${route.totalDistance}m` : 'not found');

            if (!activeRef.current) return;

            if (!route || route.steps.length === 0) {
                setNavState('error');
                await speakAndWait('Could not find a walking route to that destination.');
                navigation.goBack();
                return;
            }

            routeRef.current = route;

            // Step 6: Announce and start navigation
            setNavState('navigating');
            const totalDist = formatDistance(route.totalDistance);
            setTotalRemaining(totalDist);
            setCurrentInstruction(route.steps[0]?.instruction || 'Start walking');
            setDistanceToTurn(formatDistance(route.steps[0]?.distance || 0));

            hapticSuccess();
            await speakAndWait(config.MESSAGES.NAV_STARTED(destination.name, totalDist));

            if (!activeRef.current) return;

            // Speak first instruction (wait for it to finish before listening)
            if (route.steps[0]) {
                await speakAndWait(config.MESSAGES.NAV_TURN(route.steps[0].instruction, formatDistance(route.steps[0].distance)));
            }

            // Step 7: Start GPS tracking only if location is available
            if (userLocation) {
                await startLocationTracking(handleLocationUpdate);
            } else {
                console.log('[Navigation] GPS unavailable — showing route info without live tracking');
            }

            // Echo phrases to ignore (TTS output picked up by mic)
            const echoPatterns = [
                'where would you like to go',
                'searching for',
                'navigation started',
                'could not find',
                'walking route',
                'you have arrived',
                'navigation stopped',
                'detected',
                'meters ahead',
            ];

            // Step 8: Voice command listener loop (stop navigation / go back)
            while (activeRef.current && navState !== 'arrived') {
                const cmd = await listenForCommand(3000);
                if (!activeRef.current) break;

                if (cmd.text) {
                    const normalized = cmd.text.toLowerCase();

                    // Skip echo — text that matches TTS output
                    if (echoPatterns.some(p => normalized.includes(p))) {
                        console.log(`[Navigation] Ignoring echo: "${cmd.text}"`);
                        continue;
                    }

                    const stopCmds = config.VOICE_COMMANDS.STOP_NAVIGATION;
                    const backCmds = config.VOICE_COMMANDS.BACK;

                    if (stopCmds.some(c => normalized.includes(c))) {
                        await stopNav();
                        speak(config.MESSAGES.NAV_STOPPED);
                        hapticSelection();
                        navigation.goBack();
                        return;
                    }

                    if (backCmds.some(c => normalized.includes(c))) {
                        await goBack();
                        return;
                    }

                    // "repeat" — re-announce current instruction
                    const repeatCmds = config.VOICE_COMMANDS.REPEAT;
                    if (repeatCmds.some(c => normalized.includes(c))) {
                        const route = routeRef.current;
                        if (route && route.steps[currentStepIdx]) {
                            const step = route.steps[currentStepIdx];
                            await speakAndWait(config.MESSAGES.NAV_TURN(step.instruction, formatDistance(step.distance)));
                        }
                    }
                }

                await new Promise(r => setTimeout(r, 500));
            }
        };

        const timer = setTimeout(() => runFlow(), 500);

        return () => {
            activeRef.current = false;
            clearTimeout(timer);
            stopLocationTracking();
        };
    }, []);

    // ── Render ──
    const getStateIcon = (): string => {
        switch (navState) {
            case 'asking': return 'mic';
            case 'searching': return 'search';
            case 'navigating': return 'navigate';
            case 'arrived': return 'checkmark-circle';
            case 'error': return 'alert-circle';
            default: return 'navigate';
        }
    };

    const getStateColor = (): string => {
        switch (navState) {
            case 'asking': return theme.colors.primary;
            case 'searching': return theme.colors.warning;
            case 'navigating': return theme.colors.accent;
            case 'arrived': return theme.colors.success;
            case 'error': return theme.colors.danger;
            default: return theme.colors.primary;
        }
    };

    const getStateLabel = (): string => {
        switch (navState) {
            case 'asking': return 'Listening for destination...';
            case 'searching': return `Searching: "${destinationName}"`;
            case 'navigating': return `Navigating to ${destinationName}`;
            case 'arrived': return 'Arrived!';
            case 'error': return 'Navigation error';
            default: return '';
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

                {/* Map view — always visible */}
                <NavigationMap
                    routeGeometry={routeRef.current?.geometry}
                    userPosition={userCoords}
                    destination={destCoordsRef.current}
                    height={250}
                />

                {/* Current instruction — large for accessibility */}
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

                        {/* Progress info */}
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

                        {/* Stop button */}
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
        paddingBottom: theme.spacing.xl,
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
