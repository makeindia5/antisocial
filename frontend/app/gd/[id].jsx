import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Keyboard, Modal, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { Colors, GlobalStyles } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';

const BACKEND_URL = "http://192.168.29.129:5000";

export default function GroupDiscussionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { id, name } = useLocalSearchParams();
    const { colors: theme } = useTheme();
    // const styles = getStyles(theme); // Removed to use module-level styles

    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);

    const [summaryModalVisible, setSummaryModalVisible] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [allUsers, setAllUsers] = useState([]);

    // Context Menu State
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyToMessage, setReplyToMessage] = useState(null);

    const socket = useRef(null);
    const flatListRef = useRef(null);

    const handleLongPress = (msg) => {
        setSelectedMessage(msg);
        setContextMenuVisible(true);
    };

    const handleReaction = (emoji) => {
        if (!selectedMessage) return;
        socket.current.emit('addReaction', { msgId: selectedMessage._id, emoji, userId });
        setContextMenuVisible(false);
    };

    const handleAction = async (action) => {
        setContextMenuVisible(false);
        if (!selectedMessage) return;

        switch (action) {
            case 'reply':
                setReplyToMessage(selectedMessage);
                break;
            case 'copy':
                await Clipboard.setStringAsync(selectedMessage.content || "");
                Alert.alert("Copied");
                break;
            case 'delete':
                if (isAdmin || selectedMessage.sender === userId || selectedMessage.sender?._id === userId) {
                    Alert.alert("Delete Message", "Delete?", [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => socket.current.emit('deleteMessage', { msgId: selectedMessage._id, chatId: 'finance-gd', isGroup: true })
                        }
                    ]);
                } else {
                    Alert.alert("Error", "You cannot delete this message");
                }
                break;
            case 'info':
                Alert.alert("Message Info", `Sent: ${new Date(selectedMessage?.createdAt).toLocaleString()}`);
                break;
        }
    };

    useEffect(() => {
        AsyncStorage.setItem('lastReadGD', new Date().toISOString());
        checkUserRole();
        fetchStatus();
        fetchHistory();
        setupSocket();
        return () => {
            if (socket.current) socket.current.disconnect();
            AsyncStorage.setItem('lastReadGD', new Date().toISOString());
        };
    }, []);

    const checkUserRole = async () => {
        const storedUserId = await AsyncStorage.getItem("userId");
        setUserId(storedUserId);
        if (storedUserId) {
            const res = await fetch(`${BACKEND_URL}/api/auth/admin-id`);
            const data = await res.json();
            if (data.adminId === storedUserId) setIsAdmin(true);
        }
    };

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/gd/${id}`);
            const data = await res.json();
            handleStatusUpdate(data);
        } catch (e) { } finally { setLoading(false); }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/gd/${id}/messages`);
            const data = await res.json();
            if (Array.isArray(data)) setMessages(data);
        } catch (e) { }
    };

    const setupSocket = () => {
        socket.current = io(BACKEND_URL);
        socket.current.on('connect', () => {
            socket.current.emit('joinGroup', id);
        });
        socket.current.on('gdStatusUpdate', handleStatusUpdate);
        socket.current.on('receiveMessage', (msg) => {
            setMessages((prev) => [...prev, msg]);
        });
        socket.current.on('messageReaction', ({ msgId, reactions }) => {
            setMessages(prev => prev.map(m =>
                m._id === msgId ? { ...m, reactions } : m
            ));
        });
        socket.current.on('messageDeleted', (msgId) => {
            setMessages(prev => prev.filter(m => m._id !== msgId));
        });
    };

    const handleStatusUpdate = (status) => setIsActive(status.isActive);

    // Admin Controls
    const handleStartGD = async () => toggleGD(true);
    const handleStopGD = async () => toggleGD(false);

    const toggleGD = async (status) => {
        try {
            await fetch(`${BACKEND_URL}/api/gd/${id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: status })
            });
            setIsActive(status);
        } catch (e) { Alert.alert("Error"); }
    };

    const handleSummarize = async () => {
        setSummaryLoading(true);
        setSummaryModalVisible(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/gd/${id}/summarize`, { method: 'POST' });
            const data = await res.json();
            setSummaryText(data.summary || "No summary available.");
        } catch (e) {
            setSummaryText("Failed to generate summary.");
        } finally {
            setSummaryLoading(false);
        }
    };

    const sendMessage = () => {
        if (!text.trim() || !userId) return;
        const msgData = { sender: userId, groupId: id, content: text, type: 'text' };
        socket.current.emit('sendMessage', msgData);
        setText('');
    };

    const fetchUsers = async () => {
        // Fetch users for Info Modal
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/community/users`);
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data);
            }
        } catch (e) { }
    };

    if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}><ActivityIndicator color={theme.primary} /></View>;

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/gd')} style={{ marginRight: 15 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setInfoModalVisible(true); fetchUsers(); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <Ionicons name="chatbubbles" size={24} color={theme.textPrimary} />
                    </View>
                    <View>
                        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{name || 'Discussion'}</Text>
                        <Text style={{ color: isActive ? '#4CD964' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                            {isActive ? '● Live Discussion' : 'Closed'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {isAdmin && isActive && (
                    <TouchableOpacity onPress={handleStopGD} style={styles.actionPill}>
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>End</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleSummarize} style={[styles.actionPill, { backgroundColor: theme.secondary, marginLeft: 10 }]}>
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Summarize</Text>
                </TouchableOpacity>
            </View>

            {!isActive && !isAdmin && (
                <View style={styles.banner}>
                    <Text style={{ color: 'white', fontWeight: '600' }}>This discussion is currently closed.</Text>
                </View>
            )}

            {isAdmin && !isActive && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <TouchableOpacity style={styles.startBtn} onPress={handleStartGD}>
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Start Discussion</Text>
                    </TouchableOpacity>
                </View>
            )}

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} style={{ flex: 1 }}>
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item, index) => index.toString()}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    renderItem={({ item }) => {
                        const senderId = item.sender?._id || item.sender;
                        const isMe = senderId === userId;
                        const senderName = item.sender?.name || 'User';

                        return (
                            <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                                {!isMe && (
                                    <View style={[styles.avatar, { backgroundColor: theme.inputBg }]}>
                                        <Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>{senderName[0]}</Text>
                                    </View>
                                )}
                                <TouchableOpacity activeOpacity={0.8} onLongPress={() => handleLongPress(item)}>
                                    <View style={[styles.bubble, isMe ? [styles.bubbleMe, { backgroundColor: theme.primary }] : [styles.bubbleOther, { backgroundColor: theme.surface }]]}>
                                        {!isMe && <Text style={{ fontSize: 10, color: '#e65100', marginBottom: 2, fontWeight: 'bold' }}>{item.sender?.role === 'admin' ? 'Admin' : senderName}</Text>}
                                        <Text style={isMe ? { color: 'white' } : { color: theme.textPrimary }}>{item.content}</Text>

                                        {/* Reactions */}
                                        {item.reactions && item.reactions.length > 0 && (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, justifyContent: 'flex-end' }}>
                                                {item.reactions.map((r, i) => (
                                                    <View key={i} style={{ backgroundColor: theme.inputBg, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2, marginLeft: 2 }}>
                                                        <Text style={{ fontSize: 10 }}>{r.emoji}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    contentContainerStyle={{ padding: 15 }}
                />

                {isActive && (
                    <View style={styles.inputContainerWrapper}>
                        <View style={[styles.floatingInputBar, { backgroundColor: theme.surface }]}>
                            <TextInput
                                style={[styles.input, { color: theme.textPrimary }]}
                                value={text}
                                onChangeText={setText}
                                placeholder="Type a message..."
                                placeholderTextColor={theme.textLight}
                            />
                            <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: theme.primary }]}>
                                <Ionicons name="arrow-up" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Context Menu Modal */}
            <Modal transparent visible={contextMenuVisible} animationType="fade" onRequestClose={() => setContextMenuVisible(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setContextMenuVisible(false)} activeOpacity={1}>
                    <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20 }}>
                        {/* Reactions */}
                        <View style={{ flexDirection: 'row', backgroundColor: theme.surface || '#fff', borderRadius: 30, padding: 10, justifyContent: 'space-around', marginBottom: 15 }}>
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                <TouchableOpacity key={emoji} onPress={() => handleReaction(emoji)}>
                                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Actions Menu */}
                        <View style={{ backgroundColor: theme.surface || '#fff', borderRadius: 15, overflow: 'hidden' }}>
                            {[
                                { label: 'Reply', icon: 'arrow-undo', action: 'reply' },
                                { label: 'Copy', icon: 'copy', action: 'copy' },
                                { label: 'Info', icon: 'information-circle', action: 'info' },
                                { label: 'Delete', icon: 'trash', color: 'red', action: 'delete' },
                            ].map((item, index) => (
                                <TouchableOpacity
                                    key={item.label}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 15, justifyContent: 'space-between', borderBottomWidth: index < 3 ? StyleSheet.hairlineWidth : 0, borderBottomColor: '#ccc' }}
                                    onPress={() => handleAction(item.action)}
                                >
                                    <Text style={{ fontSize: 16, color: item.color || (theme.textPrimary || 'black') }}>{item.label}</Text>
                                    <Ionicons name={item.icon} size={20} color={item.color || (theme.textPrimary || 'black')} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Info Modal */}
            <Modal animationType="slide" transparent visible={infoModalVisible} onRequestClose={() => setInfoModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setInfoModalVisible(false)}>
                    <View style={[styles.bottomSheet, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Participants</Text>
                        <FlatList
                            data={allUsers}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                        <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>{item.name[0]}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>{item.name}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.role}</Text>
                                    </View>
                                </View>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Summary Modal */}
            <Modal animationType="fade" transparent visible={summaryModalVisible} onRequestClose={() => setSummaryModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.bottomSheet, { backgroundColor: theme.surface, height: '60%' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[styles.sheetTitle, { color: theme.textPrimary, marginBottom: 0 }]}>Discussion Summary</Text>
                            <TouchableOpacity onPress={() => setSummaryModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        {summaryLoading ? (
                            <ActivityIndicator size="large" color={theme.primary} />
                        ) : (
                            <ScrollView><Text style={{ color: theme.textPrimary, fontSize: 16, lineHeight: 24 }}>{summaryText}</Text></ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
    headerTitle: { fontSize: 18, fontWeight: ' bold' },
    actionPill: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    banner: { backgroundColor: '#FF9500', padding: 10, alignItems: 'center' },
    startBtn: { backgroundColor: '#4CD964', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },

    // Chat
    msgRow: { flexDirection: 'row', marginBottom: 2, width: '100%' },
    avatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2 },
    bubble: {
        maxWidth: '75%',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    bubbleMe: {
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        borderBottomLeftRadius: 4,
    },

    // Input
    inputContainerWrapper: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        paddingTop: 10
    },
    floatingInputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 30,
        paddingVertical: 8,
        paddingHorizontal: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 5
    },
    input: { flex: 1, maxHeight: 100, fontSize: 16, marginHorizontal: 10 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '50%' },
    sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 }
});
