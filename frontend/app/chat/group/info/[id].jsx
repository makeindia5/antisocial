import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, TextInput, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../src/context/ThemeContext';
import { Colors } from '../../../../src/styles/theme';

const BACKEND_URL = "http://192.168.29.129:5000";

export default function GroupInfoScreen() {
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [myId, setMyId] = useState(null);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [descText, setDescText] = useState('');
    const [users, setUsers] = useState([]);
    const [addModalVisible, setAddModalVisible] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem("userId").then(setMyId);
    }, []);

    useEffect(() => {
        if (!id) return;
        fetchGroupDetails();
    }, [id]);

    const fetchGroupDetails = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/details/${id}`);
            const data = await res.json();
            if (!data.error) {
                setGroup(data);
            } else {
                Alert.alert("Error", "Failed to load group info");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await fetchGroupDetails();
        setRefreshing(false);
    }, [id]);

    const updateDescription = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/description/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: descText, requesterId: myId })
            });
            const data = await res.json();
            if (data.success) {
                setGroup({ ...group, description: descText });
                setIsEditingDesc(false);
            } else {
                Alert.alert("Error", data.error);
            }
        } catch (e) { Alert.alert("Error", "Network error"); }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/community/users`);
            const data = await res.json();
            setUsers(data.filter(u => !group.members.some(m => m._id === u._id)));
        } catch (e) { console.error(e); }
    };

    const addMember = async (userId) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/add/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await res.json();
            if (data.success) {
                setAddModalVisible(false);
                fetchGroupDetails();
                Alert.alert("Success", "Member added");
            } else { Alert.alert("Error", data.error); }
        } catch (e) { Alert.alert("Error", "Network error"); }
    };

    const callAdminAction = async (action, userId) => {
        try {
            const endpoint = action === 'promote' ? 'promote' : 'remove';
            const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/${endpoint}/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, requesterId: myId })
            });
            const data = await res.json();
            if (data.success) {
                fetchGroupDetails();
                Alert.alert("Success", data.message);
            } else {
                Alert.alert("Error", data.error || "Failed");
            }
        } catch (e) { Alert.alert("Error", "Network error"); }
    };

    const handleMemberAction = (member) => {
        if (!isAdmin(myId) || member._id === myId) return;

        const options = [
            { text: "Cancel", style: "cancel" }
        ];

        if (!isAdmin(member._id)) {
            options.push({
                text: "Make Group Admin",
                onPress: () => {
                    Alert.alert("Confirm", `Make ${member.name} an admin?`, [
                        { text: "Cancel" },
                        { text: "Make Admin", onPress: () => callAdminAction('promote', member._id) }
                    ]);
                }
            });
        }

        options.push({
            text: "Remove from Group",
            style: "destructive",
            onPress: () => {
                Alert.alert("Confirm", `Remove ${member.name}?`, [
                    { text: "Cancel" },
                    { text: "Remove", style: "destructive", onPress: () => callAdminAction('remove', member._id) }
                ]);
            }
        });

        Alert.alert(member.name, "Choose action", options);
    };

    const isAdmin = (userId) => {
        if (!group || !group.admins) return false;
        // Admins might be populated objects or IDs.
        return group.admins.some(admin => (typeof admin === 'object' ? admin._id : admin) === userId);
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.secondary} />
            </View>
        );
    }

    if (!group) {
        return (
            <View style={styles.container}>
                <Text style={{ color: theme.textPrimary, textAlign: 'center', marginTop: 20 }}>Group not found</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Group Info</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                {/* Group Profile */}
                <View style={styles.profileContainer}>
                    <View style={styles.avatarLarge}>
                        {group.type === 'announcement' ? (
                            <Ionicons name="megaphone" size={60} color="white" />
                        ) : (
                            <Ionicons name="people" size={60} color="white" />
                        )}
                    </View>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupCount}>Group · {group.members.length} members</Text>
                </View>

                {/* Description */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <Text style={styles.sectionTitle}>Description</Text>
                        {isAdmin(myId) && (
                            <TouchableOpacity onPress={() => { setDescText(group.description || ''); setIsEditingDesc(!isEditingDesc); }}>
                                <Ionicons name={isEditingDesc ? "close" : "pencil"} size={20} color={theme.secondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    {isEditingDesc ? (
                        <View>
                            <TextInput
                                value={descText}
                                onChangeText={setDescText}
                                style={{ backgroundColor: theme.inputBg, color: theme.textPrimary, padding: 10, borderRadius: 8, marginBottom: 10, minHeight: 60, textAlignVertical: 'top' }}
                                multiline
                                placeholder="Add group description..."
                                placeholderTextColor={theme.textLight}
                            />
                            <TouchableOpacity style={{ backgroundColor: theme.secondary, padding: 10, borderRadius: 8, alignItems: 'center' }} onPress={updateDescription}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <Text style={styles.descriptionText}>{group.description || "No description available."}</Text>
                    )}
                </View>

                {/* Add Member (Available for Everyone) */}
                <TouchableOpacity style={styles.actionRow} onPress={() => { fetchUsers(); setAddModalVisible(true); }}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.secondary }]}>
                        <Ionicons name="person-add" size={20} color="white" />
                    </View>
                    <Text style={styles.actionText}>Add Participants</Text>
                </TouchableOpacity>

                {/* Participants */}
                <View style={styles.section}>
                    <Text style={{ color: theme.secondary, marginBottom: 10, fontWeight: 'bold' }}>
                        {group.members.length} participants
                    </Text>

                    {group.members.map((member) => (
                        <TouchableOpacity key={member._id} style={styles.memberRow} onPress={() => handleMemberAction(member)} activeOpacity={isAdmin(myId) ? 0.7 : 1}>
                            <View style={styles.memberAvatar}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{member.name ? member.name[0] : 'U'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.memberName}>
                                        {member._id === myId ? "You" : member.name}
                                    </Text>
                                    {isAdmin(member._id) && (
                                        <Text style={styles.adminBadge}>Group Admin</Text>
                                    )}
                                </View>
                                <Text style={styles.memberStatus}>Available</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Exit Group */}
                <TouchableOpacity style={[styles.actionRow, { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 20 }]} onPress={() => Alert.alert("Exit", "Exit Group logic here")}>
                    <Ionicons name="log-out-outline" size={24} color={theme.error} style={{ marginRight: 15 }} />
                    <Text style={[styles.actionText, { color: theme.error }]}>Exit Group</Text>
                </TouchableOpacity>

            </ScrollView>

            <Modal visible={addModalVisible} animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setAddModalVisible(false)}><Ionicons name="close" size={24} color="white" /></TouchableOpacity>
                        <Text style={[styles.headerTitle, { marginLeft: 15 }]}>Add Participants</Text>
                    </View>
                    <FlatList
                        data={users}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.memberRow} onPress={() => addMember(item._id)}>
                                <View style={styles.memberAvatar}>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>{item.name[0]}</Text>
                                </View>
                                <View>
                                    <Text style={styles.memberName}>{item.name}</Text>
                                    <Text style={styles.memberStatus}>{item.phoneNumber || "No phone"}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ padding: 20 }}
                        ListEmptyComponent={<Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>No users found</Text>}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const getStyles = (Colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: Colors.primary,
        elevation: 4
    },
    backBtn: { marginRight: 20 },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    profileContainer: { alignItems: 'center', padding: 20, backgroundColor: Colors.surface, marginBottom: 10 },
    avatarLarge: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: Colors.secondary,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 15
    },
    groupName: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 5 },
    groupCount: { fontSize: 14, color: Colors.textSecondary },
    section: { backgroundColor: Colors.surface, padding: 15, marginBottom: 10 },
    sectionTitle: { color: Colors.secondary, fontWeight: 'bold', marginBottom: 5 },
    descriptionText: { color: Colors.textPrimary, fontSize: 16 },
    actionRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: Colors.surface, marginBottom: 1 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    actionText: { fontSize: 16, color: Colors.textPrimary, fontWeight: '500' },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    memberAvatar: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: Colors.inputBg,
        justifyContent: 'center', alignItems: 'center',
        marginRight: 15
    },
    memberName: { fontSize: 16, color: Colors.textPrimary, fontWeight: 'bold' },
    memberStatus: { fontSize: 12, color: Colors.textSecondary },
    adminBadge: {
        fontSize: 10, color: Colors.secondary,
        borderWidth: 1, borderColor: Colors.secondary,
        borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
        marginLeft: 10
    }
});
