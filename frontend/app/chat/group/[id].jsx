import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ImageBackground, StyleSheet, StatusBar, Keyboard, Alert, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/context/ThemeContext';
import { Colors } from '../../../src/styles/theme';

// Use same env logic or hardcode for consistency matching user env
const BACKEND_URL = "http://192.168.29.129:5000";

export default function GroupChatScreen() {
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const { id, name } = useLocalSearchParams(); // id is groupId
    const router = useRouter();
    const [myId, setMyId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const socket = useRef(null);
    const flatListRef = useRef(null);

    useEffect(() => {
        AsyncStorage.getItem("userId").then(setMyId);
    }, []);

    // Fetch Group Details & Messages
    useEffect(() => {
        if (!id) return;
        setLoading(true);

        // Fetch Details
        fetch(`${BACKEND_URL}/api/auth/chat/group/details/${id}`)
            .then(res => res.json())
            .then(data => {
                if (!data.error) setGroupData(data);
            })
            .catch(console.error);

        // Fetch Messages
        fetch(`${BACKEND_URL}/api/auth/chat/group/messages/${id}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setMessages(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    // Socket Connection
    useEffect(() => {
        if (!myId || !id) return;
        socket.current = io(BACKEND_URL);

        socket.current.on('connect', () => {
            console.log("Connected to socket");
            socket.current.emit('joinGroup', id);
        });

        socket.current.on('receiveMessage', (msg) => {
            // Verify it belongs to this group (socket rooms handles it, but safety check)
            if (msg.groupId === id) {
                setMessages((prev) => [...prev, msg]);
            }
        });

        socket.current.on('messageDeleted', (msgId) => {
            setMessages((prev) => prev.filter((msg) => msg._id !== msgId));
        });

        socket.current.on('messageReadBy', ({ msgId, userId }) => {
            setMessages(prev => prev.map(msg => {
                if (msg._id === msgId) {
                    const exists = msg.readBy?.some(r => (r.user?._id || r.user) === userId);
                    if (!exists) {
                        // We don't have full user object here, but ID is enough for count
                        // For detailed info, we might need to fetch or just store ID
                        return { ...msg, readBy: [...(msg.readBy || []), { user: userId, readAt: new Date() }] };
                    }
                }
                return msg;
            }));
        });

        return () => {
            socket.current.emit('leaveGroup', id);
            socket.current.disconnect();
        };
    }, [myId, id]);

    // Mark messages as read
    useEffect(() => {
        if (!myId || messages.length === 0 || !socket.current) return;
        messages.forEach(msg => {
            const senderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            if (senderId !== myId) {
                const isRead = msg.readBy?.some(r => (typeof r.user === 'object' ? r.user._id : r.user) === myId);
                if (!isRead) {
                    socket.current.emit('markAsRead', { msgId: msg._id, userId: myId });
                }
            }
        });
    }, [messages, myId]);

    const sendMessage = () => {
        if (!text.trim() || !myId) return;
        const msgData = {
            sender: myId,
            groupId: id, // Send to Group
            content: text
        };
        socket.current.emit('sendMessage', msgData);
        setText('');
    };

    const handleLongPress = (item) => {
        const senderId = typeof item.sender === 'object' ? item.sender._id : item.sender;
        const isMe = senderId === myId;

        const options = [
            { text: "Message Info", onPress: () => { setSelectedMessage(item); setInfoModalVisible(true); } },
            { text: "Cancel", style: "cancel" }
        ];

        if (isMe) {
            options.splice(1, 0, {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    Alert.alert("Confirm", "Delete this message?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => socket.current.emit('deleteMessage', { msgId: item._id, userId: myId }) }
                    ]);
                }
            });
        }

        Alert.alert("Message Options", null, options);
    };

    const renderTicks = (item) => {
        if (!groupData) return null;
        const readCount = item.readBy?.length || 0;
        const totalMembers = groupData.members?.length || 0;
        // All read (excluding sender) => Blue Double
        // Some read => Grey Double
        // None read => Grey Single
        const isAllRead = readCount >= (totalMembers - 1);

        if (isAllRead && totalMembers > 1) return <Ionicons name="checkmark-done-outline" size={16} color="#34B7F1" />; // Blue Double
        if (readCount > 0) return <Ionicons name="checkmark-done-outline" size={16} color="rgba(255,255,255,0.7)" />; // Grey Double
        return <Ionicons name="checkmark-outline" size={16} color="rgba(255,255,255,0.7)" />; // Single
    };

    // Admin/Announcement Check
    const canSend = () => {
        if (!groupData) return true;
        if (groupData.type === 'announcement') {
            // Check if I am admin
            const isAdmin = groupData.admins.some(admin =>
                (typeof admin === 'object' ? admin._id : admin) === myId
            );
            return isAdmin;
        }
        return true;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => router.push(`/chat/group/info/${id}`)}
                >
                    <View style={styles.avatarContainer}>
                        {groupData?.type === 'announcement' ? (
                            <Ionicons name="megaphone" size={40} color="white" />
                        ) : (
                            <Ionicons name="people" size={40} color="white" />
                        )}
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle}>{name || groupData?.name || "Group"}</Text>
                        <Text style={styles.headerStatus}>
                            {groupData ? `${groupData.members?.length || 0} members` : 'Loading...'}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>

            <ImageBackground
                source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }}
                style={{ flex: 1, backgroundColor: theme.background }}
                resizeMode="repeat"
                imageStyle={{ opacity: 0.1 }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                    style={{ flex: 1 }}
                >
                    {loading ? (
                        <ActivityIndicator size="large" color={theme.secondary} style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            keyboardShouldPersistTaps="handled"
                            ref={flatListRef}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            data={messages}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={({ item }) => {
                                const senderId = typeof item.sender === 'object' ? item.sender._id : item.sender;
                                const isMe = senderId === myId;
                                return (
                                    <View style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                        {/* Sender Name if not me */}
                                        {!isMe && (
                                            <Text style={{ fontSize: 10, color: theme.textSecondary, marginLeft: 20, marginBottom: 2 }}>
                                                {item.sender?.name || "User"}
                                            </Text>
                                        )}
                                        <TouchableOpacity
                                            onLongPress={() => handleLongPress(item)}
                                            activeOpacity={0.8}
                                            style={[
                                                styles.msgBubble,
                                                isMe ? styles.msgMe : styles.msgOther
                                            ]}
                                        >
                                            <Text style={isMe ? styles.msgTextMe : styles.msgText}>{item.content}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                                                <Text style={styles.timeText}>
                                                    {item.createdAt
                                                        ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    }
                                                </Text>
                                                {isMe && (
                                                    <View style={{ marginLeft: 5 }}>
                                                        {renderTicks(item)}
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                );
                            }}
                            contentContainerStyle={{ paddingVertical: 10 }}
                        />
                    )}

                    {/* Input Area */}
                    {canSend() ? (
                        <View style={styles.inputContainer}>
                            <TextInput
                                value={text}
                                onChangeText={setText}
                                style={styles.input}
                                placeholder="Type a message"
                                placeholderTextColor="#999"
                            />
                            <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                                <Ionicons name="send" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ padding: 15, backgroundColor: theme.surface, alignItems: 'center' }}>
                            <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>Only admins can send messages.</Text>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </ImageBackground>

            <Modal visible={infoModalVisible} animationType="slide" onRequestClose={() => setInfoModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setInfoModalVisible(false)} style={{ marginRight: 15 }}>
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Message Info</Text>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <View style={[styles.msgBubble, styles.msgMe, { alignSelf: 'center', marginBottom: 20 }]}>
                            <Text style={styles.msgTextMe}>{selectedMessage?.content}</Text>
                        </View>
                        <Text style={{ color: theme.textSecondary, fontWeight: 'bold', marginBottom: 10 }}>Read By</Text>
                        {selectedMessage?.readBy && selectedMessage.readBy.length > 0 ? (
                            selectedMessage.readBy.map((reader, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                    {/* Avatar placeholder */}
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>{(reader.user?.name || "U")[0]}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>{reader.user?.name || "Unknown"}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                            {reader.readAt ? new Date(reader.readAt).toLocaleTimeString() + ', ' + new Date(reader.readAt).toLocaleDateString() : 'Just now'}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <Text style={{ color: theme.textLight, fontStyle: 'italic' }}>Not read by anyone yet.</Text>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView >
    );
}

const getStyles = (Colors) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 15,
        paddingVertical: 10,
        elevation: 4
    },
    backBtn: { marginRight: 15 },
    avatarContainer: { marginRight: 10 },
    headerInfo: { flex: 1 },
    headerTitle: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
    headerStatus: { color: Colors.textLight, fontSize: 12 },
    msgBubble: {
        marginHorizontal: 15,
        marginVertical: 5,
        padding: 12,
        borderRadius: 15,
        maxWidth: '75%',
        elevation: 1
    },
    msgMe: { backgroundColor: Colors.secondary, borderBottomRightRadius: 2 },
    msgOther: { backgroundColor: Colors.surface, borderBottomLeftRadius: 2 },
    msgText: { fontSize: 16, color: Colors.textPrimary },
    msgTextMe: { fontSize: 16, color: Colors.white },
    timeText: { fontSize: 10, color: Colors.white, alignSelf: 'flex-end', marginTop: 5, opacity: 0.8 },
    inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center', backgroundColor: Colors.surface },
    input: {
        flex: 1,
        backgroundColor: Colors.inputBg,
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        color: Colors.textPrimary
    },
    sendBtn: {
        backgroundColor: Colors.secondary,
        padding: 12,
        borderRadius: 25,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
