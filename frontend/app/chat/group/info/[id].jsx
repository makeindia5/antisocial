import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, TextInput, RefreshControl, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../src/context/ThemeContext';
import { Colors } from '../../../../src/styles/theme';

import * as ImagePicker from 'expo-image-picker';

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
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
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
            const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/settings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: descText })
            });
            const data = await res.json();
            if (data.success) {
                setGroup({ ...group, description: descText });
                setIsEditingDesc(false);
            } else {
                Alert.alert("Error", data.error || "Failed to update description");
            }
        } catch (e) { Alert.alert("Error", "Network error"); }
    };

    const exitGroup = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/remove/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: myId })
            });
            const data = await res.json();
            if (data.success) {
                router.replace('/(tabs)/communityScreen');
            } else {
                Alert.alert("Error", data.error || "Failed to leave group");
            }
        } catch (e) { Alert.alert("Error", "Network error"); }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/community/users`);
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
        console.log("isAdmin Check - MyID:", userId, "Admins:", JSON.stringify(group.admins));
        return group.admins.some(admin => String(typeof admin === 'object' ? admin._id : admin) === String(userId));
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                uploadIcon({
                    uri: asset.uri,
                    name: asset.fileName || 'group_icon.jpg',
                    mimeType: 'image/jpeg' // Force mimeType for FormData stability
                });
            }
        } catch (e) {
            Alert.alert("Error", "Could not pick image");
        }
    };

    const uploadIcon = async (fileData) => {
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: fileData.uri,
                name: fileData.name,
                type: fileData.mimeType
            });

            const res = await fetch(`${BACKEND_URL}/api/auth/upload`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = await res.json();

            if (res.ok) {
                const updateRes = await fetch(`${BACKEND_URL}/api/auth/chat/group/icon/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ icon: data.url })
                });
                if (updateRes.ok) {
                    setGroup(prev => ({ ...prev, icon: data.url }));
                    Alert.alert("Success", "Group icon updated!");
                }
            } else {
                Alert.alert("Error", "Upload failed");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to update icon");
        }
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
                    <TouchableOpacity onPress={isAdmin(myId) ? pickImage : null} activeOpacity={0.8}>
                        <View style={styles.avatarLarge}>
                            {group.icon ? (
                                <Image source={{ uri: `${BACKEND_URL}${group.icon}` }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                            ) : (
                                group.type === 'announcement' ? (
                                    <Ionicons name="megaphone" size={60} color="white" />
                                ) : (
                                    <Ionicons name="people" size={60} color="white" />
                                )
                            )}
                            {isAdmin(myId) && (
                                <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.primary, borderRadius: 15, padding: 5, borderWidth: 2, borderColor: theme.surface }}>
                                    <Ionicons name="camera" size={16} color="white" />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                    {isEditingName ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                            <TextInput
                                style={[styles.groupName, { borderBottomWidth: 1, borderColor: theme.textSecondary, paddingBottom: 2, minWidth: 150, textAlign: 'center' }]}
                                value={editedName}
                                onChangeText={setEditedName}
                                autoFocus
                            />
                            <TouchableOpacity onPress={async () => {
                                if (!editedName.trim()) return;
                                try {
                                    const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/settings/${id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name: editedName })
                                    });
                                    if (res.ok) {
                                        setGroup(prev => ({ ...prev, name: editedName }));
                                        setIsEditingName(false);
                                        Alert.alert("Success", "Group name updated");
                                    } else {
                                        Alert.alert("Error", "Failed to update name");
                                    }
                                } catch (e) {
                                    Alert.alert("Error", "Network error");
                                }
                            }} style={{ marginLeft: 10 }}>
                                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsEditingName(false)} style={{ marginLeft: 10 }}>
                                <Ionicons name="close-circle" size={24} color="red" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                            <Text style={[styles.groupName, { color: theme.textPrimary }]}>{group.name}</Text>
                            {isAdmin(myId) && (
                                <TouchableOpacity onPress={() => { setEditedName(group.name); setIsEditingName(true); }} style={{ marginLeft: 10 }}>
                                    <Ionicons name="pencil" size={18} color={theme.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    <Text style={styles.groupCount}>Group</Text>
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



                {/* Group Settings (Admin Only) */}
                {isAdmin(myId) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Group Settings</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                            <View>
                                <Text style={{ color: theme.textPrimary, fontSize: 16 }}>Send Messages</Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                    {group.onlyAdminsCanPost ? "Only Admins" : "All Participants"}
                                </Text>
                            </View>
                            <Switch
                                value={group.onlyAdminsCanPost}
                                onValueChange={async (newValue) => {
                                    try {
                                        setGroup({ ...group, onlyAdminsCanPost: newValue }); // Optimistic update
                                        const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/settings/${id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ onlyAdminsCanPost: newValue })
                                        });
                                        const data = await res.json();
                                        if (!data.success) {
                                            setGroup({ ...group, onlyAdminsCanPost: !newValue }); // Revert
                                            Alert.alert("Error", "Failed to update settings");
                                        }
                                    } catch (e) {
                                        setGroup({ ...group, onlyAdminsCanPost: !newValue });
                                        Alert.alert("Error", "Network error");
                                    }
                                }}
                                trackColor={{ false: "#767577", true: theme.primary }}
                                thumbColor={group.onlyAdminsCanPost ? "#f4f3f4" : "#f4f3f4"}
                            />
                        </View>
                    </View>
                )}

                {/* Add Member (Admin Only) */}
                {isAdmin(myId) && (
                    <TouchableOpacity style={styles.actionRow} onPress={() => { fetchUsers(); setAddModalVisible(true); }}>
                        <View style={[styles.iconCircle, { backgroundColor: theme.secondary }]}>
                            <Ionicons name="person-add" size={20} color="white" />
                        </View>
                        <Text style={styles.actionText}>Add Participants</Text>
                    </TouchableOpacity>
                )}

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
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={[styles.actionRow, { borderTopWidth: 1, borderTopColor: theme.border, marginTop: 20 }]} onPress={() => {
                    const isCommunity = group.type?.toLowerCase() === 'community';
                    Alert.alert(
                        isCommunity ? "Exit Community" : "Exit Group",
                        `Are you sure you want to exit this ${isCommunity ? "community" : "group"}?`,
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Exit", style: "destructive", onPress: exitGroup }
                        ]
                    );
                }}>
                    <Ionicons name="log-out-outline" size={24} color={theme.error} style={{ marginRight: 15 }} />
                    <Text style={[styles.actionText, { color: theme.error }]}>
                        {group.type?.toLowerCase() === 'community' ? "Exit Community" : "Exit Group"}
                    </Text>
                </TouchableOpacity>

            </ScrollView>

            <Modal visible={addModalVisible} animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
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
        </SafeAreaView >
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
