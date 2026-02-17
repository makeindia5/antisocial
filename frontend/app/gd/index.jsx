import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../src/services/apiService';
import { useTheme } from '../../src/context/ThemeContext';
import Card from '../../src/components/ui/Card';

const { width } = Dimensions.get('window');

export default function GroupDiscussionListScreen({ showBack = false }) {
    const router = useRouter();
    const { colors: theme } = useTheme();

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
        useCallback(() => { fetchGroups(); checkAdmin(); }, [])
    );

    const checkAdmin = async () => {
        const role = await AsyncStorage.getItem('userRole');
        setIsAdmin(role === 'admin');
    };

    const SERVER_URL = "http://192.168.29.129:5000";

    const fetchGroups = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/gd/groups`);
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
        if (!newGroupName.trim()) return Alert.alert("Error", "Group Name is required");

        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/gd/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newGroupName, description: newGroupDesc, createdBy: userId })
            });
            const data = await res.json();
            if (res.ok) {
                setCreateModalVisible(false);
                setNewGroupName('');
                setNewGroupDesc('');
                fetchGroups();
            } else {
                Alert.alert("Error", data.error || "Failed");
            }
        } catch (e) { Alert.alert("Error", "Network Failed"); }
    };

    const renderTile = ({ item }) => (
        <Card
            style={styles.tile}
            variant="elevated"
            onPress={() => router.push({ pathname: `/gd/${item._id}`, params: { name: item.name } })}
        >
            <View style={[styles.tileIcon, { backgroundColor: theme.inputBg }]}>
                <Ionicons name="chatbubbles" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.tileTitle, { color: theme.textPrimary }]} numberOfLines={2}>{item.name}</Text>
            {item.description ? (
                <Text style={[styles.tileDesc, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>
            ) : null}

            <View style={styles.tileFooter}>
                <Text style={[styles.memberCount, { color: theme.textSecondary }]}>Active</Text>
                <Ionicons name="arrow-forward-circle" size={24} color={theme.secondary} />
            </View>
        </Card>
    );

    if (loading) return <ActivityIndicator size="large" color={theme.secondary} style={{ marginTop: 20 }} />;

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 40, marginBottom: 10 }}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/communityScreen')} style={{ marginRight: 15 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 24, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 }}>Discussions</Text>
            </View>

            <FlatList
                data={groups}
                numColumns={2}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={renderTile}
                keyExtractor={item => item._id}
                contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }}
                columnWrapperStyle={{ justifyContent: 'space-between' }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={50} color={theme.textLight} />
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No discussions found</Text>
                    </View>
                }
            />

            {isAdmin && (
                <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={() => setCreateModalVisible(true)}>
                    <Ionicons name="add" size={30} color="white" />
                </TouchableOpacity>
            )}

            <Modal visible={createModalVisible} transparent animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalView, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New Discussion</Text>
                        <TextInput
                            placeholder="Topic Name"
                            placeholderTextColor={theme.textLight}
                            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                        />
                        <TextInput
                            placeholder="Description (Optional)"
                            placeholderTextColor={theme.textLight}
                            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                            value={newGroupDesc}
                            onChangeText={setNewGroupDesc}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={{ padding: 10 }}>
                                <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateGroup} style={{ padding: 10, backgroundColor: theme.primary, borderRadius: 8 }}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Create</Text>
                            </TouchableOpacity>
                        </View>
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
    tile: {
        width: (width - 48) / 2, // 2 columns with padding
        marginBottom: 15,
        padding: 15,
        borderRadius: 20,
        justifyContent: 'space-between',
        minHeight: 160,
    },
    tileIcon: {
        width: 50,
        height: 50,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    tileTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    tileDesc: {
        fontSize: 12,
        marginBottom: 10,
    },
    tileFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
    },
    memberCount: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10 },
    fab: {
        position: 'absolute', bottom: 20, right: 20,
        width: 56, height: 56, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        elevation: 8,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
    modalView: { padding: 25, borderRadius: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { padding: 15, borderRadius: 12, marginBottom: 15 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
});
