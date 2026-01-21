import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../src/services/apiService';
import { Colors, GlobalStyles } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
// import { SafeAreaView } from 'react-native-safe-area-context';

export default function AnnouncementGroupsScreen() {
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const router = useRouter();
    const [groups, setGroups] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({});

    // Group Creation
    const [modalVisible, setModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            checkRole();
            fetchGroups();
        }, [])
    );

    useEffect(() => {
        // Update Last Read on Entry
        AsyncStorage.setItem('lastReadAnnounce', new Date().toISOString());

        return () => {
            AsyncStorage.setItem('lastReadAnnounce', new Date().toISOString());
        };
    }, []);

    const checkRole = async () => {
        const role = await AsyncStorage.getItem('userRole');
        setIsAdmin(role === 'admin');
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/group/list`);
            const currentUserId = await AsyncStorage.getItem('userId');
            const currentUserRole = await AsyncStorage.getItem('userRole');

            if (res.ok) {
                const data = await res.json();
                // Filter: Show if Admin OR if Member
                const filtered = data.filter(g =>
                    currentUserRole === 'admin' ||
                    (g.members && g.members.some(m => (m._id === currentUserId || m === currentUserId)))
                );
                setGroups(filtered);
                fetchUnreadCounts(filtered);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setRefreshing(false);
        }
    };

    const fetchUnreadCounts = async (groupsList) => {
        const counts = {};
        await Promise.all(groupsList.map(async (group) => {
            try {
                const lastRead = await AsyncStorage.getItem(`lastReadGroup_${group._id}`);
                const lastReadDate = lastRead ? new Date(lastRead) : new Date(0);

                // Fetch Announcements & Messages for this group to count
                const [resAnn, resChat] = await Promise.all([
                    fetch(`${API_BASE.replace('/auth', '/admin')}/group/${group._id}/announcements`),
                    fetch(`${API_BASE.replace('/auth', '/admin')}/group/${group._id}/messages`)
                ]);

                const anns = resAnn.ok ? await resAnn.json() : [];
                const msgs = resChat.ok ? await resChat.json() : [];

                let count = 0;
                [...anns, ...msgs].forEach(item => {
                    if (new Date(item.createdAt) > lastReadDate) count++;
                });

                counts[group._id] = count;
            } catch (e) {
                console.warn("Failed to count for group", group._id);
            }
        }));
        setUnreadCounts(counts);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchGroups();
    };

    const createGroup = async () => {
        if (!name.trim()) return Alert.alert("Error", "Group name is required");
        try {
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (res.ok) {
                setModalVisible(false);
                setName('');
                setDescription('');
                fetchGroups();
                Alert.alert("Success", "Group created");
            } else {
                const text = await res.text();
                Alert.alert("Error", "Failed: " + text);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Exception: " + e.message);
        }
    };

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: 10, paddingBottom: 15 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: 0, zIndex: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.headerText}>Announcement Groups</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={GlobalStyles.container}>
            {renderHeader()}

            <FlatList
                data={groups}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ padding: 15 }}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={styles.card}
                        onPress={() => router.push(`/announcement/group/${item._id}`)}
                    >
                        <View style={styles.iconContainer}>
                            {item.icon ? (
                                <Image source={{ uri: `${API_BASE.replace('/api/auth', '')}${item.icon}` }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                            ) : (
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>
                                    {item.name ? item.name[0].toUpperCase() : 'A'}
                                </Text>
                            )}
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.groupName}>{item.name}</Text>
                                {unreadCounts[item._id] > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{unreadCounts[item._id]}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.groupDesc} numberOfLines={1}>{item.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={60} color={theme.textLight} />
                        <Text style={styles.emptyText}>No groups found. {isAdmin ? "Create one!" : "Check back later."}</Text>
                    </View>
                }
            />

            {isAdmin && (
                <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                    <Ionicons name="add" size={30} color="white" />
                </TouchableOpacity>
            )}

            <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Group</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            placeholder="Group Name"
                            placeholderTextColor={Colors.textLight}
                            value={name}
                            onChangeText={setName}
                            style={GlobalStyles.input}
                        />
                        <TextInput
                            placeholder="Description"
                            placeholderTextColor={Colors.textLight}
                            value={description}
                            onChangeText={setDescription}
                            style={[GlobalStyles.input, { height: 80, textAlignVertical: 'top' }]}
                            multiline
                        />

                        <TouchableOpacity style={GlobalStyles.button} onPress={createGroup}>
                            <Text style={GlobalStyles.buttonText}>Create Group</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        padding: 15,
        borderRadius: 15,
        marginBottom: 10,
        elevation: 2
    },
    iconContainer: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: theme.secondary,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 15
    },
    groupName: { fontSize: 16, fontWeight: 'bold', color: theme.textPrimary },
    groupDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },

    badge: {
        backgroundColor: '#d32f2f',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 5
    },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

    fab: {
        position: 'absolute', bottom: 20, right: 20,
        backgroundColor: theme.secondary,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 5
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalView: { backgroundColor: theme.surface, padding: 25, borderRadius: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: theme.textPrimary, textAlign: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, color: theme.textSecondary }
});
