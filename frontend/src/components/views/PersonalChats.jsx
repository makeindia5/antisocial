import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../../styles/theme';
import { API_BASE } from '../../services/apiService';

// Extract the base URL from API_BASE (http://...:5000/api/auth -> http://...:5000)
// Or just hardcode for now as per existing code which was hardcoded.
// Existing code used: `http://192.168.29.129:5000${item.profilePic}`
const SERVER_URL = "http://192.168.29.129:5000";

export default function PersonalChats({ users, onChatSelect, theme, refreshControl }) {
    if (users.length === 0) {
        return (
            <ScrollView contentContainerStyle={styles.emptyContainer} refreshControl={refreshControl}>
                <Text style={{ textAlign: 'center', marginTop: 50, color: theme.textSecondary }}>No other users found.</Text>
            </ScrollView>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.listContainer} refreshControl={refreshControl}>
            {users.map((item) => (
                <TouchableOpacity
                    key={item._id}
                    onPress={() => onChatSelect(item)}
                    style={[styles.userItem, { backgroundColor: theme.surface }]}
                >
                    {item.profilePic ? (
                        <Image source={{ uri: `${SERVER_URL}${item.profilePic}` }} style={styles.userAvatarImg} />
                    ) : (
                        <View style={[styles.userAvatarPlaceholder, { backgroundColor: theme.secondary }]}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                {item.name ? item.name[0].toUpperCase() : '?'}
                            </Text>
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={[styles.userName, { color: theme.textPrimary }]}>{item.name}</Text>
                            {item.lastMessage && (
                                <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                                    {new Date(item.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            )}
                        </View>
                        <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
                            {item.lastMessage
                                ? (item.lastMessage.type === 'image' ? '📷 Photo' : item.lastMessage.content)
                                : (item.status === 'online' ? 'Online' : 'Tap to start chatting')}
                        </Text>
                    </View>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    emptyContainer: { flex: 1, padding: 20 },
    listContainer: { padding: 0 }, // Remove container padding for full width
    userItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth, // Thin separator
        borderBottomColor: '#e0e0e0', // Light separator color (can be themed if passed)
        // Removed elevation, shadows, borderRadius, marginBottom
    },
    userAvatarImg: { width: 50, height: 50, borderRadius: 25, marginRight: 15 }, // Larger avatar
    userAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    userName: { fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
    userEmail: { fontSize: 13 }
});
