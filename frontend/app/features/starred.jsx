import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/context/ThemeContext';

const SERVER_URL = "http://192.168.29.129:5000";

export default function StarredMessagesScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        fetchStarred();
    }, []);

    const fetchStarred = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/message/starred/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUnstar = async (messageId) => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/message/star`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, messageId })
            });
            if (res.ok) {
                setMessages(prev => prev.filter(m => m._id !== messageId));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const renderItem = ({ item }) => {
        return (
            <View style={[styles.itemPath, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={{ fontWeight: 'bold', color: colors.primary }}>{item.sender?.name || "Unknown"}</Text>
                        <Text style={{ fontSize: 10, color: colors.textSecondary }}>{new Date(item.createdAt || Date.now()).toLocaleDateString()}</Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{item.content}</Text>
                </View>
                <TouchableOpacity onPress={() => handleUnstar(item._id)} style={{ marginLeft: 15, padding: 5 }}>
                    <Ionicons name="trash-outline" size={22} color="#ff4444" />
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
                paddingTop: Platform.OS === 'android' ? 50 : 15, // Fix overlap
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.surface
            }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 15, color: colors.textPrimary }}>Starred Messages</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={messages}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 10, paddingBottom: 50 }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>No starred messages</Text>
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
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderBottomWidth: 0.5
    }
});
