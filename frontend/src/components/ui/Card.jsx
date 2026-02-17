import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function Card({ children, onPress, style, variant = 'elevated' }) {
    const { colors } = useTheme();

    const containerStyle = [
        styles.card,
        { backgroundColor: colors.surface },
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && { borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0 },
        variant === 'flat' && { shadowOpacity: 0, elevation: 0, backgroundColor: colors.inputBg },
        style
    ];

    if (onPress) {
        return (
            <TouchableOpacity style={containerStyle} onPress={onPress} activeOpacity={0.7}>
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 20,
        padding: 12,
        marginVertical: 0,
        marginHorizontal: 4,
    },
    elevated: {
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
});
