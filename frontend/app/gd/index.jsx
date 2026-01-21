import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../src/services/apiService';
import { Colors } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';

export default function GroupDiscussionListScreen({ showBack = true }) {
    const router = useRouter();
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Create Modal
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchGroups();
        await checkAdmin();
        setRefreshing(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchGroups();
            checkAdmin();
        }, [])
    );

    const checkAdmin = async () => {
        const role = await AsyncStorage.getItem('userRole');
        setIsAdmin(role === 'admin');
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch(`${API_BASE}/gd/groups`);
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (e) {
            console.log("Error fetching groups", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            Alert.alert("Error", "Group Name is required");
            return;
        }

        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/gd/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newGroupName,
                    description: newGroupDesc,
                    createdBy: userId
                })
            });
            const data = await res.json();
            if (res.ok) {
                Alert.alert("Success", "Group Created");
                setCreateModalVisible(false);
                setNewGroupName('');
                setNewGroupDesc('');
                fetchGroups();
            } else {
                Alert.alert("Error", data.error || "Failed to create group");
            }
        } catch (e) {
            Alert.alert("Error", "Network Failed");
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: `/gd/${item._id}`, params: { name: item.name } })}
        >
            <View style={styles.iconContainer}>
                <Ionicons name="people" size={28} color="white" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{item.name}</Text>
                {item.description ? <Text style={styles.groupDesc} numberOfLines={1}>{item.description}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
    );

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={[styles.headerRow, { position: 'relative', justifyContent: 'center' }]}>
                {showBack && (
                    <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: 0, zIndex: 10 }}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                )}
                <Text style={styles.headerText}>Group Discussions</Text>
            </View>
        </View>
    );

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={theme.secondary} /></View>;

    return (
        <View style={styles.container}>
            {renderHeader()}
            <FlatList
                data={groups}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={renderItem}
                keyExtractor={item => item._id}
                contentContainerStyle={{ padding: 15 }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={60} color={theme.textLight} />
                        <Text style={styles.emptyText}>No Discussions Yet</Text>
                    </View>
                }
            />

            {isAdmin && (
                <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
                    <Ionicons name="add" size={30} color="white" />
                </TouchableOpacity>
            )}

            <Modal visible={createModalVisible} transparent={true} animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalTitle}>Create New Group</Text>

                        <TextInput
                            placeholder="Group Name"
                            placeholderTextColor={theme.textLight}
                            style={styles.input}
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                        />

                        <TextInput
                            placeholder="Description (Optional)"
                            placeholderTextColor={theme.textLight}
                            style={styles.input}
                            value={newGroupDesc}
                            onChangeText={setNewGroupDesc}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={[styles.btn, styles.btnCancel]}>
                                <Text style={styles.btnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateGroup} style={[styles.btn, styles.btnCreate]}>
                                <Text style={styles.btnTextCreate}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        backgroundColor: theme.primary,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        paddingHorizontal: 20,
        paddingTop: 10,
        elevation: 5,
        marginBottom: 10
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10
    },
    headerText: { color: theme.white, fontSize: 20, fontWeight: 'bold' },
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
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, color: theme.textSecondary },

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
    input: { backgroundColor: theme.inputBg, padding: 15, borderRadius: 10, marginBottom: 15, color: theme.textPrimary },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
    btn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
    btnCancel: { backgroundColor: theme.inputBg },
    btnCreate: { backgroundColor: theme.secondary },
    btnTextCancel: { color: theme.textPrimary },
    btnTextCreate: { color: 'white', fontWeight: 'bold' }
});
