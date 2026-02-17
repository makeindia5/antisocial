import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL = "http://192.168.29.129:5000";

export default function PrivacyScreen() {
    const router = useRouter();
    const { colors: theme } = useTheme();
    const [isNumberHidden, setIsNumberHidden] = React.useState(false);

    React.useEffect(() => {
        // Fetch current privacy settings
        // Mock fetch or verify from User context if available
    }, []);

    const toggleNumber = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId'); // Ensure you import AsyncStorage
            const newVal = !isNumberHidden;
            setIsNumberHidden(newVal);
            await fetch(`${SERVER_URL}/api/auth/privacy/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, isHidden: newVal })
            });
        } catch (e) { console.error(e); }
    };

    const renderItem = (label, value, onPress, isToggle = false) => (
        <TouchableOpacity style={[styles.item, { borderBottomColor: theme.border }]} onPress={onPress}>
            <View>
                <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
                {!isToggle && <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{value}</Text>}
            </View>
            {isToggle && (
                <Switch value={value} onValueChange={onPress} trackColor={{ false: '#767577', true: theme.primary }} />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Privacy</Text>
                <View style={{ width: 34 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={[styles.sectionHeader, { color: theme.primary }]}>Visibility</Text>

                {renderItem("Last Seen", "Everyone", () => Alert.alert("Coming Soon"))}
                {renderItem("Profile Photo", "Everyone", () => Alert.alert("Coming Soon"))}
                {renderItem("About", "Everyone", () => Alert.alert("Coming Soon"))}
                {renderItem("Blocked Contacts", "", () => router.push('/settings/blocked'))}

                <Text style={[styles.sectionHeader, { color: theme.primary, marginTop: 25 }]}>Phone Number</Text>
                {renderItem("Hide Phone Number", isNumberHidden, toggleNumber, true)}

                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 10 }}>
                    If enabled, your phone number will be hidden from other users in groups and communities.
                </Text>
            </ScrollView>
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
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    sectionHeader: { fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10 },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 0.5 },
    label: { fontSize: 16 }
});
