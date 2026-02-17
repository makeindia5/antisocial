import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/context/ThemeContext';

const SERVER_URL = "http://192.168.29.129:5000";

export default function BlockedUsersScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [blockedUsers, setBlockedUsers] = useState([]);

    useEffect(() => {
        fetchBlocked();
    }, []);

    const fetchBlocked = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            // 1. Fetch Blocked IDs
            const resIds = await fetch(`${SERVER_URL}/api/auth/social/blocked/${userId}`);
            const ids = await resIds.json();

            // 2. Fetch All Possible Users to hydrate
            const resUsers = await fetch(`${SERVER_URL}/api/auth/community/users?currentUserId=${userId}`);
            const users = resUsers.ok ? await resUsers.json() : [];

            // 3. Intersect
            const blocked = users.filter(u => ids.includes(u._id));
            setBlockedUsers(blocked);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (targetId) => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/social/block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, targetId })
            });
            if (res.ok) {
                // Remove locally
                setBlockedUsers(prev => prev.filter(u => u._id !== targetId));
                Alert.alert("Success", "User unblocked");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to unblock");
        }
    };

    const renderItem = ({ item }) => {
        const name = item.name || "Unknown";
        const pic = item.profilePic;

        return (
            <View style={[styles.itemPath, { borderBottomColor: colors.border }]}>
                <View style={styles.itemContent}>
                    {pic ? (
                        <Image source={{ uri: `${SERVER_URL}${pic}` }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>{name[0]}</Text>
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '600' }}>{name}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Blocked</Text>
                    </View>
                </View>

                {/* Unblock Button */}
                <TouchableOpacity
                    onPress={() => handleUnblock(item._id)}
                    style={[styles.unblockBtn, { backgroundColor: colors.primary + '20' }]}
                >
                    <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>Unblock</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 40 }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 15, color: colors.textPrimary }}>Blocked Users</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={blockedUsers}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="shield-checkmark-outline" size={80} color={colors.textLight} />
                            <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 10 }}>No blocked users</Text>
                        </View>
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
    },
    unblockBtn: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    }
});
