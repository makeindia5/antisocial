import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/context/ThemeContext';
import { BlurView } from 'expo-blur';

export default function ModeSwitchModal() {
    const router = useRouter();
    const { colors, activeMode, setActiveMode } = useTheme();
    const theme = colors; // Alias for cleaner code

    const switchMode = (mode) => {
        setActiveMode(mode);
        router.back();
    };

    return (
        <View style={styles.container}>
            {/* Backdrop - Tap to close */}
            <Pressable style={styles.backdrop} onPress={() => router.back()}>
                <View style={[styles.backdropFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
            </Pressable>

            {/* Content Card */}
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Switch Mode</Text>

                <View style={styles.optionsContainer}>
                    <TouchableOpacity onPress={() => switchMode('personal')} style={styles.option}>
                        <View style={[styles.iconContainer, { backgroundColor: activeMode === 'personal' ? theme.primary : theme.inputBg }]}>
                            <Ionicons name="person" size={24} color={activeMode === 'personal' ? 'white' : theme.textSecondary} />
                        </View>
                        <Text style={[styles.label, { color: activeMode === 'personal' ? theme.primary : theme.textSecondary }]}>Personal</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => switchMode('work')} style={styles.option}>
                        <View style={[styles.iconContainer, { backgroundColor: activeMode === 'work' ? theme.primary : theme.inputBg }]}>
                            <Ionicons name="briefcase" size={24} color={activeMode === 'work' ? 'white' : theme.textSecondary} />
                        </View>
                        <Text style={[styles.label, { color: activeMode === 'work' ? theme.primary : theme.textSecondary }]}>Work</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => switchMode('social')} style={styles.option}>
                        <View style={[styles.iconContainer, { backgroundColor: activeMode === 'social' ? theme.primary : theme.inputBg }]}>
                            <Ionicons name="globe" size={24} color={activeMode === 'social' ? 'white' : theme.textSecondary} />
                        </View>
                        <Text style={[styles.label, { color: activeMode === 'social' ? theme.primary : theme.textSecondary }]}>Social</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    backdropFill: {
        flex: 1,
    },
    card: {
        zIndex: 2,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 30,
        paddingBottom: 50,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 25,
        textAlign: 'center',
    },
    optionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    option: {
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
    },
});
