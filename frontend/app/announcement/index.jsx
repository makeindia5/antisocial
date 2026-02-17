import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../src/services/apiService';
import { Colors, GlobalStyles } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import Card from '../../src/components/ui/Card';

export default function AnnouncementGroupsScreen() {
    const { colors: theme } = useTheme();
    const router = useRouter();

    const [groups, setGroups] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({});

    // Group Creation
    const [modalVisible, setModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);

    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            checkRole();
            setRefreshing(true);
            fetchGroups(); // This fetches counts
        }, [])
    );

    useEffect(() => {
        // Update Last Read on Entry - This logic might need refinement per group, but keeping existing behavior
        AsyncStorage.setItem('lastReadAnnounce', new Date().toISOString());
        return () => { AsyncStorage.setItem('lastReadAnnounce', new Date().toISOString()); };
    }, []);

    const checkRole = async () => {
        const role = await AsyncStorage.getItem('userRole');
        setIsAdmin(role === 'admin');
    };

    const fetchGroups = async () => {
        try {
            // Using slightly hacky URL replace as per original code, or fix API_BASE usage
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/group/list`);
            const currentUserId = await AsyncStorage.getItem('userId');
            const currentUserRole = await AsyncStorage.getItem('userRole');

            if (res.ok) {
                const data = await res.json();
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
                body: JSON.stringify({ name, description, members: selectedMembers })
            });

            if (res.ok) {
                setModalVisible(false);
                setName('');
                setDescription('');
                setSelectedMembers([]);
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

    const renderItem = ({ item }) => (
        <Card
            variant="elevated"
            onPress={() => router.push(`/announcement/group/${item._id}`)}
            style={styles.card}
        >
            <View style={styles.cardRow}>
                <View style={styles.iconContainer}>
                    {item.icon ? (
                        <Image source={{ uri: `${API_BASE.replace('/api/auth', '')}${item.icon}` }} style={styles.iconImg} />
                    ) : (
                        <Text style={styles.iconText}>
                            {item.name ? item.name[0].toUpperCase() : 'A'}
                        </Text>
                    )}
                </View>

                <View style={{ flex: 1 }}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.groupName, { color: theme.textPrimary }]}>{item.name}</Text>
                        {unreadCounts[item._id] > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{unreadCounts[item._id]}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.groupDesc, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>
                </View>
            </View>
        </Card>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 40, marginBottom: 10 }}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/communityScreen')} style={{ marginRight: 15 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 }}>Announcements</Text>
            </View>

            <FlatList
                data={groups}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={renderItem}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={60} color={theme.textLight} />
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            No announcements found. {isAdmin ? "Create one!" : "Check back later."}
                        </Text>
                    </View>
                }
            />

            {isAdmin && (
                <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={() => setModalVisible(true)}>
                    <Ionicons name="add" size={30} color="white" />
                </TouchableOpacity>
            )}

            <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)} onShow={() => {
                // Fetch users when modal opens
                const getUsers = async () => {
                    try {
                        const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/users`);
                        if (res.ok) setAllUsers(await res.json());
                    } catch (e) { }
                };
                getUsers();
            }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalView, { backgroundColor: theme.surface, maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New Group</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            placeholder="Group Name"
                            placeholderTextColor={theme.textLight}
                            value={name}
                            onChangeText={setName}
                            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                        />
                        <TextInput
                            placeholder="Description"
                            placeholderTextColor={theme.textLight}
                            value={description}
                            onChangeText={setDescription}
                            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textPrimary, height: 60, textAlignVertical: 'top' }]}
                            multiline
                        />

                        <Text style={{ color: theme.textPrimary, fontWeight: 'bold', marginBottom: 5 }}>Add Members (Optional):</Text>
                        <FlatList
                            data={allUsers}
                            keyExtractor={item => item._id}
                            style={{ maxHeight: 200, marginBottom: 15 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => {
                                    if (selectedMembers.includes(item._id)) {
                                        setSelectedMembers(prev => prev.filter(id => id !== item._id));
                                    } else {
                                        setSelectedMembers(prev => [...prev, item._id]);
                                    }
                                }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                    <Ionicons name={selectedMembers.includes(item._id) ? "checkbox" : "square-outline"} size={24} color={theme.primary} />
                                    <View style={{ marginLeft: 10 }}>
                                        <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>{item.name}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.email}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />

                        <TouchableOpacity style={[styles.createBtn, { backgroundColor: theme.primary }]} onPress={createGroup}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Create Group</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 16,
        marginBottom: 10,
        marginTop: 40, // Increased to avoid status bar overlap
    },
    card: {
        marginBottom: 10,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 50, height: 50, borderRadius: 25,
        backgroundColor: '#FF9500', // Orange for announcements default
        justifyContent: 'center', alignItems: 'center',
        marginRight: 15
    },
    iconImg: { width: 50, height: 50, borderRadius: 25 },
    iconText: { color: 'white', fontWeight: 'bold', fontSize: 18 },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    groupName: { fontSize: 16, fontWeight: 'bold' },
    groupDesc: { fontSize: 13, marginTop: 4 },

    badge: {
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 5
    },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

    fab: {
        position: 'absolute', bottom: 20, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalView: { padding: 25, borderRadius: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    input: { padding: 15, borderRadius: 12, marginBottom: 15 },
    createBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },

    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10 }
});
