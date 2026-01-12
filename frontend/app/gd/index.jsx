import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Keyboard, Modal, ScrollView } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { Colors, GlobalStyles } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';

const BACKEND_URL = "http://192.168.29.129:5000";

export default function GroupDiscussionScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState(null);
    const [isActive, setIsActive] = useState(false);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);

    // Summary States
    const [summaryModalVisible, setSummaryModalVisible] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);

    // Member Info States
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [allUsers, setAllUsers] = useState([]);

    const socket = useRef(null);
    const flatListRef = useRef(null);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                if (flatListRef.current) {
                    setTimeout(() => flatListRef.current.scrollToEnd({ animated: true }), 100);
                }
            }
        );
        return () => {
            keyboardDidShowListener.remove();
        };
    }, []);

    useEffect(() => {
        // Update Last Read on Entry
        AsyncStorage.setItem('lastReadGD', new Date().toISOString());

        checkUserRole();
        fetchStatus();
        fetchHistory();
        setupSocket();

        return () => {
            if (socket.current) socket.current.disconnect();
            // Update Last Read Timestamp on Exit
            AsyncStorage.setItem('lastReadGD', new Date().toISOString());
        };
    }, []);

    const checkUserRole = async () => {
        try {
            const storedUserId = await AsyncStorage.getItem("userId");
            setUserId(storedUserId);
            if (storedUserId) {
                const res = await fetch(`${BACKEND_URL}/api/auth/admin-id`);
                const data = await res.json();
                if (data.adminId === storedUserId) {
                    setIsAdmin(true);
                }
            }
        } catch (e) {
            console.error("Role check error:", e);
        }
    };

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/gd/status`);
            const data = await res.json();
            handleStatusUpdate(data);
            setLoading(false);
        } catch (e) {
            console.error("Fetch status error:", e);
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/gd/messages`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setMessages(data);
            }
        } catch (e) {
            console.error("Fetch history error:", e);
        }
    };

    const fetchSummary = async () => {
        setSummaryLoading(true);
        setSummaryModalVisible(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/gd/summary`);
            if (res.ok) {
                const data = await res.json();
                setSummaryText(data.summary);
            } else {
                setSummaryText("Failed to generate summary.");
            }
        } catch (e) {
            setSummaryText("Error connecting to server.");
        } finally {
            setSummaryLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/community/users`);
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data);
            }
        } catch (e) {
            console.error("Fetch users error", e);
        }
    };

    const setupSocket = () => {
        socket.current = io(BACKEND_URL);

        socket.current.on('connect', () => {
            console.log("Connected to socket");
            socket.current.emit('joinGD');
        });

        socket.current.on('gdStatusUpdate', (status) => {
            handleStatusUpdate(status);
        });

        socket.current.on('receiveMessage', (msg) => {
            setMessages((prev) => [...prev, msg]);
        });
    };

    const handleStatusUpdate = (status) => {
        setIsActive(status.isActive);
    };

    const handleStartGD = async () => {
        try {
            await fetch(`${BACKEND_URL}/api/admin/gd/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: true }) // No duration sent
            });
        } catch (e) {
            Alert.alert("Error", "Failed to start GD");
        }
    };

    const handleStopGD = async () => {
        try {
            await fetch(`${BACKEND_URL}/api/admin/gd/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: false })
            });
        } catch (e) {
            Alert.alert("Error", "Failed to stop GD");
        }
    };

    const sendMessage = () => {
        if (!text.trim() || !userId) return;
        const msgData = {
            sender: userId,
            groupId: 'finance-gd',
            content: text,
            type: 'text'
        };
        socket.current.emit('sendMessage', msgData);
        setText('');
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color={theme.secondary} /></View>;
    }

    return (
        <View style={{ flex: 1, backgroundColor: styles.container.backgroundColor }}>
            <View style={styles.header}>
                {/* Back Button Removed */}


                {/* Clickable Header for Info */}
                <TouchableOpacity onPress={() => { setInfoModalVisible(true); fetchUsers(); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.headerText}>Group Discussion</Text>
                    <View style={[styles.statusBadge, { backgroundColor: isActive ? '#4caf50' : '#d32f2f' }]}>
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{isActive ? 'LIVE' : 'OFF'}</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.headerActions}>
                    {isAdmin && isActive && (
                        <TouchableOpacity onPress={handleStopGD} style={styles.btnStopHeader}>
                            <Text style={styles.btnEndText}>End</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={fetchSummary} style={styles.btnSummaryHeader}>
                        <Ionicons name="newspaper-outline" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            {isAdmin && !isActive && (
                <View style={styles.adminPanel}>
                    <Text style={styles.adminTitle}>Start Discussion</Text>
                    <TouchableOpacity style={styles.btnStart} onPress={handleStartGD}>
                        <Text style={styles.btnText}>Open Discussion Now</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!isActive && !isAdmin && (
                <View style={styles.statusContainer}>
                    <Text style={styles.closedText}>Discussion is Closed</Text>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                style={{ flex: 1 }}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item, index) => index.toString()}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    renderItem={({ item }) => {
                        const senderId = item.sender?._id || item.sender;
                        const isMe = senderId === userId;
                        let senderName = item.sender?.name || 'User';
                        if (item.sender?.role === 'admin') senderName = 'Admin';

                        let avatarUri = null;
                        if (item.sender?.profilePic) {
                            let picPath = item.sender.profilePic.replace(/\\/g, '/');
                            if (!picPath.startsWith('http')) {
                                if (picPath.startsWith('/')) picPath = picPath.substring(1);
                                avatarUri = `http://192.168.29.129:5000/${picPath}`;
                            } else {
                                avatarUri = picPath;
                            }
                        }

                        return (
                            <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                                {!isMe && <Avatar uri={avatarUri} name={senderName} styles={styles} />}
                                <View style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgOther]}>
                                    {!isMe && (
                                        <Text style={[styles.senderName, item.sender?.role === 'admin' ? { color: '#d32f2f' } : {}]}>
                                            {senderName}
                                        </Text>
                                    )}
                                    <Text style={isMe ? styles.msgTextMe : styles.msgTextOther}>{item.content}</Text>
                                    <Text style={[styles.msgTime, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: theme.textSecondary }]}>
                                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                            </View>
                        );
                    }}
                    contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
                />

                {isActive ? (
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.msgInput}
                            value={text}
                            onChangeText={setText}
                            placeholder="Type a message..."
                            placeholderTextColor={theme.textLight}
                        />
                        <TouchableOpacity onPress={sendMessage}>
                            <Ionicons name="send" size={24} color={theme.secondary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.closedInputBox}>
                        <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={{ marginRight: 8 }} />
                        <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>Discussion is closed.</Text>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Application Summary Modal */}
            <Modal animationType="slide" transparent={true} visible={summaryModalVisible} onRequestClose={() => setSummaryModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalView}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Discussion Summary</Text>
                            <TouchableOpacity onPress={() => setSummaryModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        {summaryLoading ? (
                            <ActivityIndicator size="large" color={theme.secondary} style={{ marginVertical: 20 }} />
                        ) : (
                            <ScrollView style={{ maxHeight: 300 }}>
                                <Text style={styles.summaryText}>{summaryText}</Text>
                            </ScrollView>
                        )}
                        <TouchableOpacity onPress={() => setSummaryModalVisible(false)} style={[GlobalStyles.button, { marginTop: 20 }]}>
                            <Text style={GlobalStyles.buttonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Member List Modal caused by header tap */}
            <Modal animationType="slide" transparent={true} visible={infoModalVisible} onRequestClose={() => setInfoModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalView, { height: '60%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Community Members</Text>
                            <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={allUsers}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                    {item.profilePic ? (
                                        <Image source={{ uri: `${BACKEND_URL}${item.profilePic}` }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
                                    ) : (
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                            <Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>{item.name ? item.name[0].toUpperCase() : '?'}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>{item.name}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.role}</Text>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={<ActivityIndicator size="small" color={theme.secondary} />}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const Avatar = ({ uri, name, styles }) => {
    const [error, setError] = useState(false);
    if (uri && !error) {
        return <Image source={{ uri }} style={styles.avatar} onError={() => setError(true)} />;
    }
    return (
        <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{name ? name[0].toUpperCase() : '?'}</Text>
        </View>
    );
};

function getStyles(theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { backgroundColor: theme.primary, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
        headerText: { color: theme.white, fontSize: 20, fontWeight: 'bold' },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        statusContainer: { padding: 10, alignItems: 'center', backgroundColor: theme.inputBg },
        statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 10 },
        closedText: { color: theme.primary, fontWeight: 'bold' },
        adminPanel: { padding: 15, backgroundColor: theme.surface, margin: 10, borderRadius: 10, elevation: 3, alignItems: 'center' },
        adminTitle: { fontWeight: 'bold', marginBottom: 10, color: theme.textPrimary },
        btnStart: { backgroundColor: theme.secondary, padding: 12, borderRadius: 25, width: '80%', alignItems: 'center' },
        btnText: { color: theme.white, fontWeight: 'bold', fontSize: 16 },
        msgBubble: { padding: 10, borderRadius: 10, marginBottom: 10, maxWidth: '80%' },
        msgMe: { alignSelf: 'flex-end', backgroundColor: theme.secondary },
        msgOther: { alignSelf: 'flex-start', backgroundColor: theme.surface },
        msgTextMe: { color: theme.white },
        msgTextOther: { color: theme.textPrimary },
        inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: theme.surface, alignItems: 'center' },
        msgInput: { flex: 1, backgroundColor: theme.inputBg, borderRadius: 20, padding: 10, marginRight: 10, color: theme.textPrimary },
        headerActions: { position: 'absolute', right: 15, flexDirection: 'row', alignItems: 'center' },
        btnSummaryHeader: { padding: 5, marginLeft: 10 },
        btnStopHeader: { backgroundColor: '#d32f2f', paddingVertical: 5, paddingHorizontal: 15, borderRadius: 20 },
        msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
        avatar: { width: 35, height: 35, borderRadius: 17.5, marginRight: 8, backgroundColor: theme.inputBg },
        avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.secondary },
        avatarText: { color: theme.white, fontWeight: 'bold', fontSize: 14 },
        senderName: { fontSize: 10, color: '#e65100', fontWeight: 'bold', marginBottom: 2 },
        msgTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
        closedInputBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, backgroundColor: theme.inputBg, borderTopWidth: 1, borderTopColor: theme.border },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
        modalView: { backgroundColor: theme.surface, borderRadius: 20, padding: 25, elevation: 5 },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.textPrimary },
        summaryText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 }
    });
}
