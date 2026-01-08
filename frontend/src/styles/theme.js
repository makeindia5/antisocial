import { StyleSheet } from 'react-native';

export const Colors = {
    // Brand
    primary: '#1e293b',   // Slate 800
    primaryLight: '#334155',
    secondary: '#3b82f6', // Blue 500
    accent: '#f59e0b',    // Amber 500

    // Backgrounds
    background: '#f1f5f9', // Slate 100
    surface: '#ffffff',

    // Text
    textPrimary: '#0f172a', // Slate 900
    textSecondary: '#64748b', // Slate 500
    textLight: '#94a3b8',
    white: '#ffffff',

    // Status
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',

    // UI
    border: '#e2e8f0',
    inputBg: '#f8fafc',
    shadow: '#000000',
};

export const GlobalStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    safeArea: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        // Shadow (iOS)
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        // Elevation (Android)
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    input: {
        backgroundColor: Colors.inputBg,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: Colors.textPrimary,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 16,
    },
    button: {
        backgroundColor: Colors.secondary,
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonOutline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.secondary,
        borderRadius: 30,
        paddingVertical: 12,
        alignItems: 'center',
    },
    buttonOutlineText: {
        color: Colors.secondary,
        fontSize: 16,
        fontWeight: '600',
    },
});
