import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, Modal, TextInput, FlatList, SafeAreaView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../src/context/ThemeContext';

const SERVER_URL = "http://192.168.29.129:5000";

export default function CommunityScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors: theme } = useTheme();
    const [community, setCommunity] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Modal States
    const [createGroupVisible, setCreateGroupVisible] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [addMemberVisible, setAddMemberVisible] = useState(false);
    const [users, setUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);

    useEffect(() => {
        fetchCommunityDetails();
        fetchUsers();
    }, [id]);

    const fetchCommunityDetails = async () => {
        try {
            const uid = await AsyncStorage.getItem('userId');
            setUserId(uid);
            const res = await fetch(`${SERVER_URL}/api/auth/community/details/${id}`);
            if (res.ok) {
                const data = await res.json();
                setCommunity(data);
                if (data.admins && data.admins.some(a => String(a) === String(uid))) {
                    setIsAdmin(true);
                }
            } else {
                Alert.alert("Error", "Community not found");
                router.back();
            }
        } catch (e) { console.error("Fetch Community Error:", e); }
    };

    const fetchUsers = async () => {
        try {
            const uid = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/community/users?currentUserId=${uid}`);
            if (res.ok) {
                const data = await res.json();
                setUsers(data.filter(u => String(u._id) !== String(uid)));
            }
        } catch (e) { }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return Alert.alert("Error", "Group Name Required");

        try {
            const res = await fetch(`${SERVER_URL}/api/auth/community/group/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    communityId: id,
                    name: newGroupName,
                    createdBy: userId,
                    members: [userId] // Creator is member
                })
            });
            const data = await res.json();
            if (res.ok) {
                setCreateGroupVisible(false);
                setNewGroupName('');
                fetchCommunityDetails(); // Refresh
                Alert.alert("Success", "Group Created");
            } else {
                Alert.alert("Error", data.error);
            }
        } catch (e) { Alert.alert("Error", "Network Error"); }
    };

    const handleAddMembers = async () => {
        if (selectedUsers.length === 0) return Alert.alert("Error", "Select users");

        try {
            const res = await fetch(`${SERVER_URL}/api/auth/community/members/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    communityId: id,
                    newMembers: selectedUsers
                })
            });
            if (res.ok) {
                setAddMemberVisible(false);
                setSelectedUsers([]);
                fetchCommunityDetails();
                Alert.alert("Success", "Members Added");
            }
        } catch (e) { Alert.alert("Error", "Network Error"); }
    };

    if (!community) return (
        <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: theme.textSecondary }}>Loading...</Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={styles.communityIcon}>
                        <Ionicons name="people" size={24} color="white" />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.title, { color: theme.textPrimary }]}>{community.name}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{community.members.length} members</Text>
                    </View>
                </View>
                {isAdmin && (
                    <TouchableOpacity onPress={() => setAddMemberVisible(true)}>
                        <Ionicons name="person-add" size={24} color={theme.primary} />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={{ padding: 15 }}>
                {/* Description */}
                {community.description ? (
                    <Text style={{ color: theme.textSecondary, marginBottom: 20 }}>{community.description}</Text>
                ) : null}

                {/* Announcements Group */}
                {community.announcementsGroup && (
                    <TouchableOpacity
                        style={[styles.groupItem, { backgroundColor: theme.surface }]}
                        onPress={() => router.push(`/chat/group/${community.announcementsGroup._id}`)}
                    >
                        <View style={[styles.groupIcon, { backgroundColor: '#E3F2FD' }]}>
                            <Ionicons name="megaphone" size={24} color="#0288D1" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={[styles.groupName, { color: theme.textPrimary }]}>Announcements</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                {community.announcementsGroup.lastMessage?.content || "No announcements yet"}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                )}

                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Groups in this Community</Text>

                {/* Groups List */}
                {community.groups && community.groups.filter(g => g.type !== 'announcement').map((group) => (
                    <TouchableOpacity
                        key={group._id}
                        style={[styles.groupItem, { backgroundColor: theme.surface }]}
                        onPress={() => router.push(`/chat/group/${group._id}`)}
                    >
                        <View style={[styles.groupIcon, { backgroundColor: '#F3E5F5' }]}>
                            <Ionicons name="chatbubbles" size={24} color="#7B1FA2" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <Text style={[styles.groupName, { color: theme.textPrimary }]}>{group.name}</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                {group.members.length} members
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                ))}

                {/* Create Group Button (Admin Only) */}
                {isAdmin && (
                    <TouchableOpacity
                        style={[styles.createBtn, { borderColor: theme.border }]}
                        onPress={() => setCreateGroupVisible(true)}
                    >
                        <Ionicons name="add" size={24} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontWeight: 'bold', marginLeft: 10 }}>Create New Group</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Create Group Modal */}
            <Modal visible={createGroupVisible} transparent animationType="slide" onRequestClose={() => setCreateGroupVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Create Group</Text>
                        <TextInput
                            placeholder="Group Name"
                            placeholderTextColor={theme.textSecondary}
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                            style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
                            <TouchableOpacity onPress={() => setCreateGroupVisible(false)} style={{ marginRight: 20 }}>
                                <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateGroup}>
                                <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Members Modal */}
            <Modal visible={addMemberVisible} animationType="slide" onRequestClose={() => setAddMemberVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setAddMemberVisible(false)}>
                            <Ionicons name="close" size={28} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <Text style={[styles.modalTitle, { color: theme.textPrimary, marginBottom: 0 }]}>Add Members</Text>
                        <TouchableOpacity onPress={handleAddMembers}>
                            <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>Done</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={users}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => {
                            const isMember = community.members.some(m => String(m) === String(item._id));
                            if (isMember) return null; // Skip existing members

                            const isSelected = selectedUsers.includes(item._id);
                            return (
                                <TouchableOpacity
                                    style={[styles.userItem, { borderColor: theme.border }]}
                                    onPress={() => {
                                        if (isSelected) setSelectedUsers(prev => prev.filter(id => id !== item._id));
                                        else setSelectedUsers(prev => [...prev, item._id]);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Image source={{ uri: `${SERVER_URL}${item.profilePic}` }} style={styles.avatar} />
                                        <Text style={{ marginLeft: 15, fontSize: 16, color: theme.textPrimary }}>{item.name}</Text>
                                    </View>
                                    <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? theme.primary : theme.textSecondary} />
                                </TouchableOpacity>
                            );
                        }}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 15, elevation: 2, paddingTop: 40 },
    title: { fontSize: 20, fontWeight: 'bold' },
    communityIcon: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#075E54', justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: 14, fontWeight: '600', marginTop: 25, marginBottom: 10, textTransform: 'uppercase' },
    groupItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 10 },
    groupIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    groupName: { fontSize: 16, fontWeight: 'bold' },
    createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', marginTop: 10 },

    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '80%', padding: 20, borderRadius: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    input: { borderWidth: 1, padding: 10, borderRadius: 10 },

    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
    userItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1 },
    avatar: { width: 40, height: 40, borderRadius: 20 }
});
