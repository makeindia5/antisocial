import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ImageBackground, StyleSheet, StatusBar, Keyboard, Alert, Modal, ScrollView, ActivityIndicator, Image, Linking, Animated } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../src/context/ThemeContext';
import { useSocket } from '../../src/context/SocketContext';
import { Colors } from '../../src/styles/theme';

const BACKEND_URL = "http://192.168.29.129:5000";

const formatDateLabel = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    if (now.getDate() === date.getDate() && now.getMonth() === date.getMonth() && now.getFullYear() === date.getFullYear()) return "Today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.getDate() === date.getDate() && yesterday.getMonth() === date.getMonth() && yesterday.getFullYear() === date.getFullYear()) return "Yesterday";

    return date.toLocaleDateString();
};

const processMessagesWithDates = (messages) => {
    const processed = [];
    let lastDate = null;

    messages.forEach(msg => {
        const dateLabel = formatDateLabel(msg.createdAt || Date.now());
        if (dateLabel !== lastDate) {
            processed.push({ type: 'date_header', content: dateLabel, _id: `date-${dateLabel}-${processed.length}` });
            lastDate = dateLabel;
        }
        processed.push(msg);
    });
    return processed;
};

export default function ChatScreen() {
    const { colors: theme, toggleTheme } = useTheme();
    const { socket, onlineUsers, markAsRead } = useSocket();

    const { id, name, profilePic, isAdminSupport, mode } = useLocalSearchParams();
    const isSocial = mode === 'social';

    const router = useRouter();
    const [myId, setMyId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const isOnline = onlineUsers.has(String(id));

    const [menuVisible, setMenuVisible] = useState(false);
    const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [wallpaper, setWallpaper] = useState(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerData, setViewerData] = useState(null);
    const [viewerMenuVisible, setViewerMenuVisible] = useState(false);
    const [viewerRotation, setViewerRotation] = useState(0);
    const [userData, setUserData] = useState(null); // Recipient data
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
    const inputRef = useRef(null);
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (attachmentMenuVisible) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true
            }).start();
        } else {
            scaleAnim.setValue(0);
        }
    }, [attachmentMenuVisible]);

    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);

    // Forwarding State
    const [forwardModalVisible, setForwardModalVisible] = useState(false);
    const [forwardUsers, setForwardUsers] = useState([]);
    const [selectedForwardUsers, setSelectedForwardUsers] = useState(new Set());
    const [forwardLoading, setForwardLoading] = useState(false);

    const fetchForwardUsers = async () => {
        setForwardLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/community/users`);
            const data = await res.json();
            setForwardUsers(data.filter(u => String(u._id) !== String(myId)));
        } catch (e) { Alert.alert("Error", "Failed to load contacts"); }
        finally { setForwardLoading(false); }
    };

    const toggleForwardSelection = (user) => {
        const newSet = new Set(selectedForwardUsers);
        if (newSet.has(user._id)) {
            newSet.delete(user._id);
        } else {
            newSet.add(user._id);
        }
        setSelectedForwardUsers(newSet);
    };

    const handleForwardMessage = () => {
        if (!selectedMessage || selectedForwardUsers.size === 0) return;

        selectedForwardUsers.forEach(recipientId => {
            const msgData = {
                sender: myId,
                recipient: recipientId,
                content: selectedMessage.content,
                type: selectedMessage.type
            };
            socket.emit('sendMessage', msgData);
        });

        const count = selectedForwardUsers.size;
        setForwardModalVisible(false);
        setSelectedForwardUsers(new Set());
        setSelectedMessage(null);
        Alert.alert("Success", `Forwarded to ${count} chat${count > 1 ? 's' : ''}`);
    };

    const handleLongPress = (msg) => {
        setSelectedMessage(msg);
        setContextMenuVisible(true);
    };

    const handleReaction = (emoji) => {
        if (!selectedMessage) return;
        socket.emit('addReaction', { msgId: selectedMessage._id, emoji, userId: myId });
        setContextMenuVisible(false);
    };

    const handleAction = async (action) => {
        setContextMenuVisible(false);
        if (!selectedMessage) return;

        switch (action) {
            case 'reply':
                setReplyToMessage(selectedMessage);
                setTimeout(() => inputRef.current?.focus(), 200);
                break;
            case 'copy':
                await Clipboard.setStringAsync(selectedMessage.content || "");
                break;
            case 'delete': {
                const senderId = String(selectedMessage?.sender?._id || selectedMessage?.sender);
                const isMe = senderId === String(myId);

                const options = [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete for me",
                        onPress: () => {
                            socket.emit('deleteMessageForMe', { msgId: selectedMessage._id, userId: myId });
                            setMessages(prev => prev.filter(m => m._id !== selectedMessage._id));
                        }
                    }
                ];

                if (isMe) {
                    options.push({
                        text: "Delete for everyone",
                        style: "destructive",
                        onPress: () => {
                            socket.emit('deleteMessage', { msgId: selectedMessage._id, chatId: id });
                        }
                    });
                }

                Alert.alert("Delete Message", "Choose an option", options);
                break;
            }
            case 'forward':
                setForwardModalVisible(true);
                fetchForwardUsers();
                break;
            case 'star':
                try {
                    const sId = String(myId);
                    const isStarred = selectedMessage.starredBy?.some(id => String(id) === sId);
                    setMessages(prev => prev.map(m => {
                        if (m._id === selectedMessage._id) {
                            let updatedStarredBy = m.starredBy ? [...m.starredBy] : [];
                            if (isStarred) updatedStarredBy = updatedStarredBy.filter(id => String(id) !== sId);
                            else updatedStarredBy.push(sId);
                            return { ...m, starredBy: updatedStarredBy };
                        }
                        return m;
                    }));
                    await fetch(`${BACKEND_URL}/api/auth/message/star`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: myId, messageId: selectedMessage._id })
                    });
                } catch (e) { console.error("Star Error", e); }
                break;
            case 'info':
                Alert.alert("Message Info", `Sent: ${new Date(selectedMessage?.createdAt).toLocaleString()}`);
                break;
            case 'edit': {
                const senderId = String(selectedMessage?.sender?._id || selectedMessage?.sender);
                if (senderId === String(myId)) {
                    setText(selectedMessage?.content);
                    setEditingMessage(selectedMessage);
                    setTimeout(() => inputRef.current?.focus(), 200);
                } else {
                    Alert.alert("Error", "You can only edit your own messages");
                }
                break;
            }
        }
        if (action !== 'forward' && action !== 'edit') {
            setSelectedMessage(null);
        }
    };

    useEffect(() => {
        AsyncStorage.getItem(`chat_wallpaper_${id}`).then(setWallpaper);
    }, [id]);

    const pickWallpaper = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [9, 16],
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
                const uri = result.assets[0].uri;
                setWallpaper(uri);
                await AsyncStorage.setItem(`chat_wallpaper_${id}`, uri);
            }
        } catch (e) { Alert.alert("Error", "Could not set wallpaper"); }
    };

    // Profile State
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const flatListRef = useRef(null);

    useEffect(() => {
        AsyncStorage.getItem("userId").then(setMyId);
        if (id) {
            fetch(`${BACKEND_URL}/api/auth/user/${id}`)
                .then(res => res.json())
                .then(data => setUserData(data))
                .catch(err => console.error("Failed to fetch user details", err));
        }
    }, [id]);

    const formatLastSeen = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 0) return `last seen today at ${timeStr}`;
        if (diffDays === 1) return `last seen yesterday at ${timeStr}`;
        if (diffDays < 7) return `last seen ${date.toLocaleDateString([], { weekday: 'short' })} at ${timeStr}`;
        return `last seen on ${date.toLocaleDateString()}`;
    };

    useEffect(() => {
        if (!myId || !id) return;
        fetch(`${BACKEND_URL}/api/auth/messages/${myId}/${id}?myId=${myId}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setMessages(data);
            })
            .catch(console.error);
    }, [myId, id]);

    useEffect(() => {
        if (!myId || !id || !socket) return;
        const handleReceiveContent = (msg) => {
            console.log("Chat received message event:", msg);
            const senderId = String(msg.sender?._id || msg.sender);
            const recipientId = String(msg.recipient?._id || msg.recipient);
            const partnerId = String(id);

            if (senderId === partnerId || recipientId === partnerId) {
                setMessages((prev) => [...prev, msg]);
                if (senderId === partnerId) {
                    socket.emit('markAsRead', { msgId: msg._id, userId: myId });
                    markAsRead(partnerId);
                }
            }
        };

        socket.on('receiveMessage', handleReceiveContent);
        socket.on('messageStatusUpdate', ({ msgId, status }) => {
            setMessages(prev => prev.map(m => m._id === msgId ? { ...m, status } : m));
        });
        socket.on('messageReaction', ({ msgId, reactions }) => {
            setMessages(prev => prev.map(m => m._id === msgId ? { ...m, reactions } : m));
        });
        socket.on('messageEdited', ({ msgId, content }) => {
            setMessages(prev => prev.map(m => m._id === msgId ? { ...m, content, isEdited: true } : m));
        });
        socket.on('messageDeleted', (msgId) => {
            setMessages((prev) => prev.filter((msg) => msg._id !== msgId));
        });

        return () => {
            socket.off('receiveMessage', handleReceiveContent);
            socket.off('messageStatusUpdate');
            socket.off('messageReaction');
            socket.off('messageEdited');
            socket.off('messageDeleted');
        };
    }, [myId, id, socket]);

    useEffect(() => {
        if (messages.length > 0 && myId) {
            messages.forEach(msg => {
                if (msg.sender === id && msg.recipient === myId && msg.status !== 'read') {
                    socket?.emit('markAsRead', { msgId: msg._id, userId: myId });
                }
            });
        }
    }, [messages.length, myId, id]);

    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const results = messages
                .map((m, i) => ({ ...m, index: i }))
                .filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(m => m.index)
                .reverse();
            setSearchResults(results);
            setCurrentSearchIndex(results.length > 0 ? 0 : -1);
        } else {
            setSearchResults([]);
            setCurrentSearchIndex(-1);
        }
    }, [searchQuery, messages]);

    useEffect(() => {
        if (currentSearchIndex !== -1 && searchResults.length > 0) {
            flatListRef.current?.scrollToIndex({ index: searchResults[currentSearchIndex], animated: true, viewPosition: 0.5 });
        }
    }, [currentSearchIndex]);

    const handleNextSearch = () => {
        if (searchResults.length === 0) return;
        setCurrentSearchIndex(prev => (prev + 1) % searchResults.length);
    };

    const handlePrevSearch = () => {
        if (searchResults.length === 0) return;
        setCurrentSearchIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    };

    const renderTicks = (item) => {
        const itemSenderId = String(item.sender?._id || item.sender);
        if (itemSenderId !== String(myId)) return null;
        const status = item.status || 'sent';
        let iconName = "checkmark";
        let color = "rgba(255,255,255,0.6)";
        if (status === 'delivered') iconName = "checkmark-done";
        if (status === 'read') {
            iconName = "checkmark-done";
            color = "#FFF";
        }
        return <Ionicons name={iconName} size={16} color={color} style={{ marginLeft: 5 }} />;
    };

    // --- Message Filtering ---
    const filteredMessages = messages.filter(msg => {
        const isSocialMsg = msg.type === 'social_text' || msg.type === 'social_image';
        if (isSocial) return isSocialMsg;
        return !isSocialMsg; // Personal mode: hide social messages
    });

    // ... (existing effects)

    const sendMessage = (type = 'text', content = text) => {
        if (!content && !text.trim()) return;
        const finalContent = content || text;

        // ... (edit logic)

        // Adjust type for Social Mode
        let finalType = type;
        if (isSocial) {
            if (type === 'text') finalType = 'social_text';
            if (type === 'image') finalType = 'social_image';
        }

        const msgData = {
            sender: myId,
            recipient: id,
            content: finalContent,
            type: finalType,
            replyTo: replyToMessage?._id
        };
        socket.emit('sendMessage', msgData);
        if (type === 'text') {
            setText('');
            setReplyToMessage(null);
        }
    };

    // ... (render logic)

    const downloadViewerImage = async () => {
        if (!viewerImage) return null;
        try {
            const fileUri = FileSystem.cacheDirectory + viewerImage.split('/').pop();
            const { uri } = await FileSystem.downloadAsync(`${BACKEND_URL}${viewerImage}`, fileUri);
            return uri;
        } catch (e) {
            Alert.alert("Error", "Could not process image");
            return null;
        }
    };

    const handleShare = async () => {
        const uri = await downloadViewerImage();
        if (uri) await Sharing.shareAsync(uri);
    };

    const handleSave = async () => {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') return Alert.alert("Error", "Permission required to save photos");
        const uri = await downloadViewerImage();
        if (uri) {
            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert("Success", "Saved to Gallery!");
        }
    };

    const handleDeleteFromViewer = () => {
        Alert.alert("Delete", "Delete this message?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: () => {
                    socket.emit('deleteMessage', { msgId: viewerData._id, userId: myId });
                    setViewerVisible(false);
                }
            }
        ]);
    };

    const handleReplyFromViewer = () => {
        setReplyToMessage(viewerData);
        setViewerVisible(false);
        setTimeout(() => inputRef.current?.focus(), 500);
    };

    const uploadFile = async (fileData, type) => {
        setAttachmentMenuVisible(false);
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', { uri: fileData.uri, name: fileData.name || 'file', type: fileData.mimeType || 'application/octet-stream' });
            const res = await fetch(`${BACKEND_URL}/api/auth/upload`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = await res.json();
            if (res.ok) {
                let msgType = 'document';
                if (fileData.mimeType?.startsWith('image/')) msgType = 'image';
                if (fileData.mimeType?.startsWith('video/')) msgType = 'video';
                sendMessage(msgType, data.url);
            } else Alert.alert("Failed", data.error);
        } catch (e) { Alert.alert("Error", "Upload failed"); }
        finally { setUploading(false); }
    };

    const pickImage = async (camera = false) => {
        try {
            let result;
            if (camera) result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
            else result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                uploadFile({ uri: asset.uri, name: asset.fileName || 'upload.jpg', mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg' }, asset.type === 'video' ? 'video' : 'image');
            }
        } catch (e) { console.log(e); }
    };

    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.assets && result.assets[0]) {
                const asset = result.assets[0];
                uploadFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType }, 'document');
            }
        } catch (e) { console.log(e); }
    };

    const handleLocationShare = async () => {
        setAttachmentMenuVisible(false);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return Alert.alert("Permission Denied", "Location permission is required to share location");

            const location = await Location.getCurrentPositionAsync({});
            const locationString = `${location.coords.latitude},${location.coords.longitude}`;
            sendMessage('location', locationString);
        } catch (e) {
            Alert.alert("Error", "Could not fetch location");
        }
    };

    const renderMessageContent = (item) => {
        if (item.type === 'location' || item.type === 'social_location') {
            const [lat, long] = item.content.split(',');
            const mapUrl = Platform.OS === 'ios' ? `http://maps.apple.com/?ll=${lat},${long}` : `https://www.google.com/maps/search/?api=1&query=${lat},${long}`;
            return (
                <TouchableOpacity onPress={() => Linking.openURL(mapUrl)} style={[styles.docBubble, { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 10 }]}>
                    <Ionicons name="location-sharp" size={24} color="#4CD964" />
                    <View style={{ marginLeft: 10 }}>
                        <Text style={{ fontWeight: 'bold', color: 'black' }}>Live Location</Text>
                        <Text style={{ fontSize: 10, color: '#666' }}>Tap to view on map</Text>
                    </View>
                </TouchableOpacity>
            );
        }
        if (item.type === 'image' || item.type === 'social_image') return (
            <TouchableOpacity onPress={() => { setViewerImage(item.content); setViewerData(item); setViewerRotation(0); setViewerVisible(true); }}>
                <Image source={{ uri: `${BACKEND_URL}${item.content}` }} style={styles.media} resizeMode="cover" />
            </TouchableOpacity>
        );
        if (item.type === 'video' || item.type === 'social_video') return <Video source={{ uri: `${BACKEND_URL}${item.content}` }} style={styles.media} useNativeControls resizeMode={ResizeMode.CONTAIN} />;
        if (item.type === 'document' || item.type === 'social_document') return (
            <TouchableOpacity onPress={() => Linking.openURL(`${BACKEND_URL}${item.content}`)} style={styles.docBubble}>
                <Ionicons name="document-text" size={24} color={theme.textPrimary} />
                <Text style={[styles.docText, { color: theme.textPrimary }]}>View File</Text>
            </TouchableOpacity>
        );
        if (item.type === 'call') {
            const isVideo = item.content === 'video';
            const roomName = `IntraaFinance_${id}_${myId}`;
            const link = `https://meet.jit.si/${roomName}`;

            return (
                <TouchableOpacity onPress={() => Linking.openURL(link)} style={[styles.docBubble, { backgroundColor: isVideo ? '#E3F2FD' : '#E8F5E9', padding: 10, borderRadius: 10 }]}>
                    <Ionicons name={isVideo ? "videocam" : "call"} size={24} color="black" />
                    <View style={{ marginLeft: 10 }}>
                        <Text style={{ fontWeight: 'bold', color: 'black' }}>{isVideo ? "Join Video Call" : "Join Voice Call"}</Text>
                        <Text style={{ fontSize: 10, color: '#666' }}>Tap to join</Text>
                    </View>
                </TouchableOpacity>
            );
        }
        const itemSenderId = String(item.sender?._id || item.sender);
        const isMe = itemSenderId === String(myId);

        if (!searchQuery || !item.content) return <Text style={isMe ? styles.msgTextMe : [styles.msgText, { color: isSocial ? (isMe ? 'white' : 'black') : theme.textPrimary }]}>{item.content}</Text>;

        const parts = item.content.split(new RegExp(`(${searchQuery})`, 'gi'));
        return (
            <View>
                <Text style={isMe ? styles.msgTextMe : [styles.msgText, { color: isSocial ? (isMe ? 'white' : 'black') : theme.textPrimary }]}>
                    {parts.map((part, i) => (
                        part.toLowerCase() === searchQuery.toLowerCase()
                            ? <Text key={i} style={{ backgroundColor: 'yellow', color: 'black' }}>{part}</Text>
                            : part
                    ))}
                </Text>
                {item.isEdited && (
                    <Text style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary, fontStyle: 'italic', alignSelf: 'flex-end', marginTop: 2 }}>
                        edited
                    </Text>
                )}
                {item.starredBy?.includes(myId) && (
                    <Ionicons name="star" size={12} color={isMe ? 'rgba(255,255,255,0.8)' : '#f1c40f'} style={{ alignSelf: 'flex-start', marginTop: 2 }} />
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isSocial ? 'white' : theme.background }} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle={isSocial ? "dark-content" : (theme.dark ? "light-content" : "dark-content")} backgroundColor={isSocial ? 'white' : (isAdminSupport === 'true' ? '#0061FF' : undefined)} />

            {/* Header */}
            {searchVisible ? (
                // ... (Search Header unchanged)
                <View style={[styles.header, { borderBottomColor: theme.border, alignItems: 'center' }]}>
                    {/* ... */}
                </View>
            ) : (
                <View style={[styles.header, {
                    borderBottomColor: isSocial ? '#eee' : theme.border,
                    backgroundColor: isSocial ? 'white' : (isAdminSupport === 'true' ? '#0061FF' : '#075E54'), // Green for Personal, White for Social
                    elevation: isSocial ? 1 : 4
                }]}>
                    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/communityScreen')} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={28} color={isSocial ? 'black' : "white"} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.headerInfo} onPress={() => setProfileModalVisible(true)}>
                        <View style={[styles.avatarContainer, { backgroundColor: theme.inputBg }]}>
                            {profilePic ? (
                                <Image source={{ uri: `${BACKEND_URL}${profilePic}` }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                            ) : (
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textSecondary }}>{name?.[0]}</Text>
                            )}
                        </View>
                        <View style={{ marginLeft: 10 }}>
                            <Text style={[styles.headerTitle, { color: isSocial ? 'black' : 'white' }]}>{name}</Text>
                            <Text style={[styles.headerStatus, { color: isSocial ? 'grey' : 'rgba(255,255,255,0.8)', fontSize: 12 }]}>
                                {isOnline ? 'Active Now' : (isAdminSupport === 'true' ? 'Offline' : (userData?.lastSeen ? formatLastSeen(userData.lastSeen) : 'Offline'))}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Social Icons (Black/Grey) vs Personal Icons (White) */}
                        <TouchableOpacity onPress={() => sendMessage('call', 'video')} style={[styles.menuBtn, { marginRight: 15 }]}>
                            <Ionicons name="videocam" size={24} color={isSocial ? 'black' : "white"} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => sendMessage('call', 'voice')} style={[styles.menuBtn, { marginRight: 15 }]}>
                            <Ionicons name="call" size={22} color={isSocial ? 'black' : "white"} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
                            <Ionicons name="information-circle-outline" size={26} color={isSocial ? 'black' : "white"} />
                        </TouchableOpacity>
                    </View>
                </View >
            )
            }

            <ImageBackground source={(!isSocial && wallpaper) ? { uri: wallpaper } : null} style={{ flex: 1, backgroundColor: isSocial ? 'white' : (wallpaper ? 'transparent' : theme.background) }} resizeMode="cover">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
                    {/* ... (Reply preview) */}

                    <FlatList
                        ref={flatListRef}
                        data={processMessagesWithDates(filteredMessages)}
                        keyExtractor={(item, index) => item._id || index.toString()}
                        contentContainerStyle={{ paddingTop: 15, paddingBottom: 20 }}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        style={{ flex: 1 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item, index }) => {
                            if (item.type === 'date_header') {
                                return (
                                    <View style={{ alignItems: 'center', marginVertical: 10 }}>
                                        <View style={{ backgroundColor: isSocial ? '#f0f0f0' : (theme.dark ? '#333' : '#e1f5fe'), paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                                            <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600' }}>{item.content}</Text>
                                        </View>
                                    </View>
                                );
                            }
                            const isMe = (typeof item.sender === 'object' ? item.sender._id : item.sender) === myId;

                            // Determine if we should use a Gradient (Social Mode + Sent by Me)
                            const UseGradient = isSocial && isMe;
                            const BubbleComponent = UseGradient ? LinearGradient : View;

                            const bubbleStyles = [
                                styles.bubble,
                                isMe
                                    ? [styles.bubbleMe, {
                                        // If not social (Personal), use Green/Blue. If Social (but View fallback), use Blue.
                                        backgroundColor: !UseGradient ? (isSocial ? '#0095F6' : (isAdminSupport === 'true' ? '#0061FF' : '#075E54')) : undefined,
                                        borderTopRightRadius: isSocial ? 20 : 0,
                                        borderBottomRightRadius: isSocial ? 4 : 20,
                                        borderRadius: 20
                                    }]
                                    : [styles.bubbleOther, {
                                        backgroundColor: isSocial ? '#efefef' : 'white',
                                        borderTopLeftRadius: isSocial ? 20 : 0,
                                        borderBottomLeftRadius: isSocial ? 4 : 20,
                                        borderRadius: 20
                                    }]
                            ];

                            const bubbleProps = UseGradient ? {
                                colors: ['#4FACFE', '#00F2FE'], // Nice Blue-Cyan Gradient
                                start: { x: 0, y: 0 },
                                end: { x: 1, y: 1 },
                                style: bubbleStyles
                            } : {
                                style: bubbleStyles
                            };

                            return (
                                <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleLongPress(item)} style={[
                                    styles.msgRow,
                                    isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }
                                ]}>
                                    <BubbleComponent {...bubbleProps}>
                                        {/* Content Render */}
                                        {renderMessageContent(item)}

                                        <View style={styles.metaRow}>
                                            <Text style={[styles.timeText, { color: isMe ? 'white' : '#777' }]}>
                                                {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                            {isMe && renderTicks(item)}
                                        </View>
                                    </BubbleComponent>
                                </TouchableOpacity>
                            );
                        }}
                    // ...
                    />

                    {/* Input Bar */}
                    <View style={[
                        styles.inputContainerWrapper,
                        {
                            backgroundColor: isSocial ? 'white' : 'transparent',
                            paddingBottom: 10,
                            borderTopWidth: isSocial ? 1 : 0,
                            borderTopColor: '#efefef'
                        }
                    ]}>
                        <View style={[
                            styles.floatingInputBar,
                            {
                                backgroundColor: isSocial ? '#f0f0f0' : (theme.dark ? '#1c1c1e' : 'white'),
                                borderRadius: 25,
                                marginHorizontal: 10,
                                paddingVertical: 5
                            }
                        ]}>
                            <TouchableOpacity
                                onPress={() => setAttachmentMenuVisible(true)}
                                style={[
                                    styles.iconBtn,
                                    {
                                        backgroundColor: isSocial ? 'white' : (theme.dark ? '#333' : '#e6f2f1'),
                                        width: 36, height: 36, borderRadius: 18,
                                        alignItems: 'center', justifyContent: 'center', marginLeft: 5
                                    }
                                ]}
                            >
                                <Ionicons name="add" size={24} color={isSocial ? 'black' : (theme.dark ? 'white' : '#075E54')} />
                            </TouchableOpacity>

                            <TextInput
                                ref={inputRef}
                                value={text}
                                onChangeText={setText}
                                style={[
                                    styles.input,
                                    {
                                        color: isSocial ? 'black' : theme.textPrimary,
                                        marginLeft: 10
                                    }
                                ]}
                                placeholder="Type a message..."
                                placeholderTextColor={isSocial ? '#999' : theme.textSecondary}
                                multiline
                            />

                            {text.length > 0 ? (
                                <TouchableOpacity
                                    onPress={() => sendMessage('text')}
                                    style={[
                                        styles.sendBtn,
                                        {
                                            backgroundColor: isSocial ? '#0095F6' : (isAdminSupport === 'true' ? '#0061FF' : '#075E54'),
                                            width: 36, height: 36, borderRadius: 18, marginLeft: 5
                                        }
                                    ]}
                                >
                                    <Ionicons name="arrow-up" size={20} color="white" />
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity style={styles.iconBtn} onPress={() => pickImage(true)}>
                                        <Ionicons name="camera-outline" size={24} color={isSocial ? 'black' : (theme.textSecondary || '#075E54')} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconBtn}>
                                        <Ionicons name="mic-outline" size={24} color={isSocial ? 'black' : (theme.textSecondary || '#075E54')} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>

                </KeyboardAvoidingView>
            </ImageBackground >

            {/* Modals reused (Style simplified) */}
            < Modal transparent visible={menuVisible} onRequestClose={() => setMenuVisible(false)
            } animationType="fade" >
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.menuDropdown, { backgroundColor: theme.surface }]}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setSearchVisible(true); }}>
                            <Text style={{ color: theme.textPrimary }}>Search</Text>
                        </TouchableOpacity>
                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 5 }} />

                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); pickWallpaper(); }}>
                            <Text style={{ color: theme.textPrimary }}>Wallpaper</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                            setMenuVisible(false);
                            Alert.alert("Confirm", "Are you sure you want to permanently clear this chat?", [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Clear", style: "destructive", onPress: async () => {
                                        try {
                                            const myId = await AsyncStorage.getItem("userId");
                                            await fetch(`${BACKEND_URL}/api/auth/messages/clear`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ user1: myId, user2: id })
                                            });
                                            setMessages([]);
                                            Alert.alert("Success", "Chat permanently deleted");
                                            router.back();
                                        } catch (e) {
                                            Alert.alert("Error", "Failed to clear chat");
                                        }
                                    }
                                }
                            ]);
                        }}>
                            <Text style={{ color: theme.textPrimary }}>Clear Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); Alert.alert("Block/Unblock", "This feature is coming soon."); }}>
                            <Text style={{ color: 'red' }}>Block User</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal >

            {/* Attachment Sheet */}
            {/* Animated Pop-Up Attachment Menu */}
            <Modal transparent visible={attachmentMenuVisible} animationType="fade" onRequestClose={() => setAttachmentMenuVisible(false)}>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setAttachmentMenuVisible(false)}
                >
                    <Animated.View style={[
                        styles.sheet,
                        {
                            backgroundColor: theme.surface,
                            transform: [{ scale: scaleAnim }],
                            borderRadius: 20,
                            padding: 20,
                            width: '90%',
                            alignSelf: 'center',
                            bottom: 100, // Move it up to look like a pop-up
                            position: 'absolute'
                        }
                    ]}>
                        <View style={styles.sheetRow}>
                            <TouchableOpacity style={styles.sheetItem} onPress={() => pickImage(false)}>
                                <View style={[styles.sheetIcon, { backgroundColor: '#4CD964' }]}><Ionicons name="images" size={24} color="white" /></View>
                                <Text style={[styles.sheetLabel, { color: theme.textPrimary }]}>Gallery</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sheetItem} onPress={() => pickImage(true)}>
                                <View style={[styles.sheetIcon, { backgroundColor: '#007AFF' }]}><Ionicons name="camera" size={24} color="white" /></View>
                                <Text style={[styles.sheetLabel, { color: theme.textPrimary }]}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sheetItem} onPress={handleLocationShare}>
                                <View style={[styles.sheetIcon, { backgroundColor: '#FF9500' }]}><Ionicons name="location" size={24} color="white" /></View>
                                <Text style={[styles.sheetLabel, { color: theme.textPrimary }]}>Location</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sheetItem} onPress={pickDocument}>
                                <View style={[styles.sheetIcon, { backgroundColor: '#5856D6' }]}><Ionicons name="document" size={24} color="white" /></View>
                                <Text style={[styles.sheetLabel, { color: theme.textPrimary }]}>File</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </TouchableOpacity>
            </Modal>

            {
                uploading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="white" />
                    </View>
                )
            }

            {/* Premium Center-Positioned Context Menu Modal */}
            <Modal transparent visible={contextMenuVisible} animationType="fade" onRequestClose={() => setContextMenuVisible(false)}>
                <TouchableOpacity
                    style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }]}
                    activeOpacity={1}
                    onPress={() => setContextMenuVisible(false)}
                >
                    <View style={{ width: '85%', alignSelf: 'center' }}>
                        {/* Selected Message Preview (Highlighted) */}
                        {selectedMessage && (
                            <View style={[
                                styles.bubble,
                                {
                                    backgroundColor: (selectedMessage?.sender && typeof selectedMessage.sender === 'object' ? selectedMessage.sender._id : selectedMessage.sender) === myId ? theme.primary : theme.surface,
                                    alignSelf: (selectedMessage?.sender && typeof selectedMessage.sender === 'object' ? selectedMessage.sender._id : selectedMessage.sender) === myId ? 'flex-end' : 'flex-start',
                                    marginBottom: 10,
                                    maxWidth: '100%'
                                }
                            ]}>
                                <Text style={{ color: (selectedMessage?.sender && typeof selectedMessage.sender === 'object' ? selectedMessage.sender._id : selectedMessage.sender) === myId ? 'white' : theme.textPrimary, fontSize: 16 }}>
                                    {selectedMessage?.content}
                                </Text>
                            </View>
                        )}

                        <View style={[styles.actionSheet, { backgroundColor: theme.surface, borderRadius: 20, paddingBottom: 20, paddingTop: 20 }]}>
                            {/* Reactions Row - More prominent */}
                            <View style={{ flexDirection: 'row', backgroundColor: theme.inputBg, borderRadius: 30, padding: 12, justifyContent: 'space-around', marginBottom: 20, marginHorizontal: 10 }}>
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <TouchableOpacity key={emoji} onPress={() => handleReaction(emoji)} style={{ padding: 8 }}>
                                        <Text style={{ fontSize: 28 }}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Actions Grid - 2 columns for a more compact look "down to the msg" */}
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 }}>
                                {[
                                    { label: 'Reply', icon: 'arrow-undo-outline', action: 'reply', color: theme.primary },
                                    { label: 'Forward', icon: 'share-social-outline', action: 'forward', color: '#2ecc71' },
                                    { label: 'Edit', icon: 'pencil-outline', action: 'edit', color: theme.primary },
                                    { label: 'Star', icon: 'star-outline', action: 'star', color: '#f1c40f' },
                                    { label: 'Copy', icon: 'copy-outline', action: 'copy', color: '#9b59b6' },
                                    { label: 'Info', icon: 'information-circle-outline', action: 'info', color: '#95a5a6' },
                                    { label: 'Delete', icon: 'trash-outline', action: 'delete', color: '#e74c3c' },
                                ].filter(item => {
                                    if (item.action === 'edit') {
                                        if (!selectedMessage) return false;
                                        const sId = String(selectedMessage?.sender?._id || selectedMessage?.sender);
                                        const isMyMsg = sId === String(myId);
                                        // "edit while recent send msg" - Check if < 15 mins
                                        const createdAt = selectedMessage?.createdAt || Date.now();
                                        const diff = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60);
                                        return isMyMsg && diff < 15;
                                    }
                                    return true;
                                }).map((item) => (
                                    <TouchableOpacity
                                        key={item.label}
                                        style={{ width: '33.33%', alignItems: 'center', marginBottom: 20 }}
                                        onPress={() => handleAction(item.action)}
                                    >
                                        <View style={[styles.actionIcon, { backgroundColor: item.color + '15', marginRight: 0, marginBottom: 5 }]}>
                                            <Ionicons name={item.icon} size={22} color={item.color} />
                                        </View>
                                        <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '500' }}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Forward Modal */}
            <Modal visible={forwardModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setForwardModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary, flex: 1 }}>Forward to...</Text>
                        <TouchableOpacity onPress={() => setForwardModalVisible(false)}>
                            <Ionicons name="close" size={24} color={theme.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    {forwardLoading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} /> : (
                        <>
                            <FlatList
                                data={forwardUsers}
                                keyExtractor={item => item._id}
                                renderItem={({ item }) => {
                                    const isSelected = selectedForwardUsers.has(item._id);
                                    return (
                                        <TouchableOpacity onPress={() => toggleForwardSelection(item)} style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', backgroundColor: isSelected ? theme.primary + '10' : 'transparent' }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                                {isSelected ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.textPrimary }}>{(item.name || "U")[0]}</Text>}
                                            </View>
                                            <Text style={{ fontSize: 16, color: theme.textPrimary, flex: 1 }}>{item.name}</Text>
                                            {isSelected && <Ionicons name="checkmark-circle" size={24} color={theme.primary} />}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                            {selectedForwardUsers.size > 0 && (
                                <View style={{ position: 'absolute', bottom: 30, right: 30 }}>
                                    <TouchableOpacity onPress={handleForwardMessage} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 }}>
                                        <Ionicons name="arrow-forward" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </Modal>

            {/* Full Screen Image Viewer */}
            <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
                    {/* Viewer Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, zIndex: 10 }}>
                        <TouchableOpacity onPress={() => setViewerVisible(false)}>
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <View style={{ marginLeft: 20, flex: 1 }}>
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                                {String(viewerData?.sender?._id || viewerData?.sender) === String(myId) ? "You" : name}
                            </Text>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                {viewerData?.createdAt ? new Date(viewerData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                            </Text>
                        </View>
                        <TouchableOpacity style={{ padding: 10 }}>
                            <Ionicons name="star-outline" size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ padding: 10 }} onPress={handleShare}>
                            <Ionicons name="share-social-outline" size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ padding: 10 }} onPress={() => setViewerMenuVisible(true)}>
                            <Ionicons name="ellipsis-vertical" size={22} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Main Image View */}
                    <TouchableOpacity activeOpacity={1} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} onPress={() => setViewerVisible(false)}>
                        {viewerImage && (
                            <Image
                                source={{ uri: `${BACKEND_URL}${viewerImage}` }}
                                style={{ width: '100%', height: '100%', transform: [{ rotate: `${viewerRotation}deg` }] }}
                                resizeMode="contain"
                            />
                        )}
                    </TouchableOpacity>

                    {/* Viewer Bottom Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, justifyContent: 'space-between' }}>
                        <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 25 }}>
                            <Ionicons name="happy-outline" size={26} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleReplyFromViewer}
                            style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 30, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="arrow-undo-outline" size={20} color="white" style={{ marginRight: 10 }} />
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Reply</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Local Menu Popup (Localized Ellipsis Menu) */}
                    {viewerMenuVisible && (
                        <TouchableOpacity
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
                            activeOpacity={1}
                            onPress={() => setViewerMenuVisible(false)}
                        >
                            <View style={{
                                position: 'absolute',
                                top: 50,
                                right: 15,
                                backgroundColor: '#232d36',
                                borderRadius: 8,
                                paddingVertical: 8,
                                width: 180,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.4,
                                shadowRadius: 8,
                                elevation: 12
                            }}>
                                <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 20 }} onPress={() => { setViewerMenuVisible(false); Alert.alert("Coming Soon", "Multi-media editor is in development"); }}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 20 }} onPress={() => { setViewerMenuVisible(false); Alert.alert("Coming Soon", "Media gallery is in development"); }}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>All media</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 20 }} onPress={() => setViewerVisible(false)}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>Show in chat</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 20 }} onPress={() => { setViewerMenuVisible(false); handleShare(); }}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>Share</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 20 }} onPress={() => { setViewerMenuVisible(false); handleSave(); }}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 20 }} onPress={() => { setViewerRotation(prev => (prev + 90) % 360); }}>
                                    <Text style={{ color: 'white', fontSize: 16 }}>Rotate</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ paddingVertical: 12, paddingHorizontal: 20 }} onPress={() => { setViewerMenuVisible(false); handleDeleteFromViewer(); }}>
                                    <Text style={{ color: 'red', fontSize: 16 }}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        // borderBottomWidth: 1, removed heavy border
    },
    backBtn: { marginRight: 10 },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    avatarContainer: {
        width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center'
    },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    headerStatus: { fontSize: 12 },
    menuBtn: { padding: 5 },

    // Bubble
    msgRow: { flexDirection: 'row', marginBottom: 2, width: '100%' },
    bubble: {
        maxWidth: '75%',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    bubbleMe: {
        borderBottomRightRadius: 4,
        marginRight: 10, // Added to prevent sticking to right edge
    },
    // }, removed duplicate closing brace
    bubbleOther: {
        borderBottomLeftRadius: 4,
    },
    msgText: { fontSize: 16 },
    msgTextMe: { fontSize: 16, color: 'white' },
    metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
    timeText: { fontSize: 10, opacity: 0.7 },

    // Media
    media: { width: 200, height: 200, borderRadius: 12 },
    docBubble: { flexDirection: 'row', alignItems: 'center' },
    docText: { marginLeft: 10, textDecorationLine: 'underline' },

    // Floating Input
    inputContainerWrapper: {
        paddingHorizontal: 16,
        paddingBottom: 10, // Uniform padding, keyboard handles the lift
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
    iconBtn: { padding: 8 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    menuDropdown: { position: 'absolute', top: 60, right: 20, borderRadius: 12, padding: 10, elevation: 10, width: 200 },
    menuItem: { paddingVertical: 12, paddingHorizontal: 10 },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    sheetRow: { flexDirection: 'row', justifyContent: 'space-around' },
    sheetItem: { alignItems: 'center' },
    sheetIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    sheetLabel: { fontSize: 14, fontWeight: '500' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

    // Action Modal Styles (Refined)
    actionSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 10,
    },
    actionSheetHandle: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 15,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 4,
    },
    actionIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionText: {
        fontSize: 16,
        fontWeight: '600',
    },
    cancelBtn: {
        marginTop: 10,
        paddingVertical: 15,
        alignItems: 'center',
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(0,0,0,0.05)',
    }
});
