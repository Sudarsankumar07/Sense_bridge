export const theme = {
    colors: {
        background: '#0b0f14',
        surface: '#121923',
        surfaceAlt: '#182232',
        primary: '#3dd6ff',
        primaryDeep: '#1d9bd7',
        accent: '#7cffb2',
        warning: '#ffb020',
        danger: '#ff5470',
        text: '#e8f0f7',
        textMuted: '#9fb1c3',
        border: '#243243',
        glass: 'rgba(18, 25, 35, 0.75)',

        // Interactive states
        primaryHover: '#5de0ff',
        primaryPressed: '#2bb8e6',
        accentHover: '#9cffcc',
        accentPressed: '#5cef92',

        // Glassmorphism overlays
        glassLight: 'rgba(255, 255, 255, 0.05)',
        glassDark: 'rgba(0, 0, 0, 0.2)',
        glassAccent: 'rgba(61, 214, 255, 0.08)',

        // Status colors
        success: '#7cffb2',
        info: '#3dd6ff',
        error: '#ff5470',
    },
    gradients: {
        hero: ['#0b0f14', '#0f1824', '#111e2d'],
        card: ['#141c27', '#101826'],
        pulse: ['rgba(61,214,255,0.2)', 'rgba(61,214,255,0)'],
        success: ['#0e2a22', '#0b1e18'],
        warning: ['#2b210d', '#171105'],

        // Glassmorphism gradients
        glass: ['rgba(18, 25, 35, 0.95)', 'rgba(18, 25, 35, 0.85)'],
        glassCard: ['rgba(20, 28, 39, 0.9)', 'rgba(16, 24, 38, 0.8)'],
        shimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'],
    },
    spacing: {
        xs: 6,
        sm: 10,
        md: 16,
        lg: 22,
        xl: 30,
        xxl: 44,
    },
    radius: {
        sm: 10,
        md: 16,
        lg: 22,
        xl: 30,
        pill: 999,
    },
    typography: {
        display: {
            fontSize: 32,
            fontWeight: '700' as const,
            letterSpacing: -0.5,
            lineHeight: 38,
        },
        h1: {
            fontSize: 28,
            fontWeight: '700' as const,
            letterSpacing: -0.3,
            lineHeight: 34,
        },
        h2: {
            fontSize: 22,
            fontWeight: '600' as const,
            letterSpacing: -0.2,
            lineHeight: 28,
        },
        h3: {
            fontSize: 18,
            fontWeight: '600' as const,
            letterSpacing: 0,
            lineHeight: 24,
        },
        body: {
            fontSize: 16,
            fontWeight: '400' as const,
            lineHeight: 22,
            letterSpacing: 0,
        },
        bodyStrong: {
            fontSize: 16,
            fontWeight: '600' as const,
            lineHeight: 22,
            letterSpacing: 0,
        },
        bodyLarge: {
            fontSize: 18,
            fontWeight: '400' as const,
            lineHeight: 26,
            letterSpacing: 0,
        },
        caption: {
            fontSize: 14,
            fontWeight: '500' as const,
            lineHeight: 18,
            letterSpacing: 0.1,
        },
        small: {
            fontSize: 12,
            fontWeight: '400' as const,
            lineHeight: 16,
            letterSpacing: 0.2,
        },
    },
    shadows: {
        soft: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 6,
        },
        lifted: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 12,
        },
        glow: {
            shadowColor: '#3dd6ff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
        },
        glowAccent: {
            shadowColor: '#7cffb2',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 7,
        },
    },

    // Animation configurations
    animations: {
        // Timing  
        durations: {
            fast: 200,
            normal: 300,
            slow: 500,
            verySlow: 800,
        },

        // Spring configurations for react-native-reanimated
        spring: {
            gentle: {
                damping: 20,
                stiffness: 90,
            },
            bouncy: {
                damping: 10,
                stiffness: 100,
            },
            stiff: {
                damping: 15,
                stiffness: 150,
            },
        },

        // Easing curves
        easing: {
            easeOut: [0.25, 0.1, 0.25, 1] as const,
            easeIn: [0.42, 0, 1, 1] as const,
            easeInOut: [0.42, 0, 0.58, 1] as const,
            spring: [0.5, 1.5, 0.5, 1] as const,
        },
    },

    // Glassmorphism utilities
    glassmorphism: {
        card: {
            backgroundColor: 'rgba(18, 25, 35, 0.75)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        overlay: {
            backgroundColor: 'rgba(11, 15, 20, 0.85)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.05)',
        },
    },
};

export type Theme = typeof theme;
