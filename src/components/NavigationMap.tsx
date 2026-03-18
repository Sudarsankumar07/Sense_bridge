import React, { useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
    /** Route geometry as [lng, lat][] */
    routeGeometry?: [number, number][];
    /** User's current position [lng, lat] */
    userPosition?: [number, number] | null;
    /** Destination position [lng, lat] */
    destination?: [number, number] | null;
    /** Map height */
    height?: number;
};

/**
 * Renders an OpenStreetMap + Leaflet map in a WebView.
 * Shows the walking route, user marker, and destination marker.
 * Works in Expo Go — no native maps required.
 */
export const NavigationMap: React.FC<Props> = ({
    routeGeometry = [],
    userPosition,
    destination,
    height = 250,
}) => {
    const html = useMemo(() => {
        // Default center: destination, user position, first route point, or Chennai fallback
        const center = destination
            ? [destination[1], destination[0]]
            : userPosition
                ? [userPosition[1], userPosition[0]]
                : routeGeometry.length > 0
                    ? [routeGeometry[0][1], routeGeometry[0][0]]
                    : [13.08, 80.27];

        // Convert route from [lng, lat] to [lat, lng] for Leaflet
        const routeLatLngs = routeGeometry.map(([lng, lat]) => [lat, lng]);

        // Compute bounds for auto-zoom
        let boundsJs = '';
        if (routeLatLngs.length > 1) {
            boundsJs = `map.fitBounds(L.latLngBounds(routeCoords), { padding: [30, 30] });`;
        }

        const userMarkerJs = userPosition
            ? `L.circleMarker([${userPosition[1]}, ${userPosition[0]}], {
                radius: 8, color: '#3dd6ff', fillColor: '#3dd6ff', fillOpacity: 1, weight: 2
            }).addTo(map).bindPopup('You are here');`
            : '';

        const destMarkerJs = destination
            ? `L.marker([${destination[1]}, ${destination[0]}], {
                icon: L.divIcon({
                    className: 'dest-marker',
                    html: '<div style="background:#7cffb2;width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 8px rgba(124,255,178,0.8);"></div>',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                })
            }).addTo(map).bindPopup('Destination');`
            : '';

        return `<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100%; }
        .leaflet-control-attribution { display: none !important; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
        }).setView([${center[0]}, ${center[1]}], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        var routeCoords = ${JSON.stringify(routeLatLngs)};

        if (routeCoords.length > 1) {
            L.polyline(routeCoords, {
                color: '#3dd6ff',
                weight: 5,
                opacity: 0.85,
                lineJoin: 'round',
                lineCap: 'round',
            }).addTo(map);
            ${boundsJs}
        }

        ${userMarkerJs}
        ${destMarkerJs}
    </script>
</body>
</html>`;
    }, [routeGeometry, userPosition, destination]);

    // On web, use a div with dangerouslySetInnerHTML via an iframe approach
    if (Platform.OS === 'web') {
        return (
            <View style={[styles.container, { height }]}>
                <View style={styles.webFallback}>
                    {React.createElement('iframe', {
                        srcDoc: html,
                        style: {
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            borderRadius: 16,
                        },
                    })}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { height }]}>
            <WebView
                originWhitelist={['*']}
                source={{ html }}
                style={styles.webview}
                scrollEnabled={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={false}
                mixedContentMode="compatibility"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(61,214,255,0.3)',
        backgroundColor: '#1a1a2e',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    webFallback: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
});
