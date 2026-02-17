import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, FlatList, Image, ActivityIndicator, Animated, PanResponder, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import { API_BASE } from '../../../services/apiService';

const ShareModal = ({ visible, onClose, currentUser, selectedItem, itemType = 'reel' }) => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [sentUsers, setSentUsers] = useState([]);

    const panY = useRef(new Animated.Value(0)).current;
    const socket = useRef(null);

    useEffect(() => {
        if (visible) {
            fetchUsers();
            setSentUsers([]);
            setSearch('');
            panY.setValue(0);

            // Connect Socket
            const socketUrl = API_BASE.replace('/api/auth', '');
            socket.current = io(socketUrl);
            socket.current.emit('join', currentUser?._id);
        }

        return () => {
            if (socket.current) socket.current.disconnect();
        };
    }, [visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gestureState) => {
                // Close if dragged down far enough OR if it was a tap (minimal movement)
                if (gestureState.dy > 100 || (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5)) {
                    onClose();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true
                    }).start();
                }
            },
        })
    ).current;

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/community/users`);
            const data = await res.json();
            if (Array.isArray(data)) {
                // Filter out current user
                const others = data.filter(u => u._id !== currentUser?._id);
                setUsers(others);
                setFilteredUsers(others);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (text) => {
        setSearch(text);
        if (!text.trim()) {
            setFilteredUsers(users);
        } else {
            const lower = text.toLowerCase();
            const filtered = users.filter(u => u.name.toLowerCase().includes(lower));
            setFilteredUsers(filtered);
        }
    };

    const handleSend = (userId) => {
        setSentUsers(prev => [...prev, userId]);

        if (socket.current && selectedItem) {
            let contentUrl;
            if (itemType === 'reel') {
                contentUrl = selectedItem.url.startsWith('http') ? selectedItem.url : `${API_BASE.replace('/api/auth', '')}${selectedItem.url}`;
            } else {
                contentUrl = selectedItem.mediaUrl.startsWith('http') ? selectedItem.mediaUrl : `${API_BASE.replace('/api/auth', '')}${selectedItem.mediaUrl}`;
            }

            socket.current.emit('sendMessage', {
                sender: currentUser._id,
                recipient: userId,
                content: contentUrl,
                type: itemType
            });
        }
    };

    if (!visible) return null;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.modalContent,
                        { height: '60%', transform: [{ translateY: panY }] }
                    ]}
                >
                    <View
                        style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}
                        {...panResponder.panHandlers}
                    >
                        <View style={styles.grabber} />
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search"
                            placeholderTextColor="#8E8E93"
                            value={search}
                            onChangeText={handleSearch}
                        />
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="white" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            keyExtractor={item => item._id}
                            renderItem={({ item }) => {
                                const isSent = sentUsers.includes(item._id);
                                return (
                                    <TouchableOpacity style={styles.userItem} onPress={() => !isSent && handleSend(item._id)}>
                                        <View style={styles.userAvatarContainer}>
                                            {item.profilePic ? (
                                                <Image source={{ uri: `${API_BASE.replace('/api/auth', '')}${item.profilePic}` }} style={styles.userAvatar} />
                                            ) : (
                                                <Ionicons name="person-circle" size={50} color="#ccc" />
                                            )}
                                        </View>
                                        <View style={styles.userInfoContainer}>
                                            <Text style={styles.userName}>{item.name}</Text>
                                            <Text style={styles.userHandle}>@{item.name.replace(/\s+/g, '').toLowerCase()}</Text>
                                        </View>
                                        <View style={[styles.sendButton, isSent && styles.sentButton]}>
                                            <Text style={[styles.sendButtonText, isSent && styles.sentButtonText]}>
                                                {isSent ? 'Sent' : 'Send'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    )}
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        width: '100%',
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 100 : 90, // Clear the bottom nav bar (85px)
    },
    grabber: {
        width: 40,
        height: 5,
        backgroundColor: '#48484a',
        borderRadius: 2.5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2c2c2e',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        marginBottom: 20,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: 'white',
        fontSize: 16,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    userAvatarContainer: {
        marginRight: 15,
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    userInfoContainer: {
        flex: 1,
    },
    userName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    userHandle: {
        color: '#8E8E93',
        fontSize: 14,
    },
    sendButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 18,
    },
    sentButton: {
        backgroundColor: '#3a3a3c',
    },
    sendButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    sentButtonText: {
        color: '#8E8E93',
    },
});

export default ShareModal;
