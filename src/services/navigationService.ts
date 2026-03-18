import { OPENROUTESERVICE_API_KEY } from '@env';
import config from '../constants/config';
import { GeocodingResult, NavigationRoute, NavigationStep } from '../types';

/**
 * Geocode a text query into coordinates using OpenRouteService.
 * Pass focusPoint [lng, lat] (user's current location) to bias results nearby.
 */
export const geocodeAddress = async (
    query: string,
    focusPoint?: [number, number]
): Promise<GeocodingResult[]> => {
    const apiKey = OPENROUTESERVICE_API_KEY;
    if (!apiKey || apiKey === 'your_ors_api_key_here') {
        console.warn('[NavigationService] ORS API key not configured');
        return [];
    }

    try {
        let url = `${config.API.ORS_GEOCODE}?api_key=${apiKey}&text=${encodeURIComponent(query)}&size=3`;

        // Bias results toward user's current location
        if (focusPoint) {
            url += `&focus.point.lon=${focusPoint[0]}&focus.point.lat=${focusPoint[1]}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!data.features || data.features.length === 0) {
            return [];
        }

        return data.features.map((feature: any) => ({
            name: feature.properties.name || feature.properties.label,
            label: feature.properties.label,
            coordinates: feature.geometry.coordinates as [number, number], // [lng, lat]
        }));
    } catch (error) {
        console.error('[NavigationService] Geocoding error:', error);
        return [];
    }
};

/**
 * Get a walking route between two points using OpenRouteService.
 * @param from [longitude, latitude]
 * @param to [longitude, latitude]
 */
export const getWalkingRoute = async (
    from: [number, number],
    to: [number, number]
): Promise<NavigationRoute | null> => {
    const apiKey = OPENROUTESERVICE_API_KEY;
    if (!apiKey || apiKey === 'your_ors_api_key_here') {
        console.warn('[NavigationService] ORS API key not configured');
        return null;
    }

    try {
        const url = `${config.API.ORS_DIRECTIONS}?api_key=${apiKey}&start=${from[0]},${from[1]}&end=${to[0]},${to[1]}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.features || data.features.length === 0) {
            console.warn('[NavigationService] No route found');
            return null;
        }

        const feature = data.features[0];
        const properties = feature.properties;
        const segments = properties.segments;

        if (!segments || segments.length === 0) {
            return null;
        }

        const steps: NavigationStep[] = segments[0].steps.map((step: any) => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            type: step.type,
            name: step.name || '',
        }));

        const geometry: [number, number][] = feature.geometry.coordinates;

        return {
            steps,
            totalDistance: properties.summary.distance,
            totalDuration: properties.summary.duration,
            geometry,
        };
    } catch (error) {
        console.error('[NavigationService] Route fetching error:', error);
        return null;
    }
};

/**
 * Calculate the distance in meters between two GPS coordinates (Haversine formula).
 */
export const getDistance = (
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Determine which step the user is currently on based on proximity
 * to the route geometry.
 */
export const getCurrentStepIndex = (
    route: NavigationRoute,
    userLat: number,
    userLon: number
): number => {
    // Walk along the route geometry, accumulating distance.
    // Find the closest point on the polyline, then map it to a step.
    let closestDistance = Infinity;
    let closestIdx = 0;

    for (let i = 0; i < route.geometry.length; i++) {
        const [lon, lat] = route.geometry[i];
        const dist = getDistance(userLat, userLon, lat, lon);
        if (dist < closestDistance) {
            closestDistance = dist;
            closestIdx = i;
        }
    }

    // Map geometry index to step index by accumulating step distances
    let accumulatedDistance = 0;
    let geometryDistanceToClosest = 0;

    for (let i = 0; i < closestIdx && i < route.geometry.length - 1; i++) {
        const [lon1, lat1] = route.geometry[i];
        const [lon2, lat2] = route.geometry[i + 1];
        geometryDistanceToClosest += getDistance(lat1, lon1, lat2, lon2);
    }

    for (let s = 0; s < route.steps.length; s++) {
        accumulatedDistance += route.steps[s].distance;
        if (accumulatedDistance >= geometryDistanceToClosest) {
            return s;
        }
    }

    return route.steps.length - 1;
};

/**
 * Calculate the approximate remaining distance from the user to the next turn
 * (the start of the step at stepIndex).
 */
export const getDistanceToNextTurn = (
    route: NavigationRoute,
    stepIndex: number,
    userLat: number,
    userLon: number
): number => {
    // Sum remaining distance from current step onward,
    // minus the distance already covered within the current step.
    if (stepIndex >= route.steps.length) return 0;

    // Approximate: distance from user to the end of the current step
    // For simplicity, use sum of step distances from current step
    let remaining = 0;
    for (let i = stepIndex; i < route.steps.length; i++) {
        remaining += route.steps[i].distance;
    }

    return remaining;
};

/**
 * Check if the user has arrived at the destination.
 */
export const hasArrived = (
    destLat: number, destLon: number,
    userLat: number, userLon: number,
    threshold: number = config.NAVIGATION.ARRIVAL_THRESHOLD
): boolean => {
    return getDistance(userLat, userLon, destLat, destLon) <= threshold;
};

/**
 * Format a distance into a human-readable string.
 */
export const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} kilometers`;
    }
    return `${Math.round(meters)} meters`;
};

/**
 * Format a duration in seconds into a human-readable string.
 */
export const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
        return `${Math.round(seconds)} seconds`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
};

/**
 * Calculate compass bearing from point A to point B (in degrees 0–360).
 */
export const getBearing = (
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number => {
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
    return bearing;
};

const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Convert a bearing difference to a human-readable direction word.
 */
export const getDirectionWord = (userHeading: number, targetBearing: number): string => {
    let diff = ((targetBearing - userHeading) + 360) % 360;

    if (diff <= 30 || diff >= 330) return 'ahead';
    if (diff > 30 && diff <= 60) return 'slightly right';
    if (diff > 60 && diff <= 120) return 'to your right';
    if (diff > 120 && diff <= 150) return 'behind to your right';
    if (diff > 150 && diff <= 210) return 'behind you';
    if (diff > 210 && diff <= 240) return 'behind to your left';
    if (diff > 240 && diff <= 300) return 'to your left';
    if (diff > 300 && diff < 330) return 'slightly left';

    return 'ahead';
};
