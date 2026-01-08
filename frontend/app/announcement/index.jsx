import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../src/services/apiService';
import { Colors, GlobalStyles } from '../../src/styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AnnouncementGroupsScreen() {
    const router = useRouter();
    const [groups, setGroups] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);

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

    const checkRole = async () => {
        const role = await AsyncStorage.getItem('userRole');
        setIsAdmin(role === 'admin');
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/group/list`);
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
            }
        } catch (err) {
            console.error("Fetch Error:", err);
        } finally {
            setRefreshing(false);
        }
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
        <View style={styles.header}>
            <SafeAreaView>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={28} color={Colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.headerText}>Announcement Groups</Text>
                    <View style={{ width: 28 }} />
                </View>
            </SafeAreaView>
        </View>
    );

    return (
        <View style={GlobalStyles.container}>
            {renderHeader()}

            <FlatList
                data={groups}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContent}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={styles.cardContainer}
                        onPress={() => router.push(`/announcement/group/${item._id}`)}
                    >
                        <View style={styles.card}>
                            {item.icon ? (
                                <Image source={{ uri: `${API_BASE.replace('/api/auth', '')}${item.icon}` }} style={styles.groupIcon} />
                            ) : (
                                <View style={[styles.iconContainer, { backgroundColor: '#e0f2fe' }]}>
                                    <Ionicons name="people" size={24} color={Colors.secondary} />
                                </View>
                            )}

                            <View style={styles.textContainer}>
                                <Text style={styles.title}>{item.name}</Text>
                                <Text style={styles.content} numberOfLines={2}>{item.description || 'No description available'}</Text>
                                <View style={styles.metaContainer}>
                                    <Ionicons name="person-outline" size={12} color={Colors.textLight} />
                                    <Text style={styles.date}>{item.members?.length || 0} members</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={Colors.border} />
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={60} color={Colors.border} />
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

const styles = StyleSheet.create({
    header: {
        backgroundColor: Colors.primary,
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
        justifyContent: 'space-between',
        marginTop: 10
    },
    headerText: { color: Colors.white, fontSize: 20, fontWeight: 'bold' },
    listContent: { padding: 20, paddingBottom: 100 },
    cardContainer: { marginBottom: 15 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        elevation: 3,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    groupIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        backgroundColor: Colors.inputBg
    },
    textContainer: { flex: 1 },
    title: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary },
    content: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
    metaContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    date: { fontSize: 12, color: Colors.textLight, marginLeft: 4 },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: Colors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalView: { backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 10, color: Colors.textLight, fontSize: 16 }
});
