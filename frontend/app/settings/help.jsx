import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';

export default function HelpScreen() {
    const router = useRouter();
    const { colors: theme } = useTheme();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Help Center</Text>
                <View style={{ width: 34 }} />
            </View>
            <View style={{ padding: 20 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 16 }}>
                    FAQs, Contact Support, and App Info will be listed here.
                </Text>
                <Text style={{ color: theme.textSecondary, marginTop: 10 }}>App Version: 1.1.0</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: 0.5
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold'
    }
});
