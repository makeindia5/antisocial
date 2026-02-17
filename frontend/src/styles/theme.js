import { StyleSheet } from 'react-native';

export const LightColors = {
    // Brand
    primary: '#0061FF', // Modern "Digital Blue"
    primaryLight: '#4d91ff',
    secondary: '#004ecb',
    accent: '#f59e0b',

    // Backgrounds
    background: '#f8f9fa',
    surface: '#ffffff',

    // Text
    textPrimary: '#1a1a2d',
    textSecondary: '#0061FF', // Updated to match primary
    textLight: '#8b9bb4',
    white: '#ffffff',

    // Status
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',

    // UI
    border: '#e1e4e8',
    inputBg: '#f0f2f5',
    shadow: '#000000',
};

export const DarkColors = {
    // Brand
    primary: '#0061FF',
    primaryLight: '#4d91ff',
    secondary: '#004ecb',
    accent: '#fbbf24',

    // Backgrounds
    background: '#0f172a',
    surface: '#1e293b',

    // Text
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textLight: '#64748b',
    white: '#ffffff',

    // Status
    success: '#34d399',
    error: '#f87171',
    warning: '#fbbf24',

    // UI
    border: '#334155',
    inputBg: '#1e293b',
    shadow: '#000000',
};

// Default export for backward compat (will point to Light)
export const Colors = LightColors;

export const PersonalColors = {
    primary: '#075E54', // Teal Green
    primaryLight: '#25D366', // Lighter Green
    secondary: '#128C7E',
    accent: '#25D366',
    background: '#ffffff',
    surface: '#ffffff',
    textPrimary: '#000000',
    textSecondary: '#667781',
    border: '#e1e4e8',
    inputBg: '#f0f2f5',
    white: '#ffffff',
};

export const GlobalStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: LightColors.background,
    },
    // ... rest of styles allow static usage but won't auto-update. 
    // Components should prefer using dynamic styles from Context.
    input: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    button: {
        backgroundColor: LightColors.secondary,
        borderRadius: 30,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
    },
    buttonText: {
        color: LightColors.white,
        fontSize: 16,
        fontWeight: 'bold',
    }
});
