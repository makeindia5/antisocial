import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, FlatList, Modal, Switch, Alert, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL = "http://192.168.29.129:5000";

export default function SocialChats({
    users,
    onChatSelect,
    currentUserId,
    refreshControl
}) {
    const { colors: theme } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';

    const [settingsVisible, setSettingsVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // --- Filter for Social Logic ---
    // For now, we use the same user list but we can filter or sort differently.
    // E.g., maybe prioritize those with recent "social" interactions if we had that data.
    // We will simulate "Active" users for the horizontal bar.
    const activeUsers = users.filter(u => u.status === 'online');
    const conversationList = users; // In future, filter by "isFollowing"

    // --- Social Settings State ---
    const [allowMessageRequests, setAllowMessageRequests] = useState(true);
    const [showActivityStatus, setShowActivityStatus] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const req = await AsyncStorage.getItem('social_allow_requests');
            const act = await AsyncStorage.getItem('social_show_activity');
            if (req !== null) setAllowMessageRequests(req === 'true');
            if (act !== null) setShowActivityStatus(act === 'true');
        } catch (e) { }
    };

    const toggleMessageRequests = async () => {
        const newVal = !allowMessageRequests;
        setAllowMessageRequests(newVal);
        await AsyncStorage.setItem('social_allow_requests', String(newVal));
    };

    const toggleActivityStatus = async () => {
        const newVal = !showActivityStatus;
        setShowActivityStatus(newVal);
        await AsyncStorage.setItem('social_show_activity', String(newVal));
    };

    const renderActiveUser = ({ item }) => (
        <TouchableOpacity
            style={styles.activeUserContainer}
            onPress={() => onChatSelect(item)}
        >
            <View style={[styles.activeAvatarContainer, { borderColor: theme.surface }]}>
                <Image
                    source={{ uri: `${SERVER_URL}${item.profilePic}` }}
                    style={styles.activeAvatar}
                />
                <View style={styles.activeDot} />
            </View>
            <Text numberOfLines={1} style={[styles.activeName, { color: theme.textPrimary }]}>
                {item.name.split(' ')[0]}
            </Text>
        </TouchableOpacity>
    );

    const renderChatItem = ({ item }) => (
        <TouchableOpacity
            style={styles.chatRow}
            onPress={() => onChatSelect(item)}
            activeOpacity={0.7}
        >
            <Image
                source={{ uri: item.profilePic ? `${SERVER_URL}${item.profilePic}` : 'https://via.placeholder.com/50' }}
                style={styles.chatAvatar}
            />
            <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                    <Text style={[styles.chatName, { color: theme.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.chatTime, { color: theme.textSecondary }]}>
                        {item.lastMessageDate ? new Date(item.lastMessageDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                </View>
                <View style={styles.chatFooter}>
                    <Text numberOfLines={1} style={[styles.chatMessage, { color: item.unreadCount > 0 ? theme.textPrimary : theme.textSecondary, fontWeight: item.unreadCount > 0 ? 'bold' : 'normal' }]}>
                        {item.lastMessageText || "Sent a message"}
                    </Text>
                    {item.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{item.unreadCount}</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderSettingsModal = () => (
        <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettingsVisible(false)}>
            <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Social Settings</Text>
                    <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                        <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>Done</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>PRIVACY</Text>

                    <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Message Requests</Text>
                        <Switch
                            value={allowMessageRequests}
                            onValueChange={toggleMessageRequests}
                            trackColor={{ false: '#767577', true: theme.primary }}
                        />
                    </View>
                    <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Allow people you don't follow to send you message requests.</Text>

                    <View style={[styles.settingItem, { borderBottomColor: theme.border, marginTop: 20 }]}>
                        <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Show Activity Status</Text>
                        <Switch
                            value={showActivityStatus}
                            onValueChange={toggleActivityStatus}
                            trackColor={{ false: '#767577', true: theme.primary }}
                        />
                    </View>
                    <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Allow accounts you follow and anyone you message to see when you were last active.</Text>

                    <Text style={[styles.sectionHeader, { color: theme.textSecondary, marginTop: 30 }]}>DATA</Text>
                    <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.settingLabel, { color: 'red' }]}>Delete All Social Chats</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Messages</Text>
                <TouchableOpacity onPress={() => setSettingsVisible(true)}>
                    <Ionicons name="settings-outline" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                refreshControl={refreshControl}
            >
                {/* Active Users Horizontal List */}
                {activeUsers.length > 0 && (
                    <View style={styles.activeUsersSection}>
                        <FlatList
                            data={activeUsers}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            renderItem={renderActiveUser}
                            keyExtractor={item => item._id}
                            contentContainerStyle={{ paddingHorizontal: 15 }}
                        />
                    </View>
                )}

                {/* Chat List */}
                <View style={styles.chatList}>
                    {conversationList.map((item) => (
                        <View key={item._id}>{renderChatItem({ item })}</View>
                    ))}
                    {conversationList.length === 0 && (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Text style={{ color: theme.textSecondary }}>No messages yet.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {renderSettingsModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        // No border for cleaner social look, maybe just padding
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    activeUsersSection: {
        paddingVertical: 15,
    },
    activeUserContainer: {
        marginRight: 15,
        alignItems: 'center',
        width: 70,
    },
    activeAvatarContainer: {
        borderWidth: 2,
        borderRadius: 35,
        padding: 2,
    },
    activeAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    activeDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4CD964',
        borderWidth: 2,
        borderColor: 'white'
    },
    activeName: {
        marginTop: 5,
        fontSize: 12,
        textAlign: 'center',
    },
    chatList: {
        paddingTop: 10,
    },
    chatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    chatAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: 15,
        backgroundColor: '#eee'
    },
    chatContent: {
        flex: 1,
        justifyContent: 'center',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 16,
        fontWeight: '600',
    },
    chatTime: {
        fontSize: 12,
    },
    chatFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chatMessage: {
        fontSize: 14,
        flex: 1,
        marginRight: 10,
    },
    unreadBadge: {
        backgroundColor: '#0095F6', // Social Blue
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    unreadText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ccc',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 0.5,
    },
    settingLabel: {
        fontSize: 16,
    },
    settingDesc: {
        fontSize: 12,
        marginTop: 5,
        marginBottom: 10,
    }
});
