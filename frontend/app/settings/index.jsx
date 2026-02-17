import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const SERVER_URL = "http://192.168.29.129:5000";

export default function SettingsScreen() {
    const router = useRouter();
    const { colors: theme, setScheme, isDark } = useTheme();

    // Persistent State
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [userProfile, setUserProfile] = useState({ name: 'User', profilePic: null });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const notif = await AsyncStorage.getItem('settings_notifications');
            if (notif !== null) setNotificationsEnabled(notif === 'true');

            const name = await AsyncStorage.getItem('userName');
            const pic = await AsyncStorage.getItem('profilePic'); // Often stores path
            setUserProfile({ name: name || 'User', profilePic: pic });
        } catch (e) {
            console.log("Error loading settings", e);
        }
    };

    const toggleNotifications = async () => {
        const newVal = !notificationsEnabled;
        setNotificationsEnabled(newVal);
        await AsyncStorage.setItem('settings_notifications', String(newVal));
    };

    const handleThemeChange = () => {
        Alert.alert(
            "Select Theme",
            "Choose your preferred appearance",
            [
                { text: "System Default", onPress: () => setScheme('system') },
                { text: "Light", onPress: () => setScheme('light') },
                { text: "Dark", onPress: () => setScheme('dark') },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const pickGlobalWallpaper = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [9, 16],
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                await AsyncStorage.setItem(`chat_wallpaper_global`, uri);
                Alert.alert("Success", "Default wallpaper updated for all new chats.");
            }
        } catch (e) { Alert.alert("Error", "Could not set wallpaper"); }
    };

    const sections = [
        {
            title: "Account",
            items: [
                { icon: "key-outline", label: "Privacy", onPress: () => router.push('/settings/privacy') },
            ]
        },
        {
            title: "Chats",
            items: [
                { icon: "archive-outline", label: "Archived Chats", onPress: () => router.push('/settings/archived') },
                { icon: "color-palette-outline", label: "Dark Mode", type: "toggle", value: isDark, onToggle: () => setScheme(isDark ? 'light' : 'dark') },
                { icon: "image-outline", label: "Default Wallpaper", onPress: pickGlobalWallpaper },
            ]
        },
        {
            title: "Notifications",
            items: [
                { icon: "notifications-outline", label: "Show Notifications", type: "toggle", value: notificationsEnabled, onToggle: toggleNotifications },
            ]
        },
        {
            title: "Help",
            items: [
                { icon: "help-circle-outline", label: "Help Center", onPress: () => router.push('/settings/help') },
                { icon: "information-circle-outline", label: "App Info", onPress: () => Alert.alert("App Info", "Finance Chat v1.1.0\nBuild: 2026.01.28") },
            ]
        }
    ];

    const renderItem = (item, index) => (
        <TouchableOpacity
            key={index}
            style={[styles.itemContainer, { borderBottomColor: theme.border }]}
            onPress={item.onPress}
            disabled={item.type === 'toggle'}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={item.icon} size={24} color={theme.textSecondary} style={{ marginRight: 15 }} />
                <Text style={{ fontSize: 16, color: theme.textPrimary }}>{item.label}</Text>
            </View>
            {item.type === 'toggle' ? (
                <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    trackColor={{ false: '#767577', true: theme.primary }}
                    thumbColor={item.value ? '#fff' : '#f4f3f4'}
                />
            ) : null}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Settings</Text>
                <View style={{ width: 34 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Profile Header Block */}
                <TouchableOpacity style={[styles.profileBlock, { backgroundColor: theme.surface }]} onPress={() => router.push('/settings/profile')}>
                    <View style={[styles.avatarContainer, { backgroundColor: theme.inputBg }]}>
                        {userProfile.profilePic ? (
                            <Image source={{ uri: `${SERVER_URL}${userProfile.profilePic}` }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                        ) : (
                            <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.textSecondary }}>{userProfile.name[0]?.toUpperCase()}</Text>
                        )}
                    </View>
                    <View style={{ marginLeft: 15 }}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.textPrimary }}>{userProfile.name}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Available</Text>
                    </View>
                </TouchableOpacity>

                {sections.map((section, idx) => (
                    <View key={idx} style={{ marginBottom: 25 }}>
                        <Text style={[styles.sectionTitle, { color: theme.primary }]}>{section.title}</Text>
                        <View style={[styles.sectionBox, { backgroundColor: theme.surface }]}>
                            {section.items.map(renderItem)}
                        </View>
                    </View>
                ))}
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
        borderBottomWidth: 0.5,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 3
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold'
    },
    profileBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 15,
        marginBottom: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center'
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        marginLeft: 10,
        textTransform: 'uppercase'
    },
    sectionBox: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 1
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 0.5
    }
});
