import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL = "http://192.168.29.129:5000";

export default function BlockedUsersScreen() {
    const router = useRouter();
    const { colors: theme } = useTheme();
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadBlockedUsers();
    }, []);

    const loadBlockedUsers = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/social/blocked/${userId}`);
            const data = await res.json();
            if (res.ok) {
                setBlockedUsers(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
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
                loadBlockedUsers(); // Refresh list
                Alert.alert("Success", "User unblocked");
            } else {
                Alert.alert("Error", "Failed to unblock");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to unblock");
        }
    };

    const renderItem = ({ item }) => {
        const name = item.name || "Unknown User";
        const pic = item.profilePic;

        return (
            <TouchableOpacity
                style={[styles.itemContainer, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}
                onPress={() => {
                    Alert.alert(
                        "Unblock User",
                        `Unblock ${name}?`,
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Unblock", onPress: () => handleUnblock(item._id) }
                        ]
                    );
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.avatar, { backgroundColor: theme.inputBg }]}>
                        {pic ? (
                            <Image source={{ uri: `${SERVER_URL}${pic}` }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                        ) : (
                            <Ionicons name="person" size={24} color={theme.textSecondary} />
                        )}
                    </View>
                    <View style={{ marginLeft: 15 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.textPrimary }}>{name}</Text>
                        <Text style={{ fontSize: 12, color: theme.textSecondary }}>Tap to unblock</Text>
                    </View>
                </View>
                <Ionicons name="lock-open-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Blocked Contacts</Text>
                <View style={{ width: 34 }} />
            </View>

            <FlatList
                data={blockedUsers}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBlockedUsers(); }} />}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Text style={{ color: theme.textSecondary }}>No blocked contacts</Text>
                    </View>
                }
            />
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
        elevation: 2
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold'
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
