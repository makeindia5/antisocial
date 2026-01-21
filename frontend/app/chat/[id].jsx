import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ImageBackground, StyleSheet, StatusBar, Keyboard, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';

import { useTheme } from '../../src/context/ThemeContext';
import { Colors } from '../../src/styles/theme';

const BACKEND_URL = "http://192.168.29.129:5000";

export default function ChatScreen() {
    const { colors, toggleTheme } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const { id, name } = useLocalSearchParams();
    const router = useRouter();
    const [myId, setMyId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const socket = useRef(null);

    // Summary States
    const [summaryModalVisible, setSummaryModalVisible] = useState(false);
    const [summaryText, setSummaryText] = useState('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [customSummaryVisible, setCustomSummaryVisible] = useState(false);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false); // New Menu State
    const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false); // Attachment Menu
    const [uploading, setUploading] = useState(false);

    // Profile State
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(false); // Online Status State

    const flatListRef = useRef(null);

    useEffect(() => {
        AsyncStorage.getItem("userId").then(setMyId);
    }, []);

    useEffect(() => {
        if (!myId || !id) return;
        fetch(`${BACKEND_URL}/api/auth/messages/${myId}/${id}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setMessages(data);
            })
            .catch(console.error);
    }, [myId, id]);

    useEffect(() => {
        if (!myId) return;
        socket.current = io(BACKEND_URL);

        socket.current.on('connect', () => {
            console.log("Connected to socket");
            socket.current.emit('join', myId);

            // Check initial online status of the chat partner
            socket.current.emit('checkOnlineStatus', id, (status) => {
                setIsOnline(status);
            });
        });

        socket.current.on('userOnline', (userId) => {
            if (userId === id) setIsOnline(true);
        });

        socket.current.on('userOffline', (userId) => {
            if (userId === id) setIsOnline(false);
        });

        socket.current.on('receiveMessage', (msg) => {
            if (msg.sender === id || msg.recipient === id) {
                setMessages((prev) => [...prev, msg]);
                // If I am the recipient and I am ON this screen, mark as read immediately
                if (msg.sender === id) {
                    socket.current.emit('markAsRead', { msgId: msg._id, userId: myId });
                }
            }
        });

        socket.current.on('messageStatusUpdate', ({ msgId, status }) => {
            setMessages(prev => prev.map(m =>
                m._id === msgId ? { ...m, status } : m
            ));
        });

        socket.current.on('messageDeleted', (msgId) => {
            setMessages((prev) => prev.filter((msg) => msg._id !== msgId));
        });

        return () => socket.current.disconnect();
    }, [myId, id]);

    // Mark existing unread messages as read when entering screen
    useEffect(() => {
        if (messages.length > 0 && myId) {
            messages.forEach(msg => {
                if (msg.sender === id && msg.recipient === myId && msg.status !== 'read') {
                    socket.current?.emit('markAsRead', { msgId: msg._id, userId: myId });
                }
            });
        }
    }, [messages.length, myId, id]);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => {
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        );

        return () => {
            keyboardDidShowListener.remove();
        };
    }, []);

    const renderTicks = (item) => {
        if (item.sender !== myId && item.sender?._id !== myId) return null;

        const status = item.status || 'sent'; // default to sent
        let iconName = "checkmark";
        let color = "#BDC3C7"; // Grey

        if (status === 'delivered') {
            iconName = "checkmark-done"; // double check
        } else if (status === 'read') {
            iconName = "checkmark-done";
            color = "#34B7F1"; // Blue
        }

        return <Ionicons name={iconName} size={16} color={color} style={{ marginLeft: 5 }} />;
    };



    const sendMessage = (type = 'text', content = text) => {
        if (!content && !text.trim()) return;

        const finalContent = content || text;

        const msgData = {
            sender: myId,
            recipient: id,
            content: finalContent,
            type: type
        };
        socket.current.emit('sendMessage', msgData);
        if (type === 'text') setText('');
    };

    const handleLongPress = (item) => {
        const senderId = typeof item.sender === 'object' ? item.sender._id : item.sender;
        if (senderId !== myId) return;

        Alert.alert(
            "Delete Message",
            "Are you sure you want to delete this message?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                        socket.current.emit('deleteMessage', { msgId: item._id, userId: myId });
                    }
                }
            ]
        );
    };

    const fetchSummary = async (useCustomRange = false) => {
        setCustomSummaryVisible(false);
        setSummaryLoading(true);
        setSummaryModalVisible(true);
        setSummaryText("Generating summary...");

        try {
            let url = `${BACKEND_URL}/api/auth/messages/summary/${myId}/${id}`;
            if (useCustomRange) {
                url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
            }

            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) {
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

    const handleDateChange = (event, selectedDate, type) => {
        if (type === 'start') {
            setShowStartPicker(Platform.OS === 'ios');
            if (selectedDate) setStartDate(selectedDate);
        } else {
            setShowEndPicker(Platform.OS === 'ios');
            if (selectedDate) setEndDate(selectedDate);
        }
    };

    const handleMenuOption = async (option) => {
        setMenuVisible(false);
        if (option === 'profile') {
            setProfileLoading(true);
            setProfileModalVisible(true);
            try {
                const res = await fetch(`${BACKEND_URL}/api/auth/user/${id}`);
                const data = await res.json();
                if (res.ok) {
                    setProfileData(data);
                } else {
                    Alert.alert("Error", "Failed to fetch profile");
                    setProfileModalVisible(false);
                }
            } catch (e) {
                console.error(e);
                Alert.alert("Error", "Network error");
                setProfileModalVisible(false);
            } finally {
                setProfileLoading(false);
            }
        } else if (option === 'theme') {
            toggleTheme();
        } else if (option === 'mute') {
            Alert.alert("Mute", "Mute Notifications clicked");
        }
    };

    const handleAttachment = () => {
        setAttachmentMenuVisible(true);
    };

    const uploadFile = async (fileData, type) => {
        setAttachmentMenuVisible(false);
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: fileData.uri,
                name: fileData.name || 'file',
                type: fileData.mimeType || (type === 'image' ? 'image/jpeg' : 'application/octet-stream')
            });

            const res = await fetch(`${BACKEND_URL}/api/auth/upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const data = await res.json();
            if (res.ok) {
                // Determine type based on mime
                let msgType = 'document';
                if (fileData.mimeType?.startsWith('image/')) msgType = 'image';
                if (fileData.mimeType?.startsWith('video/')) msgType = 'video';

                sendMessage(msgType, data.url);
            } else {
                Alert.alert("Upload Failed", data.error);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const pickImage = async (camera = false) => {
        try {
            let result;
            if (camera) {
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.All,
                    quality: 0.8,
                });
            } else {
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.All,
                    quality: 0.8,
                });
            }

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                uploadFile({
                    uri: asset.uri,
                    name: asset.fileName || 'upload.jpg',
                    mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg' // Expo picker sometimes returns generic type
                }, asset.type === 'video' ? 'video' : 'image');
            }
        } catch (e) {
            console.log(e);
        }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true
            });

            if (result.assets && result.assets[0]) {
                const asset = result.assets[0];
                uploadFile({
                    uri: asset.uri,
                    name: asset.name,
                    mimeType: asset.mimeType
                }, 'document');
            }
        } catch (e) {
            console.log(e);
        }
    };

    const renderMessageContent = (item) => {
        if (item.type === 'image') {
            return (
                <View>
                    <Image source={{ uri: `${BACKEND_URL}${item.content}` }} style={{ width: 200, height: 200, borderRadius: 10 }} resizeMode="cover" />
                </View>
            );
        } else if (item.type === 'video') {
            return (
                <View>
                    <Video
                        source={{ uri: `${BACKEND_URL}${item.content}` }}
                        style={{ width: 200, height: 200, borderRadius: 10 }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                    />
                </View>
            );
        } else if (item.type === 'document') {
            return (
                <TouchableOpacity onPress={() => Linking.openURL(`${BACKEND_URL}${item.content}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="document-text" size={30} color={theme.textPrimary} />
                    <Text style={{ marginLeft: 10, color: theme.textPrimary, textDecorationLine: 'underline' }}>View Document</Text>
                </TouchableOpacity>
            );
        }
        return <Text style={(typeof item.sender === 'object' ? item.sender._id : item.sender) === myId ? styles.msgTextMe : styles.msgText}>{item.content}</Text>;
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

            {/* Creative Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={45} color="#fff" />
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>{name || "User"}</Text>
                    {isOnline ? (
                        <Text style={[styles.headerStatus, { color: '#2ECC71' }]}>Online</Text>
                    ) : (
                        <Text style={styles.headerStatus}>Offline</Text>
                    )}
                </View>
                <TouchableOpacity style={styles.callBtn}>
                    <Ionicons name="call" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={[styles.callBtn, { marginLeft: 10 }]}>
                    <Ionicons name="ellipsis-vertical" size={20} color="white" />
                </TouchableOpacity>
            </View>

            <ImageBackground
                source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }}
                style={{ flex: 1, backgroundColor: theme.background }} // Dynamic BG
                resizeMode="repeat"
                imageStyle={{ opacity: 0.1 }} // Fade the pattern in dark mode? Or generally?
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "padding"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 100}
                    style={{ flex: 1 }}
                >
                    <FlatList
                        keyboardShouldPersistTaps="handled"
                        ref={flatListRef}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        data={messages}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onLongPress={() => handleLongPress(item)}
                                activeOpacity={0.8}
                                style={[
                                    styles.msgBubble,
                                    (typeof item.sender === 'object' ? item.sender._id : item.sender) === myId ? styles.msgMe : styles.msgOther
                                ]}
                            >
                                {renderMessageContent(item)}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 }}>
                                    <Text style={styles.timeText}>
                                        {item.createdAt
                                            ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        }
                                    </Text>
                                    {renderTicks(item)}
                                </View>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ paddingVertical: 10 }}
                    />
                    <View style={styles.inputContainer}>
                        <TouchableOpacity onPress={handleAttachment} style={styles.attachBtn}>
                            <Ionicons name="add" size={24} color={theme.textPrimary} />
                        </TouchableOpacity>
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
                </KeyboardAvoidingView>

                {/* Summary Modal */}
                <Modal animationType="slide" transparent={true} visible={summaryModalVisible} onRequestClose={() => setSummaryModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalView}>
                            <Text style={styles.modalTitle}>Conversation Summary</Text>
                            {summaryLoading ? (
                                <ActivityIndicator size="large" color={theme.secondary} style={{ marginVertical: 20 }} />
                            ) : (
                                <ScrollView style={{ maxHeight: 300 }}>
                                    <Text style={styles.summaryText}>{summaryText}</Text>
                                </ScrollView>
                            )}
                            <TouchableOpacity onPress={() => setSummaryModalVisible(false)} style={styles.closeBtn}>
                                <Text style={styles.btnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Custom Range Modal */}
                <Modal animationType="fade" transparent={true} visible={customSummaryVisible} onRequestClose={() => setCustomSummaryVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalView}>
                            <Text style={styles.modalTitle}>Select Summary Range</Text>

                            <Text style={{ color: theme.textSecondary, marginBottom: 5 }}>Start Time:</Text>
                            <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[styles.input, { justifyContent: 'center', backgroundColor: theme.inputBg, flex: 0 }]}>
                                <Text style={{ color: theme.textPrimary }}>{startDate.toLocaleString()}</Text>
                            </TouchableOpacity>
                            {showStartPicker && (
                                <DateTimePicker value={startDate} mode="datetime" display="default" onChange={(e, d) => handleDateChange(e, d, 'start')} />
                            )}

                            <Text style={{ color: theme.textSecondary, marginBottom: 5, marginTop: 15 }}>End Time:</Text>
                            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={[styles.input, { justifyContent: 'center', backgroundColor: theme.inputBg, flex: 0 }]}>
                                <Text style={{ color: theme.textPrimary }}>{endDate.toLocaleString()}</Text>
                            </TouchableOpacity>
                            {showEndPicker && (
                                <DateTimePicker value={endDate} mode="datetime" display="default" onChange={(e, d) => handleDateChange(e, d, 'end')} />
                            )}

                            <TouchableOpacity onPress={() => fetchSummary(true)} style={[styles.fullWidthBtn, { marginTop: 20 }]}>
                                <Text style={styles.btnText}>Generate Summary</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => fetchSummary(false)} style={{ marginTop: 15, alignItems: 'center' }}>
                                <Text style={{ color: theme.secondary }}>Or Summarize Last 50 Messages</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setCustomSummaryVisible(false)} style={{ marginTop: 15, alignItems: 'center' }}>
                                <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* MENU MODAL */}
                <Modal transparent={true} visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                    <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
                        <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
                            <TouchableOpacity onPress={() => handleMenuOption('profile')} style={styles.menuItem}>
                                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleMenuOption('theme')} style={styles.menuItem}>
                                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Chat Theme</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleMenuOption('mute')} style={styles.menuItem}>
                                <Text style={[styles.menuText, { color: theme.textPrimary }]}>Mute Notification</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
                {/* ATTACHMENT MODAL */}
                <Modal transparent={true} visible={attachmentMenuVisible} animationType="fade" onRequestClose={() => setAttachmentMenuVisible(false)}>
                    <TouchableOpacity style={styles.menuOverlay} onPress={() => setAttachmentMenuVisible(false)}>
                        <View style={[styles.attachmentContainer, { backgroundColor: theme.surface }]}>
                            <TouchableOpacity onPress={() => pickDocument()} style={styles.attachmentItem}>
                                <View style={[styles.iconCircle, { backgroundColor: '#7F8C8D' }]}>
                                    <Ionicons name="document" size={24} color="white" />
                                </View>
                                <Text style={[styles.attachmentText, { color: theme.textPrimary }]}>Document</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => pickImage(false)} style={styles.attachmentItem}>
                                <View style={[styles.iconCircle, { backgroundColor: '#D35400' }]}>
                                    <Ionicons name="camera" size={24} color="white" />
                                </View>
                                <Text style={[styles.attachmentText, { color: theme.textPrimary }]}>Camera/Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Uploading Indicator */}
                {uploading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={theme.secondary} />
                        <Text style={{ color: 'white', marginTop: 10 }}>Uploading...</Text>
                    </View>
                )}

                {/* PROFILE MODAL */}
                <Modal animationType="slide" transparent={true} visible={profileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.profileModalView, { backgroundColor: theme.surface }]}>
                            {profileLoading ? (
                                <ActivityIndicator size="large" color={theme.secondary} />
                            ) : profileData ? (
                                <>
                                    <View style={styles.profileHeader}>
                                        <Image
                                            source={{ uri: profileData.profilePic ? `${BACKEND_URL}${profileData.profilePic}` : 'https://via.placeholder.com/150' }}
                                            style={styles.profileImageLarge}
                                        />
                                        <Text style={[styles.profileName, { color: theme.textPrimary }]}>{profileData.name}</Text>
                                        <Text style={[styles.profilePhone, { color: theme.textSecondary }]}>
                                            {profileData.isNumberHidden ? "Phone Hidden" : profileData.phoneNumber || "No phone number"}
                                        </Text>
                                    </View>
                                    <View style={[styles.profileSection, { borderTopColor: theme.border }]}>
                                        <Text style={[styles.sectionTitle, { color: theme.secondary }]}>About</Text>
                                        <Text style={[styles.profileBio, { color: theme.textPrimary }]}>{profileData.bio || "Available"}</Text>
                                    </View>
                                    <View style={[styles.profileSection, { borderTopColor: theme.border }]}>
                                        <Text style={[styles.sectionTitle, { color: theme.secondary }]}>Email</Text>
                                        <Text style={[styles.profileBio, { color: theme.textPrimary }]}>{profileData.email}</Text>
                                    </View>
                                </>
                            ) : (
                                <Text style={{ color: theme.textPrimary }}>User not found</Text>
                            )}
                            <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={styles.closeBtn}>
                                <Text style={styles.btnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </ImageBackground >
        </SafeAreaView >
    );
}

const getStyles = (Colors) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary, // Hike Blue
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primaryLight,
        elevation: 4,
        zIndex: 10 // Ensure header stays on top if needed
    },
    backBtn: { marginRight: 15 },
    avatarContainer: { position: 'relative' },
    // onlineDot removed
    headerInfo: { flex: 1, marginLeft: 10 },
    headerTitle: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
    headerStatus: { color: Colors.textLight, fontSize: 12 },
    callBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
    msgBubble: {
        marginHorizontal: 15,
        marginVertical: 5,
        padding: 12,
        borderRadius: 15,
        maxWidth: '75%',
        elevation: 1
    },
    msgMe: { alignSelf: 'flex-end', backgroundColor: Colors.secondary, borderBottomRightRadius: 2 },
    msgOther: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderBottomLeftRadius: 2 },
    msgText: { fontSize: 16, color: Colors.textPrimary },
    // For "Me", text should be white
    msgTextMe: { fontSize: 16, color: Colors.white },

    timeText: { fontSize: 10, color: Colors.white, alignSelf: 'flex-end', marginTop: 5, opacity: 0.8 },
    inputContainer: { flexDirection: 'row', padding: 10, alignItems: 'center', backgroundColor: Colors.surface },
    attachBtn: { marginRight: 10, padding: 5 },
    input: {
        flex: 1,
        backgroundColor: Colors.inputBg,
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginRight: 10,
        elevation: 1,
        color: Colors.textPrimary
    },
    sendBtn: {
        backgroundColor: Colors.secondary,
        padding: 12,
        borderRadius: 25,
        elevation: 2,
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalView: { width: '85%', backgroundColor: Colors.surface, borderRadius: 20, padding: 25, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: Colors.textPrimary, textAlign: 'center' },
    summaryText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },
    closeBtn: { marginTop: 20, backgroundColor: Colors.secondary, padding: 12, borderRadius: 10, alignItems: 'center' },
    btnText: { color: 'white', fontWeight: 'bold' },
    fullWidthBtn: { backgroundColor: Colors.secondary, padding: 15, borderRadius: 10, alignItems: 'center', width: '100%' },

    // Menu Styles
    menuOverlay: { flex: 1, backgroundColor: 'transparent' }, // Transparent to allow clicking outside
    menuContainer: {
        position: 'absolute',
        top: 60, // Adjust based on header height
        right: 15,
        width: 180,
        borderRadius: 8,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        paddingVertical: 5
    },
    menuItem: { paddingVertical: 12, paddingHorizontal: 15 },
    menuText: { fontSize: 16 },

    // Attachment Menu
    attachmentContainer: {
        position: 'absolute',
        bottom: 80, // Above input bar
        left: 20,
        backgroundColor: Colors.surface,
        borderRadius: 15,
        padding: 15,
        elevation: 10,
        width: 200
    },
    attachmentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    attachmentText: { fontSize: 16, fontWeight: '500' },
    loadingOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center'
    },
    // Profile Modal
    profileModalView: { width: '85%', borderRadius: 20, padding: 25, elevation: 5, alignItems: 'center' },
    profileImageLarge: { width: 120, height: 120, borderRadius: 60, marginBottom: 15 },
    profileHeader: { alignItems: 'center', marginBottom: 20 },
    profileName: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
    profilePhone: { fontSize: 16 },
    profileSection: { width: '100%', borderTopWidth: 1, paddingVertical: 15 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
    profileBio: { fontSize: 16 }
});
