import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '../../styles/theme';
import { API_BASE } from '../../services/apiService';

// Extract the base URL from API_BASE (http://...:5000/api/auth -> http://...:5000)
// Or just hardcode for now as per existing code which was hardcoded.
// Existing code used: `http://192.168.29.129:5000${item.profilePic}`
const SERVER_URL = "http://192.168.29.129:5000";

export default function PersonalChats({ users, onChatSelect, theme }) {
    if (users.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={{ textAlign: 'center', marginTop: 50, color: theme.textSecondary }}>No other users found.</Text>
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.listContainer}>
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
                            <Text style={{ fontSize: 10, color: theme.textSecondary }}>{item.role}</Text>
                        </View>
                        <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{item.email}</Text>
                    </View>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    emptyContainer: { flex: 1, padding: 20 },
    listContainer: { padding: 15 },
    userItem: {
        flexDirection: 'row',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2
    },
    userAvatarImg: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
    userAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    userName: { fontWeight: 'bold', fontSize: 16 },
    userEmail: { fontSize: 12 }
});
