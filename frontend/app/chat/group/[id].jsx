import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ImageBackground, StyleSheet, StatusBar, Keyboard, Alert, ActivityIndicator, Modal, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/context/ThemeContext';
import { useSocket } from '../../../src/context/SocketContext';
import { Colors } from '../../../src/styles/theme';

import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

import * as Clipboard from 'expo-clipboard';

// Use same env logic or hardcode for consistency matching user env
const BACKEND_URL = "http://192.168.29.129:5000";

export default function GroupChatScreen() {
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const { id, name } = useLocalSearchParams(); // id is groupId
    const router = useRouter();
    const [myId, setMyId] = useState(null);
    const { socket } = useSocket();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    // Reuse selectedMessage state
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [menuVisible, setMenuVisible] = useState(false);
    const [wallpaper, setWallpaper] = useState(null);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);
    const [viewerData, setViewerData] = useState(null);
    const [viewerMenuVisible, setViewerMenuVisible] = useState(false);
    const [viewerRotation, setViewerRotation] = useState(0);
    const [replyToMessage, setReplyToMessage] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
    const inputRef = useRef(null);
    const flatListRef = useRef(null);

    // Context Menu State
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);

    // Forwarding State
    const [forwardModalVisible, setForwardModalVisible] = useState(false);
    const [forwardUsers, setForwardUsers] = useState([]);
    const [selectedForwardUsers, setSelectedForwardUsers] = useState(new Set());
    const [forwardLoading, setForwardLoading] = useState(false);

    // Add Member State
    const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
    const [usersToAdd, setUsersToAdd] = useState([]);
    const [selectedUsersToAdd, setSelectedUsersToAdd] = useState(new Set());
    const [addMemberLoading, setAddMemberLoading] = useState(false);

    const fetchUsersToAdd = async () => {
        setAddMemberLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/community/users`);
            const data = await res.json();
            // Filter out existing members
            const currentMemberIds = groupData?.members?.map(m => String(typeof m === 'object' ? m._id : m)) || [];
            const available = data.filter(u => !currentMemberIds.includes(String(u._id)));
            setUsersToAdd(available);
        } catch (e) { Alert.alert("Error", "Failed to load users"); }
        finally { setAddMemberLoading(false); }
    };

    const toggleAddMemberSelection = (user) => {
        const newSet = new Set(selectedUsersToAdd);
        if (newSet.has(user._id)) newSet.delete(user._id);
        else newSet.add(user._id);
        setSelectedUsersToAdd(newSet);
    };

    const handleAddMember = async () => {
        if (selectedUsersToAdd.size === 0) return;
        try {
            const userIds = Array.from(selectedUsersToAdd);
            // Add each user (API supports one by one or we might need to update API to support bulk? 
            // Current controller `addMemberToGroup` takes `userId`. I should probably loop or update API.
            // Let's loop for now as it's easier without changing backend logic deeply.
            for (const uid of userIds) {
                await fetch(`${BACKEND_URL}/api/auth/chat/group/add/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: uid })
                });
            }
            Alert.alert("Success", "Members added!");
            setAddMemberModalVisible(false);
            setSelectedUsersToAdd(new Set());
            // Refresh group data
            fetchGroupDetails();
        } catch (e) {
            Alert.alert("Error", "Failed to add members");
        }
    };

    const handleMute = () => {
        Alert.alert("Mute Notifications", "Select duration", [
            { text: "8 Hours", onPress: () => muteGroup(8 * 60) },
            { text: "1 Week", onPress: () => muteGroup(7 * 24 * 60) },
            { text: "Always", onPress: () => muteGroup('always') },
            { text: "Cancel", style: "cancel" }
        ]);
    };

    const muteGroup = async (duration) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/mute/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: myId, duration })
            });
            const data = await res.json();
            if (data.success) {
                Alert.alert("Success", `Notifications muted for ${duration === 'always' ? 'Always' : duration + ' minutes'}`);
                setGroupData(prev => ({ ...prev, mutedBy: data.mutedBy }));
            }
        } catch (e) { Alert.alert("Error", "Failed to mute"); }
    };

    const fetchGroupDetails = () => {
        fetch(`${BACKEND_URL}/api/auth/chat/group/details/${id}`)
            .then(res => res.json())
            .then(data => { if (!data.error) setGroupData(data); })
            .catch(console.error);
    };

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
        if (!selectedMessage) return;
        console.log("Emitting Reaction:", { msgId: selectedMessage._id, emoji, userId: myId });
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
                            socket.emit('deleteMessage', { msgId: selectedMessage._id, chatId: id, isGroup: true });
                            // Optimistic update not needed as socket will broadcast
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
                            if (isStarred) {
                                updatedStarredBy = updatedStarredBy.filter(id => String(id) !== sId);
                            } else {
                                updatedStarredBy.push(sId);
                            }
                            return { ...m, starredBy: updatedStarredBy };
                        }
                        return m;
                    }));

                    const res = await fetch(`${BACKEND_URL}/api/auth/message/star`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: myId, messageId: selectedMessage._id })
                    });

                    if (!res.ok) {
                        // Rollback
                        fetch(`${BACKEND_URL}/api/auth/admin/group/${id}/messages`)
                            .then(r => r.json())
                            .then(d => { if (Array.isArray(d)) setMessages(d); });
                    }
                } catch (e) {
                    console.error("Star Error", e);
                }
                break;
            case 'info':
                Alert.alert("Message Info", `Sent: ${new Date(selectedMessage?.createdAt).toLocaleString()}`);
                break;
            case 'edit':
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
        if (action !== 'forward' && action !== 'edit') {
            setSelectedMessage(null);
        }
    };

    useEffect(() => {
        AsyncStorage.getItem(`group_wallpaper_${id}`).then(val => {
            if (val) setWallpaper(val);
        });
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
                await AsyncStorage.setItem(`group_wallpaper_${id}`, uri);
            }
        } catch (e) { Alert.alert("Error", "Could not set wallpaper"); }
    };

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
        // Fetch Messages
        fetch(`${BACKEND_URL}/api/auth/chat/group/messages/${id}?userId=${myId}`)
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
        if (!myId || !id || !socket) return;

        socket.emit('joinGroup', id);

        socket.on('receiveMessage', (msg) => {
            // Verify it belongs to this group (socket rooms handles it, but safety check)
            if (msg.groupId === id) {
                setMessages((prev) => [...prev, msg]);
            }
        });

        socket.on('messageDeleted', (msgId) => {
            setMessages((prev) => prev.filter((msg) => msg._id !== msgId));
        });

        socket.on('messageStatusUpdate', ({ msgId, status }) => {
            setMessages(prev => prev.map(m =>
                m._id === msgId ? { ...m, status } : m
            ));
        });

        socket.on('messageReaction', ({ msgId, reactions }) => {
            setMessages(prev => prev.map(m =>
                m._id === msgId ? { ...m, reactions } : m
            ));
        });

        socket.on('messageEdited', ({ msgId, content }) => {
            setMessages(prev => prev.map(m => m._id === msgId ? { ...m, content, isEdited: true } : m));
        });

        socket.on('messageReadBy', ({ msgId, userId }) => {
            setMessages(prev => prev.map(msg => {
                if (msg._id === msgId) {
                    const exists = msg.readBy?.some(r => String(r.user?._id || r.user) === String(userId));
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
            socket.emit('leaveGroup', id);
            socket.off('receiveMessage');
            socket.off('messageStatusUpdate');
            socket.off('messageReaction');
            socket.off('messageEdited');
            socket.off('messageDeleted');
            socket.off('messageReadBy');
        };
    }, [myId, id, socket]);

    // Search Logic
    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const results = messages
                .map((m, i) => ({ ...m, index: i }))
                .filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(m => m.index)
                .reverse(); // Newest first usually
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
    useEffect(() => {
        if (!myId || messages.length === 0 || !socket) return;
        messages.forEach(msg => {
            const senderId = String(msg.sender?._id || msg.sender);
            if (senderId !== String(myId)) {
                const isRead = msg.readBy?.some(r => String(r.user?._id || r.user) === String(myId));
                if (!isRead) {
                    socket.emit('markAsRead', { msgId: msg._id, userId: myId });
                }
            }
        });
    }, [messages, myId]);

    const sendMessage = (type = 'text', content = text) => {
        if (!content && !text.trim()) return;
        const finalContent = content || text;

        if (editingMessage && type === 'text') {
            socket.emit('editMessage', { msgId: editingMessage._id, content: finalContent, chatId: id, isGroup: true });
            setMessages(prev => prev.map(m => m._id === editingMessage._id ? { ...m, content: finalContent, isEdited: true } : m));
            setEditingMessage(null);
            setText('');
            return;
        }

        const msgData = {
            sender: myId,
            groupId: id, // Fixed: Use groupId for group chats
            content: finalContent,
            type: type,
            isGroup: true,
            replyTo: replyToMessage?._id
        };
        socket.emit('sendMessage', msgData);
        if (type === 'text') {
            setText('');
            setReplyToMessage(null);
        }
    };

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
        const senderId = String(viewerData?.sender?._id || viewerData?.sender);
        const isMe = senderId === String(myId);

        const options = [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete for me",
                onPress: () => {
                    socket.emit('deleteMessageForMe', { msgId: viewerData._id, userId: myId });
                    setMessages(prev => prev.filter(m => m._id !== viewerData._id));
                    setViewerVisible(false);
                }
            }
        ];

        if (isMe) {
            options.push({
                text: "Delete for everyone",
                style: "destructive",
                onPress: () => {
                    socket.emit('deleteMessage', { msgId: viewerData._id, userId: myId });
                    setViewerVisible(false);
                }
            });
        }

        Alert.alert("Delete", "Choose an option", options);
    };

    const handleReplyFromViewer = () => {
        setReplyToMessage(viewerData);
        setViewerVisible(false);
        setTimeout(() => inputRef.current?.focus(), 500);
    };

    const confirmClearChat = () => {
        Alert.alert("Clear Chat", "Are you sure you want to clear this chat?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear",
                style: "destructive",
                onPress: handleClearChat
            }
        ]);
    };

    const handleClearChat = async () => {
        try {
            if (groupData?.communityId && groupData?.type === 'announcement') {
                const res = await fetch(`${BACKEND_URL}/api/auth/community/clear-chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ communityId: groupData.communityId, userId: myId })
                });
                const data = await res.json();
                if (data.success) {
                    setMessages([]); // Clear local state immediately
                    Alert.alert("Success", data.message);
                } else {
                    Alert.alert("Error", data.error || "Failed");
                }
            } else {
                Alert.alert("Info", "Clear chat is currently only available for community announcements.");
            }
        } catch (e) {
            Alert.alert("Error", "Network error");
        }
    };

    const confirmExitGroup = () => {
        const isCommunityMain = !!(groupData?.communityId && groupData?.type === 'announcement');
        const msg = isCommunityMain ? "Exit Community? You will be removed from all community groups." : "Exit Group? You will be removed from this group.";

        Alert.alert("Exit", msg, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Exit",
                style: "destructive",
                onPress: handleExitGroup
            }
        ]);
    };

    const handleExitGroup = async () => {
        try {
            if (groupData?.communityId && groupData?.type === 'announcement') {
                // Exit Community
                const res = await fetch(`${BACKEND_URL}/api/auth/community/exit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ communityId: groupData.communityId, userId: myId })
                });
                const data = await res.json();
                if (data.success) {
                    Alert.alert("Success", "Left community");
                    router.replace({ pathname: '/(tabs)/communityScreen', params: { tab: 'Updates' } });
                } else {
                    Alert.alert("Error", data.error || "Failed");
                }
            } else {
                // Exit Regular Group
                const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/remove/${id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: myId })
                });
                const data = await res.json();
                if (data.success) {
                    Alert.alert("Success", "Left group");
                    router.replace({ pathname: '/(tabs)/communityScreen', params: { tab: 'chats' } });
                } else {
                    Alert.alert("Error", "Failed to leave group");
                }
            }
        } catch (e) {
            Alert.alert("Error", "Network error");
        }
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
    // Admin/Announcement Check
    const canSend = () => {
        if (!groupData) return true;
        // If it's an announcement group OR onlyAdminsCanPost is true
        if (groupData.type === 'announcement' || groupData.onlyAdminsCanPost) {
            // Check if I am admin
            const isAdmin = groupData.admins.some(admin =>
                (typeof admin === 'object' ? admin._id : admin) === myId
            );
            return isAdmin;
        }
        return true;
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
                    mimeType: asset.type || 'image/jpeg'
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
                // Update Group
                const updateRes = await fetch(`${BACKEND_URL}/api/auth/chat/group/icon/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ icon: data.url })
                });
                if (updateRes.ok) {
                    setGroupData(prev => ({ ...prev, icon: data.url }));
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

    const renderMessageContent = (item, isHighlighted) => {
        if (item.type === 'image') return (
            <TouchableOpacity onPress={() => { setViewerImage(item.content); setViewerData(item); setViewerRotation(0); setViewerVisible(true); }}>
                <Image source={{ uri: `${BACKEND_URL}${item.content}` }} style={styles.media} resizeMode="cover" />
            </TouchableOpacity>
        );

        const itemSenderId = String(item.sender?._id || item.sender);
        const isMe = itemSenderId === String(myId);

        if (!searchQuery || !searchQuery.trim()) return <Text style={isMe ? styles.msgTextMe : [styles.msgText, { color: theme.textPrimary }]}>{item.content}</Text>;

        // Highlighting Logic
        const safeQuery = searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = item.content.split(new RegExp(`(${safeQuery})`, 'gi'));
        return (
            <View>
                <Text style={isMe ? styles.msgTextMe : [styles.msgText, { color: theme.textPrimary }]}>
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

    const getMemberNames = () => {
        if (!groupData || !groupData.members) return "tap here for group info";
        const names = groupData.members.map(m => {
            const mId = typeof m === 'object' ? m._id : m;
            const mName = typeof m === 'object' ? m.name : "User";
            return { id: mId, name: mId === myId ? "You" : mName };
        });
        // Put "You" first, like WhatsApp
        names.sort((a, b) => (a.name === "You" ? -1 : b.name === "You" ? 1 : 0));
        return names.map(n => n.name).join(", ");
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" backgroundColor="#075E54" />

            {/* Header */}
            {searchVisible ? (
                <View style={[styles.header, { backgroundColor: theme.primary }]}>
                    <TouchableOpacity onPress={() => { setSearchVisible(false); setSearchQuery(''); }}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <TextInput
                        style={{ flex: 1, marginLeft: 10, fontSize: 16, color: 'white' }}
                        placeholder="Search..."
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus
                    />
                    {searchQuery.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', marginRight: 5 }}>
                                {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
                            </Text>
                            <TouchableOpacity onPress={handlePrevSearch} style={{ padding: 5 }}>
                                <Ionicons name="chevron-up" size={24} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleNextSearch} style={{ padding: 5 }}>
                                <Ionicons name="chevron-down" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: '#075E54' }]}>
                    <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/communityScreen')} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.headerInfo} onPress={() => setInfoModalVisible(true)}>
                        <View style={[styles.avatarContainer, { backgroundColor: theme.inputBg, width: 40, height: 40, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }]}>
                            {groupData?.icon ? (
                                <Image
                                    source={{ uri: `${BACKEND_URL}${groupData.icon}` }}
                                    style={{ width: 40, height: 40 }}
                                />
                            ) : (
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textSecondary }}>{name?.[0] || groupData?.name?.[0] || 'G'}</Text>
                            )}
                        </View>

                        <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={[styles.headerTitle, { color: 'white' }]} numberOfLines={1}>{name || groupData?.name || "Group"}</Text>
                        </View>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => setSearchVisible(true)} style={[styles.menuBtn, { marginRight: 15 }]}>
                            <Ionicons name="search" size={24} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={async () => {
                            try {
                                const roomCode = Math.random().toString(36).substring(7); // Simple generation or call API
                                // Send meeting link to group
                                const meetLink = `https://meet.jit.si/${roomCode}`; // Or internal schema
                                // For now, let's use internal meet route
                                const internalCode = Math.floor(100000 + Math.random() * 900000).toString();

                                await fetch(`${BACKEND_URL}/api/auth/meet/schedule`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        title: 'Group Call',
                                        date: new Date(),
                                        hostId: myId,
                                        participants: groupData.members.map(m => typeof m === 'object' ? m._id : m)
                                    })
                                });

                                // Send message
                                socket.emit('sendMessage', {
                                    sender: myId,
                                    groupId: id,
                                    content: `📞 Started a group call\nJoin here: code ${internalCode}`,
                                    type: 'text',
                                    isGroup: true
                                });

                                router.push(`/meet/${internalCode}`);
                            } catch (e) {
                                Alert.alert("Error", "Could not start call");
                            }
                        }} style={[styles.menuBtn, { marginRight: 15 }]}>
                            <Ionicons name="videocam" size={24} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={(() => Alert.alert("Call", "Group calls coming soon"))} style={[styles.menuBtn, { marginRight: 15 }]}>
                            <Ionicons name="call" size={22} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
                            <Ionicons name="ellipsis-vertical" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ImageBackground source={wallpaper ? { uri: wallpaper } : null} style={{ flex: 1, backgroundColor: wallpaper ? 'transparent' : theme.background }} resizeMode="cover">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
                    style={{ flex: 1 }}
                >
                    {/* Reply/Edit Preview */}
                    {(replyToMessage || editingMessage) && (
                        <View style={{ backgroundColor: theme.surface, padding: 10, borderLeftWidth: 4, borderLeftColor: theme.primary, marginHorizontal: 16, marginTop: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: 'bold', color: theme.primary }}>{editingMessage ? 'Editing message' : 'Replying to'}</Text>
                                <Text style={{ color: theme.textSecondary }} numberOfLines={1}>
                                    {editingMessage ? editingMessage.content : (replyToMessage.type === 'image' ? 'Photo' : replyToMessage.content)}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => { setReplyToMessage(null); setEditingMessage(null); if (editingMessage) setText(''); }}>
                                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {loading ? (
                        <ActivityIndicator size="large" color={theme.secondary} style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            keyboardShouldPersistTaps="handled"
                            ref={flatListRef}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                            style={{ flex: 1 }}
                            data={processMessagesWithDates(messages)}
                            keyExtractor={(item, index) => index.toString()}
                            onScrollToIndexFailed={(info) => {
                                if (flatListRef.current) {
                                    flatListRef.current.scrollToIndex({ index: info.index, animated: false });
                                }
                            }}
                            renderItem={({ item, index }) => {
                                if (item.type === 'date_header') {
                                    return (
                                        <View style={{ alignItems: 'center', marginVertical: 10 }}>
                                            <View style={{ backgroundColor: theme.inputBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 }}>
                                                <Text style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '500' }}>
                                                    {item.content}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                }
                                const senderId = typeof item.sender === 'object' ? item.sender._id : item.sender;
                                const isMe = senderId === myId;
                                const isHighlighted = searchQuery.trim().length > 0 && item.content?.toLowerCase().includes(searchQuery.toLowerCase().trim());
                                return (
                                    <TouchableOpacity activeOpacity={0.9} onLongPress={() => handleLongPress(item)} style={[
                                        styles.msgRow,
                                        isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }
                                    ]}>
                                        <View style={[
                                            styles.bubble,
                                            isMe ? [styles.bubbleMe, { backgroundColor: '#075E54' }] : [styles.bubbleOther, { backgroundColor: theme.surface }],
                                            isHighlighted && { borderWidth: 2, borderColor: theme.secondary || '#FFD700' }
                                        ]}>
                                            {/* Sender Name if not me */}
                                            {!isMe && (
                                                <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 2 }}>
                                                    {item.sender?.name || "User"}
                                                </Text>
                                            )}
                                            {renderMessageContent(item)}
                                            {item.reactions && item.reactions.length > 0 && (
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, justifyContent: 'flex-end' }}>
                                                    {item.reactions.map((r, i) => (
                                                        <View key={i} style={{ backgroundColor: theme.inputBg, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2, marginLeft: 2 }}>
                                                            <Text style={{ fontSize: 10 }}>{r.emoji}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            <View style={styles.metaRow}>
                                                <Text style={[styles.timeText, { color: isMe ? 'white' : theme.textSecondary }]}>
                                                    {item.createdAt
                                                        ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    }
                                                </Text>
                                                {isMe && renderTicks(item)}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                            contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 15, paddingBottom: 100 }}
                        />
                    )}

                    {/* Input Area */}
                    {/* Floating Input Bar */}
                    {canSend() ? (
                        <View style={[styles.inputContainerWrapper, { backgroundColor: 'transparent', paddingBottom: 10 }]}>
                            <View style={[styles.floatingInputBar, { backgroundColor: 'white', borderRadius: 25, marginHorizontal: 10, paddingVertical: 5 }]}>
                                <TouchableOpacity onPress={() => { setContextMenuVisible(true); setSelectedMessage(null); }} style={[styles.iconBtn, { backgroundColor: '#e6f2f1', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: 5 }]}>
                                    <Ionicons name="add" size={24} color="#075E54" />
                                </TouchableOpacity>
                                <TextInput
                                    ref={inputRef}
                                    value={text}
                                    onChangeText={setText}
                                    style={[styles.input, { color: 'black', marginLeft: 10 }]}
                                    placeholder="Type a message..."
                                    placeholderTextColor="#999"
                                    multiline
                                />
                                {text.length > 0 ? (
                                    <TouchableOpacity onPress={() => sendMessage('text')} style={[styles.sendBtn, { backgroundColor: '#075E54', width: 36, height: 36, borderRadius: 18, marginLeft: 5 }]}>
                                        <Ionicons name="arrow-up" size={20} color="white" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.iconBtn}>
                                        <Ionicons name="mic-outline" size={24} color="#075E54" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={{ padding: 15, backgroundColor: theme.surface, alignItems: 'center' }}>
                            <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>Only admins can send messages.</Text>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </ImageBackground>


            <Modal visible={infoModalVisible} animationType="slide" transparent={false} onRequestClose={() => setInfoModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
                    {/* Group Info Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#075E54', elevation: 4 }}>
                        <TouchableOpacity onPress={() => setInfoModalVisible(false)} style={{ marginRight: 15 }}>
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white' }}>Group Info</Text>
                    </View>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                        {/* Group Icon & Name */}
                        <View style={{ alignItems: 'center', paddingVertical: 30, backgroundColor: theme.surface }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.inputBg || '#e0e0e0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 12 }}>
                                {groupData?.icon ? (
                                    <Image source={{ uri: `${BACKEND_URL}${groupData.icon}` }} style={{ width: 80, height: 80 }} />
                                ) : (
                                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.textSecondary }}>{(name || groupData?.name || 'G')[0]}</Text>
                                )}
                            </View>
                            <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.textPrimary }}>{name || groupData?.name || "Group"}</Text>
                            <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>
                                Group · {groupData?.members?.length || 0} members
                            </Text>
                        </View>

                        {/* Description */}
                        {groupData?.description ? (
                            <View style={{ padding: 16, backgroundColor: theme.surface, marginTop: 10 }}>
                                <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 4 }}>Description</Text>
                                <Text style={{ fontSize: 15, color: theme.textPrimary }}>{groupData.description}</Text>
                            </View>
                        ) : null}

                        {/* Quick Actions */}
                        <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 20, backgroundColor: theme.surface, marginTop: 10 }}>
                            <TouchableOpacity style={{ alignItems: 'center', marginHorizontal: 30 }} onPress={handleMute}>
                                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#075E54', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                                    <Ionicons name={groupData?.mutedBy?.some(m => m.user === myId) ? "notifications-off" : "notifications"} size={22} color="white" />
                                </View>
                                <Text style={{ fontSize: 12, color: theme.textSecondary }}>Mute</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ alignItems: 'center', marginHorizontal: 30 }} onPress={() => { setInfoModalVisible(false); pickWallpaper(); }}>
                                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#075E54', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                                    <Ionicons name="image" size={22} color="white" />
                                </View>
                                <Text style={{ fontSize: 12, color: theme.textSecondary }}>Wallpaper</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Media, Links, Docs */}
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: theme.surface, marginTop: 10 }}>
                            <Text style={{ fontSize: 15, color: theme.textPrimary }}>Media, Links, and Docs</Text>
                            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {/* Members */}
                        <View style={{ backgroundColor: theme.surface, marginTop: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
                                <Text style={{ fontSize: 14, color: theme.textSecondary }}>
                                    {groupData?.members?.length || 0} members
                                </Text>
                                <TouchableOpacity>
                                    <Ionicons name="search" size={20} color={theme.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* Add Members */}
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }} onPress={() => { setAddMemberModalVisible(true); fetchUsersToAdd(); }}>
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#075E54', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                    <Ionicons name="person-add" size={20} color="white" />
                                </View>
                                <Text style={{ fontSize: 16, color: '#075E54', fontWeight: '500' }}>Add members</Text>
                            </TouchableOpacity>

                            {/* Member List */}
                            {groupData?.members?.map((member, index) => {
                                const memberId = typeof member === 'object' ? member._id : member;
                                const memberName = typeof member === 'object' ? member.name : 'User';
                                const memberPic = typeof member === 'object' ? member.profilePic : null;
                                const isAdmin = groupData?.admins?.some(a => {
                                    const aId = typeof a === 'object' ? a._id : a;
                                    return aId === memberId;
                                });
                                const isYou = memberId === myId;
                                const iAmAdmin = groupData?.admins?.some(a => (typeof a === 'object' ? a._id : a) === myId);

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: index > 0 ? 0.5 : 0, borderTopColor: theme.border }}
                                        onLongPress={() => {
                                            if (iAmAdmin && !isYou) {
                                                Alert.alert("Manage Member", `Remove ${memberName}?`, [
                                                    { text: "Cancel", style: "cancel" },
                                                    {
                                                        text: "Remove",
                                                        style: "destructive",
                                                        onPress: async () => {
                                                            try {
                                                                const res = await fetch(`${BACKEND_URL}/api/auth/chat/group/remove/${id}`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ userId: memberId })
                                                                });
                                                                if (res.ok) {
                                                                    Alert.alert("Success", "Member removed");
                                                                    fetchGroupDetails();
                                                                } else {
                                                                    Alert.alert("Error", "Failed to remove member");
                                                                }
                                                            } catch (e) { Alert.alert("Error", "Connection failed"); }
                                                        }
                                                    }
                                                ]);
                                            }
                                        }}
                                    >
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBg || '#e0e0e0', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
                                            {memberPic ? (
                                                <Image source={{ uri: `${BACKEND_URL}${memberPic}` }} style={{ width: 40, height: 40 }} />
                                            ) : (
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.textSecondary }}>{(memberName || 'U')[0]}</Text>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 16, color: theme.textPrimary, fontWeight: '500' }}>
                                                {isYou ? 'You' : memberName}
                                            </Text>
                                        </View>
                                        {isAdmin && (
                                            <View style={{ backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 11, color: '#075E54', fontWeight: '600' }}>Admin</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Danger Zone */}
                        <View style={{ backgroundColor: theme.surface, marginTop: 10 }}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }} onPress={() => {
                                Alert.alert("Exit Group", "Leaving this group will remove you from the member list. Are you sure?", [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Exit Group", style: "destructive", onPress: () => { setInfoModalVisible(false); router.back(); } }
                                ]);
                            }}>
                                <Ionicons name="exit-outline" size={22} color="red" style={{ marginRight: 15 }} />
                                <Text style={{ fontSize: 16, color: 'red' }}>Exit group</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Ellipsis Menu Modal */}
            <Modal transparent visible={menuVisible} onRequestClose={() => setMenuVisible(false)} animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.menuDropdown, { backgroundColor: theme.surface }]}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setSearchVisible(true); }}>
                            <Text style={{ color: theme.textPrimary }}>Search</Text>
                        </TouchableOpacity>
                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 5 }} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); router.push(`/chat/group/info/${id}`); }}>
                            <Text style={{ color: theme.textPrimary }}>Group Info</Text>
                        </TouchableOpacity>
                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 5 }} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); pickWallpaper(); }}>
                            <Text style={{ color: theme.textPrimary }}>Wallpaper</Text>
                        </TouchableOpacity>
                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 5 }} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                            setMenuVisible(false);
                            confirmClearChat();
                        }}>
                            <Text style={{ color: theme.textPrimary }}>Clear Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); confirmExitGroup(); }}>
                            <Text style={{ color: 'red' }}>Exit Group</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Plus Menu Modal (Attachments) */}
            <Modal transparent visible={contextMenuVisible && !selectedMessage} animationType="fade" onRequestClose={() => setContextMenuVisible(false)}>
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setContextMenuVisible(false)}
                >
                    <View style={{ position: 'absolute', bottom: 100, left: 20, backgroundColor: theme.surface, borderRadius: 16, padding: 10, elevation: 10, width: 200 }}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setContextMenuVisible(false); /* Document Logic */ Alert.alert("Document", "Coming soon"); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="document-text" size={24} color="#5F6368" style={{ marginRight: 10 }} />
                                <Text style={{ color: theme.textPrimary }}>Document</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setContextMenuVisible(false); pickImage(); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="image" size={24} color="#d93025" style={{ marginRight: 10 }} />
                                <Text style={{ color: theme.textPrimary }}>Gallery</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setContextMenuVisible(false); /* Audio Logic */ Alert.alert("Audio", "Coming soon"); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="musical-notes" size={24} color="#e37400" style={{ marginRight: 10 }} />
                                <Text style={{ color: theme.textPrimary }}>Audio</Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setContextMenuVisible(false); /* Location Logic */ Alert.alert("Location", "Coming soon"); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="location" size={24} color="#1e8e3e" style={{ marginRight: 10 }} />
                                <Text style={{ color: theme.textPrimary }}>Location</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Premium Center-Positioned Context Menu Modal (Message Actions) */}
            <Modal transparent visible={contextMenuVisible && !!selectedMessage} animationType="fade" onRequestClose={() => setContextMenuVisible(false)}>
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
                                { backgroundColor: theme.surface, padding: 15, borderRadius: 12, marginBottom: 20, alignSelf: 'center', width: '100%' }
                            ]}>
                                <Text style={{ color: theme.textPrimary, fontSize: 16 }}>{selectedMessage.content}</Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 5, textAlign: 'right' }}>
                                    {selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </Text>
                            </View>
                        )}

                        {/* Reaction Bar */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: theme.surface, padding: 15, borderRadius: 50, marginBottom: 20 }}>
                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                                <TouchableOpacity key={emoji} onPress={() => handleReaction(emoji)}>
                                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Action List */}
                        <View style={{ backgroundColor: theme.surface, borderRadius: 12, overflow: 'hidden' }}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('reply')}>
                                <Text style={{ color: theme.textPrimary, fontSize: 16 }}>Reply</Text>
                            </TouchableOpacity>
                            <View style={{ height: 1, backgroundColor: theme.border }} />
                            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('copy')}>
                                <Text style={{ color: theme.textPrimary, fontSize: 16 }}>Copy</Text>
                            </TouchableOpacity>
                            <View style={{ height: 1, backgroundColor: theme.border }} />
                            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('forward')}>
                                <Text style={{ color: theme.textPrimary, fontSize: 16 }}>Forward</Text>
                            </TouchableOpacity>
                            <View style={{ height: 1, backgroundColor: theme.border }} />
                            <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('star')}>
                                <Text style={{ color: theme.textPrimary, fontSize: 16 }}>{selectedMessage?.starredBy?.includes(myId) ? "Unstar" : "Star"}</Text>
                            </TouchableOpacity>
                            {selectedMessage?.sender === myId && (
                                <>
                                    <View style={{ height: 1, backgroundColor: theme.border }} />
                                    <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('info')}>
                                        <Text style={{ color: theme.textPrimary, fontSize: 16 }}>Info</Text>
                                    </TouchableOpacity>
                                    <View style={{ height: 1, backgroundColor: theme.border }} />
                                    <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('edit')}>
                                        <Text style={{ color: theme.textPrimary, fontSize: 16 }}>Edit</Text>
                                    </TouchableOpacity>
                                    <View style={{ height: 1, backgroundColor: theme.border }} />
                                    <TouchableOpacity style={styles.menuItem} onPress={() => handleAction('delete')}>
                                        <Text style={{ color: 'red', fontSize: 16 }}>Delete</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>


            {/* Forward Modal */}
            < Modal visible={forwardModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setForwardModalVisible(false)
            }>
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
            </Modal >

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
                                {String(viewerData?.sender?._id || viewerData?.sender) === String(myId) ? "You" : (viewerData?.sender?.name || "User")}
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

            {/* Add Member Modal */}
            < Modal visible={addMemberModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddMemberModalVisible(false)
            }>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary, flex: 1 }}>Add Members</Text>
                        <TouchableOpacity onPress={() => setAddMemberModalVisible(false)}>
                            <Ionicons name="close" size={24} color={theme.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    {addMemberLoading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} /> : (
                        <>
                            <FlatList
                                data={usersToAdd}
                                keyExtractor={item => item._id}
                                renderItem={({ item }) => {
                                    const isSelected = selectedUsersToAdd.has(item._id);
                                    return (
                                        <TouchableOpacity onPress={() => toggleAddMemberSelection(item)} style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', backgroundColor: isSelected ? theme.primary + '10' : 'transparent' }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                                {isSelected ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.textPrimary }}>{(item.name || "U")[0]}</Text>}
                                            </View>
                                            <Text style={{ fontSize: 16, color: theme.textPrimary, flex: 1 }}>{item.name}</Text>
                                            {isSelected && <Ionicons name="checkmark-circle" size={24} color={theme.primary} />}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                            {selectedUsersToAdd.size > 0 && (
                                <View style={{ position: 'absolute', bottom: 30, right: 30 }}>
                                    <TouchableOpacity onPress={handleAddMember} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 }}>
                                        <Ionicons name="checkmark" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </Modal >
        </SafeAreaView >
    );
}

const getStyles = (Colors) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.primary,
        elevation: 4
    },
    backBtn: { marginRight: 10 },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    avatarContainer: {
        width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10,
        backgroundColor: 'rgba(255,255,255,0.2)'
    },
    headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
    headerStatus: { color: Colors.textLight, fontSize: 12 },

    // Bubbles
    msgRow: { flexDirection: 'row', marginBottom: 2, width: '100%' },
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
    msgText: { fontSize: 16 },
    msgTextMe: { fontSize: 16, color: 'white' },
    metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
    timeText: { fontSize: 10, opacity: 0.7 },

    // Floating Input
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
    iconBtn: { padding: 8 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    media: { width: 200, height: 200, borderRadius: 12 },

    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 16
    },
    menuDropdown: {
        position: 'absolute',
        top: 50,
        right: 10,
        width: 150,
        borderRadius: 8,
        paddingVertical: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 1000
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },

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
