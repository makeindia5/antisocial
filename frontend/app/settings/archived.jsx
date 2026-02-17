import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL = "http://192.168.29.129:5000";

export default function ArchivedChatsScreen() {
    const router = useRouter();
    const { colors: theme } = useTheme();
    const [archivedChats, setArchivedChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadArchivedChats();
    }, []);

    const loadArchivedChats = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/chat/archived/${userId}`);
            const data = await res.json();
            if (res.ok) {
                // Assuming backend returns array of user IDs or objects.
                // If it returns strings, we'd need to fetch user details separately, but
                // normally we'd populate on backend.
                // Assuming data is array of objects { _id, name, profilePic }
                setArchivedChats(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
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
                loadArchivedChats(); // Refresh list
                Alert.alert("Success", "Chat unarchived");
            } else {
                Alert.alert("Error", "Failed to unarchive");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to unarchive");
        }
    };

    const renderItem = ({ item }) => {
        const name = item.name || item.email || "Unknown User";
        const pic = item.profilePic;

        return (
            <TouchableOpacity
                style={[styles.itemContainer, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}
                onLongPress={() => {
                    Alert.alert(
                        "Unarchive Chat",
                        `Unarchive chat with ${name}?`,
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Unarchive", onPress: () => handleUnarchive(item._id) }
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
                        <Text style={{ fontSize: 12, color: theme.textSecondary }}>Long press to unarchive</Text>
                    </View>
                </View>
                <Ionicons name="archive-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Archived Chats</Text>
                <View style={{ width: 34 }} />
            </View>

            <FlatList
                data={archivedChats}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadArchivedChats(); }} />}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 50 }}>
                        <Text style={{ color: theme.textSecondary }}>No archived chats</Text>
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
