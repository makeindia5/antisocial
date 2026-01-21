import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Modal, TextInput, Linking, Image, Animated, ActivityIndicator, KeyboardAvoidingView, Platform, Button, StatusBar as RNStatusBar, RefreshControl, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
// import ImageViewer from 'react-native-image-zoom-viewer';
import { API_BASE } from '../../../src/services/apiService';
import { Colors, GlobalStyles } from '../../../src/styles/theme';
import { useTheme } from '../../../src/context/ThemeContext';

const BACKEND_URL = "http://192.168.29.129:5000";

const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper: Insert Date Headers
const processFeed = (items) => {
    const processed = [];
    let lastDate = null;
    items.forEach(item => {
        const itemDate = new Date(item.createdAt).toDateString();
        if (itemDate !== lastDate) {
            processed.push({ type: 'date-header', date: item.createdAt, _id: `date-${itemDate}` });
            lastDate = itemDate;
        }
        processed.push(item);
    });
    return processed;
};

export default function GroupFeedScreen() {
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const { id: groupId, groupName } = useLocalSearchParams();
    const router = useRouter();
    const [originalFeed, setOriginalFeed] = useState([]); // Raw data
    const [feedData, setFeedData] = useState([]); // Processed with dates
    const [isAdmin, setIsAdmin] = useState(false);
    const [userId, setUserId] = useState(null);
    const socket = useRef(null);
    const flatListRef = useRef(null);
    const lastFeedLength = useRef(0);

    // Chat State
    const [messageText, setMessageText] = useState('');
    const [menuVisible, setMenuVisible] = useState(false); // Attachment Menu
    const fadeAnim = useRef(new Animated.Value(0)).current; // Animation for menu

    // Image Viewer State
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);

    const openImageViewer = (url) => {
        // setViewerImage(url);
        // setViewerVisible(true);
        Alert.alert("View", "Image viewing temporarily disabled for build debugging");
    };

    const closeImageViewer = () => {
        setViewerVisible(false);
        setViewerImage(null);
    };

    // Creation State (Poll/Refs)
    const [pollModalVisible, setPollModalVisible] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    // Image Caption State
    const [captionModalVisible, setCaptionModalVisible] = useState(false);
    const [selectedImageAsset, setSelectedImageAsset] = useState(null);
    const [imageCaption, setImageCaption] = useState('');

    // Group Options State
    const [optionsVisible, setOptionsVisible] = useState(false);
    const [renameVisible, setRenameVisible] = useState(false);
    const [manageUsersVisible, setManageUsersVisible] = useState(false);
    const [groupDetails, setGroupDetails] = useState({ name: 'Group Feed', icon: null, members: [] });
    const [newName, setNewName] = useState('');
    const [allUsers, setAllUsers] = useState([]);
    const [groupInfoVisible, setGroupInfoVisible] = useState(false);

    useEffect(() => {
        if (!groupId) return;

        checkUser();
        fetchGroupData();
        fetchGroupDetails();

        socket.current = io(BACKEND_URL);

        socket.current.on('connect', () => {
            console.log("Socket Connected, joining group:", groupId);
            socket.current.emit('joinGroup', groupId);
        });

        socket.current.on('newAnnouncement', (newPost) => {
            if (newPost.group === groupId) {
                const item = { ...newPost, type: 'announcement' };
                // Deduplicate: Check if we already have this ID (from optimistic update or fetch)
                setOriginalFeed(prev => {
                    if (prev.some(p => p._id === item._id)) return prev;
                    return [...prev, item].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                });
            }
        });

        socket.current.on('updateAnnouncement', (updated) => {
            console.log("Received updateAnnouncement:", updated._id);
            setOriginalFeed(prev => prev.map(item => item._id === updated._id ? { ...updated, type: 'announcement' } : item));
        });



        socket.current.on('receiveMessage', (msg) => {
            const item = { ...msg, type: 'message' };

            setOriginalFeed(prev => {
                // 1. Check if we already have this exact ID (server echo)
                if (prev.some(p => p._id === item._id)) return prev;

                // 2. Filter out any "pending" message that matches this new one (from optimistic update)
                //    We remove it if it is pending AND content matches.
                const filtered = prev.filter(p => !(p.pending && p.content === item.content));

                return [...filtered, item].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            });
        });

        // Delete Listener
        socket.current.on('deleteAnnouncement', (deletedId) => {
            console.log("Received deleteAnnouncement:", deletedId);
            setOriginalFeed(prev => prev.filter(item => item._id !== deletedId));
        });

        socket.current.on('deleteAnnouncement', (id) => {
            setOriginalFeed(prev => prev.filter(a => a._id !== id));
        });

        socket.current.on('messageError', (err) => {
            console.error("Socket Message Error:", err);
            Alert.alert("Message Sending Failed", err.error || "Unknown error");
        });

        return () => {
            // Update Last Read for this specific group
            AsyncStorage.setItem(`lastReadGroup_${groupId}`, new Date().toISOString());

            if (socket.current) {
                socket.current.emit('leaveGroup', groupId);
                socket.current.disconnect();
            }
        };
    }, [groupId]);

    // Update on mount as well
    useEffect(() => {
        if (groupId) AsyncStorage.setItem(`lastReadGroup_${groupId}`, new Date().toISOString());
    }, [groupId]);

    useEffect(() => {
        setFeedData(processFeed(originalFeed));
        // Only scroll if new messages arrived
        if (originalFeed.length > lastFeedLength.current) {
            setTimeout(scrollToBottom, 200);
            lastFeedLength.current = originalFeed.length;
        }
    }, [originalFeed]);

    const scrollToBottom = () => {
        if (flatListRef.current && feedData.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
        }
    };

    const checkUser = async () => {
        const role = await AsyncStorage.getItem('userRole');
        const id = await AsyncStorage.getItem('userId');
        console.log("Current User:", id, role);
        setIsAdmin(role === 'admin');
        setUserId(id);
    };

    const fetchGroupData = async () => {
        try {
            // Fetch Announcements
            const resAnn = await fetch(`${API_BASE.replace('/auth', '/admin')}/group/${groupId}/announcements`);
            const announcements = resAnn.ok ? await resAnn.json() : [];

            // Fetch Chat Messages
            const resChat = await fetch(`${API_BASE.replace('/auth', '/admin')}/group/${groupId}/messages`);
            const messages = resChat.ok ? await resChat.json() : [];

            // Merge and Sort
            const combined = [
                ...announcements.map(a => ({ ...a, type: 'announcement' })),
                ...messages.map(m => ({ ...m, type: 'message' }))
            ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            setOriginalFeed(combined);
        } catch (err) {
            console.error(err);
        }
    };

    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchGroupData();
        setRefreshing(false);
    };

    const toggleMenu = () => {
        if (menuVisible) {
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMenuVisible(false));
        } else {
            setMenuVisible(true);
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        }
    };

    const sendMessage = async () => {
        if (!messageText.trim()) return;

        if (!userId) {
            Alert.alert("Debug Error", "User ID is null. Try logging out and back in.");
            return;
        }

        const tempId = Math.random().toString();
        const msgData = {
            _id: tempId,
            sender: userId,
            groupId: groupId,
            content: messageText,
            type: 'text',
            createdAt: new Date().toISOString(),
            pending: true // Mark as pending if we want to show a spinner or gray out
        };

        // Optimistic Update
        setOriginalFeed(prev => [...prev, msgData].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
        setMessageText('');

        if (!socket.current || !socket.current.connected) {
            Alert.alert("Error", "Socket not connected. Message shown locally only.");
            // Ideally queue it or reconnect
            return;
        }

        // Emit
        socket.current.emit('sendMessage', {
            sender: userId,
            groupId: groupId,
            content: msgData.content,
            type: 'text'
        });
    };

    // Update receiveMessage to avoid duplicates if possible, or just accept duplicate for now (it will have different ID)
    // A simple dedup approach: check if we have a pending message with same content sent recently? 
    // For now, let's trust the server replaces it or we just ignore logic complexity for speed.
    // Actually, if we optimistic update, the server message will come in as a NEW message with a real _id.
    // We should probably filter out the 'pending' one if we find a match, or just let strict 'createdAt' sorting handle it.
    // To keep it clean: We won't remove the optimistic one automatically without complex logic. 
    // User wants "immediate show".

    // Better strategy for this quick fix:
    // Just show optimistic. When socket message comes, if it looks identical (same content, sender, weak time correlation), replace it?
    // Let's just add it. The user might see double for a second if they lag.


    const pickImageAndSend = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All, // Allow Images and Videos
            allowsEditing: false, // Editing often re-encodes, might break video
            quality: 1, // High quality
        });

        if (!result.canceled && result.assets[0].uri) {
            setSelectedImageAsset(result.assets[0]);
            setImageCaption('');
            setCaptionModalVisible(true);
            toggleMenu();
        }
    };

    const pickDocAndSend = async () => {
        let result = await DocumentPicker.getDocumentAsync({
            type: '*/*', // Allow all files
            copyToCacheDirectory: true
        });
        if (result.assets && result.assets.length > 0) {
            createAnnouncementFromChat('document', result.assets[0]);
            toggleMenu();
        }
    };

    const createAnnouncementFromChat = async (type, fileData = null, pollData = null, caption = null) => {
        if (!userId) return;

        const formData = new FormData();
        formData.append('title', type === 'poll' ? 'Poll' : 'Attachment');
        // Use provided caption, or poll question, or fallback to file name
        const finalContent = caption || (type === 'poll' ? pollData.question : (fileData?.name || 'File Attachment'));
        formData.append('content', finalContent);
        formData.append('groupId', groupId);

        if (fileData) {
            // Determine type based on extension or mime if possible, essentially "image" or "video" or "document"
            let finalFileType = 'document';
            if (type === 'image') {
                // Check if it's actually video
                if (fileData.type === 'video' || fileData.mimeType?.startsWith('video/')) {
                    finalFileType = 'video';
                } else {
                    finalFileType = 'image';
                }
            }

            formData.append('file', {
                uri: fileData.uri,
                name: fileData.name || (finalFileType === 'video' ? 'video.mp4' : 'image.jpg'),
                type: fileData.mimeType || (finalFileType === 'video' ? 'video/mp4' : 'image/jpeg')
            });
            formData.append('fileType', finalFileType);
            formData.append('fileName', fileData.name || (finalFileType === 'video' ? 'video.mp4' : 'image.jpg'));
        }

        if (type === 'poll') {
            formData.append('poll', JSON.stringify(pollData));
        }

        try {
            console.log("Posting Rich Content...");
            setRefreshing(true); // Show loading
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/announcement`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setRefreshing(false); // Hide loading

            if (res.ok) {
                console.log("Posted successfully");
                fetchGroupData(); // Force refresh to show new msg immediately
            } else {
                Alert.alert("Error", "Failed to send attachment");
            }
        } catch (e) {
            console.error(e);
        }

        if (type === 'poll') setPollModalVisible(false);
        if (type === 'image') setCaptionModalVisible(false);
    };

    const fetchGroupDetails = async () => {
        try {
            // Need to use admin route to get group details
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/group/${groupId}`);
            if (res.ok) {
                const data = await res.json();
                setGroupDetails(data);
                setNewName(data.name);
            }
        } catch (e) {
            console.error("Fetch group details error", e);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/users`);
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data);
            }
        } catch (e) { console.error(e); }
    };

    const handleUpdateGroupName = async () => {
        if (!newName.trim()) return;
        try {
            await fetch(`${API_BASE.replace('/auth', '/admin')}/group/${groupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            setRenameVisible(false);
            fetchGroupDetails();
            Alert.alert("Success", "Group name updated");
        } catch (e) { Alert.alert("Error", "Failed to update name"); }
    };

    const handleUpdateGroupIcon = async () => {
        setOptionsVisible(false);
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0].uri) {
            const formData = new FormData();
            formData.append('icon', {
                uri: result.assets[0].uri,
                name: 'icon.jpg',
                type: 'image/jpeg'
            });

            try {
                await fetch(`${API_BASE.replace('/auth', '/admin')}/group/${groupId}`, {
                    method: 'PUT',
                    body: formData
                });
                fetchGroupDetails();
                Alert.alert("Success", "Group icon updated");
            } catch (e) { Alert.alert("Error", "Failed to update icon"); }
        }
    };

    const handleToggleUser = async (uId) => {
        const currentMembers = groupDetails.members.map(m => m._id);
        let newMembers;
        if (currentMembers.includes(uId)) {
            newMembers = currentMembers.filter(id => id !== uId);
        } else {
            newMembers = [...currentMembers, uId];
        }

        try {
            await fetch(`${API_BASE.replace('/auth', '/admin')}/group/${groupId}/members`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ members: newMembers })
            });
            // Update local state smoothly or fetch
            fetchGroupDetails();
        } catch (e) { console.error(e); }
    };

    const handleExitGroup = () => {
        Alert.alert("Exit Group", "Are you sure you want to leave?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Exit", style: "destructive", onPress: async () => {
                    try {
                        const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/group/${groupId}/members`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ members: groupDetails.members.filter(m => m._id !== userId) })
                        });
                        if (res.ok) router.replace('/social');
                    } catch (e) {
                        console.error(e);
                        Alert.alert("Error", "Failed to leave group");
                    }
                }
            }
        ]);
    };

    const handleDeleteMessage = (item) => {
        if (!isAdmin) return;
        Alert.alert("Delete Message", "Are you sure you want to delete this message?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        // Optimistic Remove
                        setOriginalFeed(prev => prev.filter(p => p._id !== item._id));

                        const endpoint = item.type === 'message' ? 'message' : 'announcement';
                        await fetch(`${API_BASE.replace('/auth', '/admin')}/${endpoint}/${item._id}`, {
                            method: 'DELETE'
                        });
                        // Socket will handle the rest for others
                    } catch (e) {
                        console.error("Delete failed", e);
                        Alert.alert("Error", "Failed to delete message");
                        fetchGroupData();
                    }
                }
            }
        ]);
    };

    const sendImageWithCaption = () => {
        if (selectedImageAsset) {
            createAnnouncementFromChat('image', selectedImageAsset, null, imageCaption);
        }
    };

    const handlePollCreate = () => {
        const validOptions = pollOptions.filter(o => o.trim().length > 0);
        if (!pollQuestion.trim() || validOptions.length < 2) {
            Alert.alert("Error", "Invalid Poll");
            return;
        }

        createAnnouncementFromChat('poll', null, {
            question: pollQuestion,
            options: validOptions.map(t => ({ text: t, votes: 0 }))
        });
        toggleMenu();
    };

    const handleVote = async (announcementId, optionIndex) => {
        if (!userId) {
            Alert.alert("Error", "You must be logged in to vote.");
            return;
        }

        console.log(`Voting on ${announcementId} for option ${optionIndex}`);

        setOriginalFeed(prev => prev.map(item => {
            if (item._id === announcementId && item.poll) {
                const newOptions = [...item.poll.options];
                const newUserVotes = item.poll.userVotes ? [...item.poll.userVotes] : [];
                const existingVoteIdx = newUserVotes.findIndex(v => v.userId === userId || v.userId?._id === userId);

                if (existingVoteIdx > -1) {
                    const oldOptionIndex = newUserVotes[existingVoteIdx].optionIndex;
                    if (oldOptionIndex === optionIndex) return item;

                    if (newOptions[oldOptionIndex].votes > 0) {
                        newOptions[oldOptionIndex] = { ...newOptions[oldOptionIndex], votes: newOptions[oldOptionIndex].votes - 1 };
                    }
                    newUserVotes[existingVoteIdx] = { ...newUserVotes[existingVoteIdx], optionIndex };
                } else {
                    newUserVotes.push({ userId, optionIndex });
                }

                newOptions[optionIndex] = { ...newOptions[optionIndex], votes: (newOptions[optionIndex].votes || 0) + 1 };
                return { ...item, poll: { ...item.poll, options: newOptions, userVotes: newUserVotes } };
            }
            return item;
        }));

        try {
            await fetch(`${API_BASE.replace('/auth', '/admin')}/announcement/${announcementId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, optionIndex })
            });
        } catch (e) {
            console.error("Vote failed", e);
            Alert.alert("Error", "Failed to submit vote");
        }
    };

    // --- Renderers ---

    const renderAnnouncement = (item, isMe) => {
        const hasPoll = !!item.poll;
        const hasImage = item.fileType === 'image';
        const hasVideo = item.fileType === 'video';
        const hasDoc = item.fileType === 'document';
        const isMedia = hasImage || hasVideo;

        let totalVotes = 0;
        if (hasPoll && item.poll.options) {
            totalVotes = item.poll.options.reduce((acc, curr) => acc + (curr.votes || 0), 0);
        }

        const showContent = item.content && item.content !== item.fileName;
        const timeColor = (isMedia && !showContent && !hasPoll && !item.title) ? theme.white : (isMe ? theme.white : theme.textSecondary);

        const timeContainerStyle = (isMedia && !showContent && !hasPoll && !item.title)
            ? { position: 'absolute', bottom: 5, right: 10, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }
            : { marginTop: 2, alignSelf: 'flex-end', marginLeft: 10 };

        return (
            <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <TouchableOpacity
                    onLongPress={() => handleDeleteMessage(item)}
                    activeOpacity={0.9}
                    style={[
                        styles.msgBubble,
                        isMe ? styles.msgMe : styles.msgOther,
                        { maxWidth: '85%' },
                        isMedia ? { padding: 3, paddingBottom: 3 } : { padding: 8 }
                    ]}
                >
                    {!isMe && (
                        <Text style={[styles.senderNameAdmin, isMedia ? { marginLeft: 5, marginTop: 5 } : {}]}>
                            Admin Announcement
                        </Text>
                    )}

                    {hasImage && (
                        <TouchableOpacity onPress={() => openImageViewer(`${BACKEND_URL}${item.fileUrl}`)}>
                            {/* <Image
                                source={{ uri: `${BACKEND_URL}${item.fileUrl}` }}
                                style={[styles.inlineImage, { marginBottom: (showContent || item.title) ? 5 : 0 }]}
                                resizeMode="cover"
                            /> */}
                            <Image
                                source={{ uri: `${BACKEND_URL}${item.fileUrl}` }}
                                style={[styles.inlineImage, { marginBottom: (showContent || item.title) ? 5 : 0 }]}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    )}

                    {hasVideo && (
                        <View style={{ marginBottom: (showContent || item.title) ? 5 : 0 }}>
                            <Video
                                style={styles.inlineImage}
                                source={{ uri: `${BACKEND_URL}${item.fileUrl}` }}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping={false}
                            />
                        </View>
                    )}

                    {(item.title || showContent || hasPoll) && (
                        <View style={{ paddingHorizontal: isMedia ? 5 : 0, paddingBottom: isMedia ? 5 : 0 }}>
                            {item.title && item.title !== 'Attachment' && item.title !== 'Poll' && !hasPoll && (
                                <Text style={styles.announcementTitle}>{item.title}</Text>
                            )}

                            {showContent && !hasPoll && (
                                <Text style={isMe ? styles.msgTextMe : styles.msgTextOther}>{item.content}</Text>
                            )}

                            {hasPoll && (
                                <View style={styles.pollBox}>
                                    <Text style={styles.pollQuestion}>{item.poll.question}</Text>
                                    {item.poll.options.map((opt, index) => {
                                        const percent = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                                        const userVotedForThis = item.poll.userVotes && item.poll.userVotes.some(v => (v.userId === userId || v.userId?._id === userId) && v.optionIndex === index);

                                        return (
                                            <TouchableOpacity key={index} style={[styles.pollOption, { borderColor: userVotedForThis ? theme.secondary : theme.border }]} onPress={() => handleVote(item._id, index)}>
                                                <View style={[styles.pollProgress, { width: `${percent}%`, backgroundColor: userVotedForThis ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.05)' }]} />
                                                <View style={styles.pollContent}>
                                                    <Ionicons name={userVotedForThis ? "checkbox" : "square-outline"} size={20} color={userVotedForThis ? theme.secondary : theme.textSecondary} style={{ marginRight: 8, zIndex: 1 }} />
                                                    <Text style={styles.pollOptionText}>{opt.text}</Text>
                                                    <Text style={styles.pollPercentText}>{percent}%</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    <Text style={styles.pollFooter}>{totalVotes} Votes • Tap to vote</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {hasDoc && (
                        <View style={{ padding: isMedia ? 5 : 0 }}>
                            <View style={styles.docBox}>
                                <View style={{ backgroundColor: 'rgba(211, 47, 47, 0.1)', padding: 8, borderRadius: 5 }}>
                                    <Ionicons name="document-text" size={30} color={theme.error || '#d32f2f'} />
                                </View>
                                <View style={{ marginLeft: 10, flex: 1 }}>
                                    <Text numberOfLines={1} style={[styles.docText, { color: theme.textPrimary }]}>{item.fileName || 'Document'}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                        <Text style={{ fontSize: 10, color: theme.textSecondary }}>
                                            {item.fileName?.split('.').pop().toUpperCase() || 'FILE'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'flex-end', gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL(`${BACKEND_URL}${item.fileUrl}`)}
                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: theme.border }}
                                >
                                    <Ionicons name="eye-outline" size={16} color={theme.textPrimary} />
                                    <Text style={{ marginLeft: 6, fontSize: 12, color: theme.textPrimary }}>Open</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => Linking.openURL(`${BACKEND_URL}${item.fileUrl}`)}
                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }}
                                >
                                    <Ionicons name="download-outline" size={16} color={theme.white} />
                                    <Text style={{ marginLeft: 6, fontSize: 12, color: theme.white }}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={timeContainerStyle}>
                        <Text style={{ fontSize: 10, color: timeColor }}>
                            {formatTime(item.createdAt)}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const renderMessage = (item, isMe) => {
        return (
            <View style={[styles.msgRow, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <TouchableOpacity
                    onLongPress={() => handleDeleteMessage(item)}
                    activeOpacity={0.9}
                    style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgOther]}
                >
                    {!isMe && <Text style={styles.senderName}>{item.sender?.name || 'User'}</Text>}
                    <Text style={isMe ? styles.msgTextMe : styles.msgTextOther}>{item.content}</Text>
                    <Text style={[styles.msgTime, isMe ? { color: theme.white } : { color: theme.textSecondary }]}>
                        {formatTime(item.createdAt)}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderItem = ({ item }) => {
        if (item.type === 'date-header') {
            return (
                <View style={styles.dateHeader}>
                    <Text style={styles.dateHeaderText}>{formatDate(item.date)}</Text>
                </View>
            );
        }

        const isMe = item.sender === userId || item.sender?._id === userId || (item.type === 'announcement' && isAdmin);

        if (item.type === 'announcement') {
            return renderAnnouncement(item, isMe);
        } else {
            return renderMessage(item, isMe);
        }
    };

    const insets = useSafeAreaInsets();

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <StatusBar style="light" backgroundColor={theme.primary} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 10 }}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setGroupInfoVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        {groupDetails.icon ? (
                            <Image source={{ uri: `${BACKEND_URL}${groupDetails.icon}` }} style={{ width: 35, height: 35, borderRadius: 20, marginRight: 10 }} />
                        ) : (
                            <View style={{ width: 35, height: 35, borderRadius: 20, backgroundColor: '#ccc', marginRight: 10, justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="people" size={20} color="#fff" />
                            </View>
                        )}
                        <View>
                            <Text style={styles.headerText} numberOfLines={1}>{groupDetails.name || groupName || 'Group Feed'}</Text>
                            <Text style={styles.headerSubText}>Tap for info</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ padding: 10 }}>
                    <Ionicons name="ellipsis-vertical" size={24} color="white" />
                </TouchableOpacity>
            </View>

            {/* Feed */}
            <FlatList
                ref={flatListRef}
                data={feedData}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>No messages yet</Text>}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
                }
            />

            {/* Input Area - Only for Admin */}
            {
                isAdmin && (
                    <View style={styles.inputContainer}>
                        {/* Attachment Button */}
                        <TouchableOpacity onPress={toggleMenu} style={styles.attachIconBtn}>
                            <Ionicons name="add-circle-outline" size={32} color="#005b96" />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            placeholder="Type an announcement..."
                            value={messageText}
                            onChangeText={setMessageText}
                            multiline
                        />

                        <TouchableOpacity onPress={sendMessage} style={styles.sendIconBtn}>
                            <Ionicons name="send" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                )
            }

            {/* Attachment Menu */}
            {
                menuVisible && (
                    <Animated.View style={[styles.menuContainer, { opacity: fadeAnim }]}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { toggleMenu(); pickDocAndSend(); }}>
                            <View style={[styles.menuIcon, { backgroundColor: '#512DA8' }]}>
                                <Ionicons name="document" size={24} color="white" />
                            </View>
                            <Text style={styles.menuText}>Document</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => { toggleMenu(); pickImageAndSend(); }}>
                            <View style={[styles.menuIcon, { backgroundColor: '#D81B60' }]}>
                                <Ionicons name="camera" size={24} color="white" />
                            </View>
                            <Text style={styles.menuText}>Camera/Gallery</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => { toggleMenu(); setPollModalVisible(true); }}>
                            <View style={[styles.menuIcon, { backgroundColor: '#FBC02D' }]}>
                                <Ionicons name="bar-chart" size={24} color="white" />
                            </View>
                            <Text style={styles.menuText}>Poll</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )
            }

            {/* Poll Creation Modal */}
            <Modal animationType="slide" transparent={true} visible={pollModalVisible} onRequestClose={() => setPollModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create Poll</Text>
                        <TextInput
                            placeholder="Ask a question..."
                            style={styles.modalInput}
                            value={pollQuestion}
                            onChangeText={setPollQuestion}
                        />
                        {pollOptions.map((opt, i) => (
                            <TextInput
                                key={i}
                                placeholder={`Option ${i + 1}`}
                                style={styles.modalInput}
                                value={opt}
                                onChangeText={t => {
                                    const newOpts = [...pollOptions];
                                    newOpts[i] = t;
                                    setPollOptions(newOpts);
                                }}
                            />
                        ))}
                        <TouchableOpacity onPress={() => setPollOptions([...pollOptions, ''])} style={{ marginBottom: 15 }}>
                            <Text style={{ color: '#005b96', fontWeight: 'bold' }}>+ Add Option</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <Button title="Cancel" onPress={() => setPollModalVisible(false)} color="#666" />
                            <View style={{ width: 10 }} />
                            <Button title="Create" onPress={handlePollCreate} color="#005b96" />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Full Screen Image Viewer Modal */}
            {/* Full Screen Image Viewer Modal */}
            {/* <Modal visible={viewerVisible} transparent={true} animationType="fade" onRequestClose={closeImageViewer}>
                <View style={{ flex: 1, backgroundColor: 'black' }}>
                    <StatusBar style="light" />
                    <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 999 }} onPress={closeImageViewer}>
                        <Ionicons name="close-circle" size={40} color="white" />
                    </TouchableOpacity>
                    {viewerImage && (
                        <Text style={{color: 'white', alignSelf: 'center', marginTop: 100}}>Image Viewing Disabled</Text>
                    )}
                </View>
            </Modal> */}

            {/* Image Caption Modal */}
            <Modal visible={captionModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Send Image</Text>
                        {selectedImageAsset && (
                            <Image
                                source={{ uri: selectedImageAsset.uri }}
                                style={{ width: '100%', height: 200, borderRadius: 10, marginBottom: 10 }}
                                resizeMode="contain"
                            />
                        )}
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Add a caption..."
                            value={imageCaption}
                            onChangeText={setImageCaption}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                            <Button title="Cancel" color="red" onPress={() => setCaptionModalVisible(false)} />
                            <View style={{ width: 10 }} />
                            <Button title="Send" onPress={sendImageWithCaption} />
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Options Menu Modal */}
            <Modal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' }} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
                    <View style={{ position: 'absolute', top: 60, right: 10, backgroundColor: 'white', elevation: 5, borderRadius: 5, padding: 5, width: 170 }}>
                        {isAdmin ? (
                            <>
                                <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOptionsVisible(false); setRenameVisible(true); }}>
                                    <Text style={{ fontSize: 16 }}>Rename Group</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ padding: 10 }} onPress={handleUpdateGroupIcon}>
                                    <Text style={{ fontSize: 16 }}>Group Icon</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOptionsVisible(false); fetchAllUsers(); setManageUsersVisible(true); }}>
                                    <Text style={{ fontSize: 16 }}>Manage User</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity style={{ padding: 10 }} onPress={() => { setOptionsVisible(false); handleExitGroup(); }}>
                                <Text style={{ fontSize: 16, color: 'red' }}>Exit Group</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Rename Modal */}
            <Modal visible={renameVisible} transparent animationType="slide" onRequestClose={() => setRenameVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rename Group</Text>
                        <TextInput style={styles.modalInput} value={newName} onChangeText={setNewName} placeholder="Group Name" />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                            <Button title="Cancel" color="red" onPress={() => setRenameVisible(false)} />
                            <View style={{ width: 10 }} />
                            <Button title="Save" onPress={handleUpdateGroupName} />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Manage Users Modal */}
            <Modal visible={manageUsersVisible} transparent animationType="slide" onRequestClose={() => setManageUsersVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%', width: '90%' }]}>
                        <Text style={styles.modalTitle}>Manage Users</Text>
                        <FlatList
                            data={allUsers}
                            keyExtractor={item => item._id}
                            renderItem={({ item }) => {
                                const isMember = groupDetails.members && groupDetails.members.some(m => m._id === item._id || m === item._id);
                                return (
                                    <TouchableOpacity onPress={() => handleToggleUser(item._id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#eee' }}>
                                        <Ionicons name={isMember ? "checkbox" : "square-outline"} size={24} color={isMember ? "#005b96" : "#aaa"} />
                                        <Text style={{ marginLeft: 10, fontSize: 16 }}>{item.name}</Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <View style={{ marginTop: 10 }}>
                            <Button title="Done" onPress={() => setManageUsersVisible(false)} />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Group Info Modal (WhatsApp Style) */}
            <Modal visible={groupInfoVisible} animationType="slide" onRequestClose={() => setGroupInfoVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
                    {/* Modal Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, paddingTop: insets.top + 10, backgroundColor: 'white', elevation: 2 }}>
                        <TouchableOpacity onPress={() => setGroupInfoVisible(false)}>
                            <Ionicons name="arrow-back" size={24} color="#333" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 20 }}>Group Info</Text>
                    </View>

                    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                        {/* Group Icon & Name */}
                        <View style={{ backgroundColor: 'white', alignItems: 'center', padding: 20, marginBottom: 10 }}>
                            {groupDetails.icon ? (
                                <Image source={{ uri: `${BACKEND_URL}${groupDetails.icon}` }} style={{ width: 120, height: 120, borderRadius: 60 }} />
                            ) : (
                                <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="people" size={60} color="#888" />
                                </View>
                            )}
                            <Text style={{ fontSize: 22, fontWeight: 'bold', marginTop: 15 }}>{groupDetails.name || 'Group Name'}</Text>
                            <Text style={{ color: '#666', marginTop: 5 }}>Group • {groupDetails.members ? groupDetails.members.length : 0} participants</Text>
                        </View>

                        {/* Description (Optional) */}
                        {groupDetails.description && (
                            <View style={{ backgroundColor: 'white', padding: 15, marginBottom: 10 }}>
                                <Text style={{ color: '#005b96', fontWeight: 'bold', marginBottom: 5 }}>Description</Text>
                                <Text style={{ fontSize: 16 }}>{groupDetails.description}</Text>
                            </View>
                        )}

                        {/* Participants List */}
                        <View style={{ backgroundColor: 'white', padding: 15 }}>
                            <Text style={{ color: '#005b96', fontWeight: 'bold', marginBottom: 10 }}>{groupDetails.members ? groupDetails.members.length : 0} Participants</Text>
                            {groupDetails.members && groupDetails.members.map((member, i) => (
                                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < groupDetails.members.length - 1 ? 1 : 0, borderColor: '#eee' }}>
                                    {member.profilePic ? (
                                        <Image source={{ uri: `${BACKEND_URL}${member.profilePic}` }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                                    ) : (
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' }}>
                                            <Ionicons name="person" size={20} color="#fff" />
                                        </View>
                                    )}
                                    <View style={{ marginLeft: 15 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{member.name || 'User'}</Text>
                                        <Text style={{ fontSize: 13, color: '#666' }}>{member.email}</Text>
                                    </View>
                                    {isAdmin && <Text style={{ marginLeft: 'auto', color: '#005b96', fontSize: 12 }}>Admin</Text>}
                                </View>
                            ))}
                        </View>

                        {/* Footer Actions */}
                        <TouchableOpacity style={{ backgroundColor: 'white', marginTop: 10, padding: 15, flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="log-out-outline" size={24} color="#d32f2f" />
                            <Text style={{ color: '#d32f2f', fontSize: 16, marginLeft: 15, fontWeight: 'bold' }}>Exit Group</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

function getStyles(theme) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { backgroundColor: theme.primary, padding: 15, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', elevation: 5 },
        headerText: { color: theme.white, fontSize: 20, fontWeight: 'bold' },
        headerSubText: { color: theme.textLight, fontSize: 12 },

        // Date Header
        dateHeader: { alignItems: 'center', marginVertical: 10 },
        dateHeaderText: { backgroundColor: theme.inputBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, color: theme.textSecondary, fontSize: 11, overflow: 'hidden' },

        // Messages
        msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5, paddingHorizontal: 10 },
        msgBubble: { borderRadius: 16, padding: 10, maxWidth: '85%', elevation: 1, overflow: 'hidden' },

        // Me: Secondary (Blue), White Text
        msgMe: { backgroundColor: theme.secondary, alignSelf: 'flex-end', borderBottomRightRadius: 2 },
        // Other: Surface/White, Text Primary
        msgOther: { backgroundColor: theme.surface || theme.white, alignSelf: 'flex-start', borderBottomLeftRadius: 2 },

        senderName: { fontSize: 11, color: theme.accent, fontWeight: 'bold', marginBottom: 2 },
        senderNameAdmin: { fontSize: 11, color: theme.error, fontWeight: 'bold', marginBottom: 2 },

        msgTextMe: { color: theme.white, fontSize: 16 },
        msgTextOther: { color: theme.textPrimary, fontSize: 16 },

        msgTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4, color: theme.textSecondary },

        // Announcement Specific
        announcementTitle: { fontWeight: 'bold', fontSize: 15, marginBottom: 4, color: theme.textPrimary },
        inlineImage: { width: 250, height: 300, marginBottom: 0, backgroundColor: theme.inputBg },
        docBox: { flexDirection: 'row', alignItems: 'center', marginVertical: 5, backgroundColor: 'rgba(0,0,0,0.02)', padding: 8, borderRadius: 8, width: 250, borderWidth: 1, borderColor: theme.border },
        docText: { marginLeft: 10, fontWeight: '600', fontSize: 14, color: theme.textPrimary },

        pollBox: { marginVertical: 5, width: 230 },
        pollQuestion: { fontWeight: 'bold', fontSize: 16, marginBottom: 10, color: theme.textPrimary },
        pollOption: { backgroundColor: theme.inputBg, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', height: 45, justifyContent: 'center' },
        pollProgress: { position: 'absolute', height: '100%', backgroundColor: 'rgba(3, 57, 108, 0.1)' },
        pollContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, alignItems: 'center', width: '100%' },
        pollOptionText: { fontSize: 14, zIndex: 1, color: theme.textPrimary, fontWeight: '500' },
        pollPercentText: { fontSize: 13, fontWeight: 'bold', color: theme.secondary, zIndex: 1 },
        pollFooter: { fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 6 },

        // Input
        inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: theme.surface, minHeight: 60, borderTopWidth: 1, borderTopColor: theme.border },
        attachIconBtn: { padding: 8 },
        input: { flex: 1, backgroundColor: theme.inputBg, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, maxHeight: 100, borderWidth: 0, color: theme.textPrimary },
        sendIconBtn: { backgroundColor: theme.secondary, width: 45, height: 45, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },

        // Attachment Menu
        menuContainer: { position: 'absolute', bottom: 80, left: 15, backgroundColor: theme.surface, padding: 20, borderRadius: 20, elevation: 10, width: 220, shadowColor: theme.shadow, shadowOffset: { height: 5 }, shadowOpacity: 0.2, shadowRadius: 10 },
        menuItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
        menuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        menuText: { fontSize: 16, color: theme.textPrimary, fontWeight: '500' },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
        modalContent: { backgroundColor: theme.surface, padding: 25, borderRadius: 20, width: '85%', elevation: 10 },
        modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: theme.textPrimary },
        modalInput: { borderBottomWidth: 1, borderBottomColor: theme.border, padding: 10, marginBottom: 15, fontSize: 16, color: theme.textPrimary },

    });
}
