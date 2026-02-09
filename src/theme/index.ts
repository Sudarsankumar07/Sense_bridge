export const theme = {
    colors: {
        background: '#0a0a0a',
        surface: '#1a1a1a',
        primary: '#00d4ff', // Neon blue
        primaryDark: '#0099cc',
        secondary: '#ff00ff',
        accent: '#00ff88',
        text: '#ffffff',
        textSecondary: '#a0a0a0',
        error: '#ff3366',
        success: '#00ff88',
        warning: '#ffaa00',
        border: '#333333',
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },
    borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        full: 9999,
    },
    typography: {
        h1: {
            fontSize: 32,
            fontWeight: 'bold' as const,
            lineHeight: 40,
        },
        h2: {
            fontSize: 24,
            fontWeight: 'bold' as const,
            lineHeight: 32,
        },
        h3: {
            fontSize: 20,
            fontWeight: '600' as const,
            lineHeight: 28,
        },
        body: {
            fontSize: 16,
            fontWeight: 'normal' as const,
            lineHeight: 24,
        },
        bodyLarge: {
            fontSize: 18,
            fontWeight: 'normal' as const,
            lineHeight: 26,
        },
        caption: {
            fontSize: 14,
            fontWeight: 'normal' as const,
            lineHeight: 20,
        },
    },
    shadows: {
        small: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 2,
        },
        medium: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.30,
            shadowRadius: 4.65,
            elevation: 4,
        },
        large: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.37,
            shadowRadius: 7.49,
            elevation: 8,
        },
    },
};

export type Theme = typeof theme;
