import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/context/ThemeContext';

const SERVER_URL = "http://192.168.29.129:5000";

export default function ArchivedChatsScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [archivedIds, setArchivedIds] = useState([]);
    const [hydratedChats, setHydratedChats] = useState([]);

    useEffect(() => {
        fetchArchived();
    }, []);

    const fetchArchived = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            // 1. Fetch IDs
            const resIds = await fetch(`${SERVER_URL}/api/auth/chat/archived/${userId}`);
            const ids = await resIds.json();
            setArchivedIds(ids);

            // 2. Fetch All Possible Chats (Users & Groups) to hydrate
            // This is heavy but ensures consistency
            const [resUsers, resGroups] = await Promise.all([
                fetch(`${SERVER_URL}/api/auth/community/users?currentUserId=${userId}`),
                fetch(`${SERVER_URL}/api/auth/chat/groups/${userId}`)
            ]);

            const users = resUsers.ok ? await resUsers.json() : [];
            const groups = resGroups.ok ? await resGroups.json() : [];

            // 3. Intersect
            const archived = [];

            // Check Users
            users.forEach(u => {
                if (ids.includes(u._id)) archived.push({ ...u, type: 'user' });
            });
            // Check Groups
            groups.forEach(g => {
                if (ids.includes(g._id)) archived.push({ ...g, type: 'group' });
            });

            setHydratedChats(archived);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUnarchive = async (chatId) => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/chat/archive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, chatId })
            });
            if (res.ok) {
                // Remove locally
                setHydratedChats(prev => prev.filter(c => c._id !== chatId));
            }
        } catch (e) {
            Alert.alert("Error", "Failed to unarchive");
        }
    };

    const renderItem = ({ item }) => {
        const isUser = item.type === 'user';
        const name = item.name || "Unknown";
        const pic = item.profilePic;

        return (
            <View style={[styles.itemPath, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={styles.itemContent}
                    onPress={() => {
                        if (isUser) {
                            router.push({ pathname: `/chat/${item._id}`, params: { name: item.name, profilePic: item.profilePic || '' } });
                        } else {
                            router.push(`/chat/group/${item._id}`);
                        }
                    }}
                >
                    {pic ? (
                        <Image source={{ uri: `${SERVER_URL}${pic}` }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>{name[0]}</Text>
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>{name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{isUser ? 'Private Chat' : 'Group'}</Text>
                    </View>
                </TouchableOpacity>

                {/* Unarchive Button */}
                <TouchableOpacity onPress={() => handleUnarchive(item._id)} style={{ padding: 10 }}>
                    <Ionicons name="archive" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 15,
                paddingTop: Platform.OS === 'android' ? 50 : 15, // Fix status bar overlap
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.surface
            }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 15, color: colors.textPrimary }}>Archived Chats</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={hydratedChats}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>No archived chats</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    itemPath: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderBottomWidth: 0.5,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25
    }
});
