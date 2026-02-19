import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, Dimensions, ScrollView, Modal, Alert, TextInput, KeyboardAvoidingView, Platform, Animated, PanResponder, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../services/apiService';
import { useSocket } from '../../context/SocketContext';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import io from 'socket.io-client';
import PostItem from './PostItem';
import ShareModal from './modals/ShareModal';
import CommentsModal from './modals/CommentsModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_COUNT = 3;
const ITEM_SIZE = SCREEN_WIDTH / COLUMN_COUNT;
const SERVER_ROOT = API_BASE.replace('/api/auth', '');

const MOCK_PROFILE_POSTS = Array.from({ length: 12 }).map((_, i) => ({
    id: String(i),
    url: `https://picsum.photos/300/300?random=${i + 10}`
}));

export default function SocialProfile({ theme, onCreateStatus, onCreateReel, refreshTrigger }) {
    const { userProfile } = useSocket();
    const [activeTab, setActiveTab] = useState('grid');
    const [myReels, setMyReels] = useState([]);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [myPosts, setMyPosts] = useState([]);
    const [user, setUser] = useState({ name: userProfile.name, profilePic: userProfile.profilePic });
    const [currentUserId, setCurrentUserId] = useState(null);
    const [createMenuVisible, setCreateMenuVisible] = useState(false);

    // Preview Modal State
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [selectedReel, setSelectedReel] = useState(null);

    // Interaction Modals
    const [commentsVisible, setCommentsVisible] = useState(false);
    const [shareVisible, setShareVisible] = useState(false);
    const [postDetailVisible, setPostDetailVisible] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);

    useEffect(() => {
        loadUserProfile();
        fetchMyReels();
        fetchMyPosts();
    }, [refreshTrigger]);

    const loadUserProfile = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (userId) {
                const res = await fetch(`${API_BASE}/user/${userId}`);
                const data = await res.json();
                if (res.ok) setUser(data);
                setCurrentUserId(userId);
            }
        } catch (e) { console.error(e); }
    };

    const fetchMyReels = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/reels/user/${userId}`);
            const data = await res.json();
            if (Array.isArray(data)) setMyReels(data);
        } catch (e) { console.error(e); }
    };

    const fetchMyPosts = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/posts/user/${userId}`);
            const data = await res.json();
            if (Array.isArray(data)) setMyPosts(data);
        } catch (e) { console.error(e); }
    };

    const handlePostPress = (post) => {
        setSelectedPost(post);
        setPostDetailVisible(true);
    };

    const handleReelPress = (reel) => {
        setSelectedReel(reel);
        setPreviewModalVisible(true);
    };

    const handleLikeReel = async () => {
        if (!selectedReel) return;
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/reels/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reelId: selectedReel._id, userId })
            });
            const data = await res.json();
            if (res.ok) {
                const updatedLikes = data.likes;
                const updatedReel = { ...selectedReel, likes: updatedLikes };
                setSelectedReel(updatedReel);
                setMyReels(prev => prev.map(r => r._id === selectedReel._id ? updatedReel : r));
            }
        } catch (e) { console.error(e); }
    };

    const handleDeleteReel = async () => {
        Alert.alert(
            "Delete Reel",
            "Are you sure you want to delete this reel?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const userId = await AsyncStorage.getItem('userId');
                            const reelId = selectedReel?._id || selectedReel?.id;

                            if (!reelId) {
                                Alert.alert("Error", "Invalid reel selection");
                                return;
                            }

                            const res = await fetch(`${API_BASE}/reels/delete`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reelId, userId })
                            });

                            if (res.ok) {
                                setMyReels(prev => prev.filter(r => (r._id || r.id) !== reelId));
                                setPreviewModalVisible(false);
                                Alert.alert("Success", "Reel deleted");
                            } else {
                                const data = await res.json();
                                Alert.alert("Error", data.error || "Failed to delete");
                            }
                        } catch (e) {
                            Alert.alert("Error", e.message);
                        }
                    }
                }
            ]
        );
    };

    const handleAddComment = async (text) => {
        const isReel = !!selectedReel && previewModalVisible;
        const targetId = isReel ? selectedReel?._id : selectedPost?._id;

        if (!targetId || !text.trim()) {
            console.warn(`[SocialProfile] Cannot add comment: targetId=${targetId}, text=${text}`);
            return;
        }

        try {
            const userId = await AsyncStorage.getItem('userId');
            const endpoint = isReel ? `${API_BASE}/reels/comment` : `${API_BASE}/posts/comment`;
            const body = isReel
                ? { userId, reelId: targetId, text }
                : { postId: targetId, userId, text };

            console.log(`[SocialProfile] ${isReel ? 'Reel' : 'Post'} comment to ${endpoint}`, body);

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`[SocialProfile] Server error (${res.status}):`, errorText);
                throw new Error(`Server returned ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                if (isReel) {
                    const updatedReel = { ...selectedReel, comments: data.comments };
                    setSelectedReel(updatedReel);
                    setMyReels(prev => prev.map(r => r._id === selectedReel._id ? updatedReel : r));
                } else {
                    const updatedPost = { ...selectedPost, comments: data.comments };
                    setSelectedPost(updatedPost);
                    setMyPosts(prev => prev.map(p => p._id === selectedPost._id ? updatedPost : p));
                }
            }
        } catch (e) {
            console.error("[SocialProfile] Add comment error:", e);
            Alert.alert("Error", `Could not add comment: ${e.message}`);
        }
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <Ionicons name="lock-closed-outline" size={16} color={theme.textPrimary} style={{ marginRight: 5 }} />
                <Text style={[styles.usernameHeader, { color: theme.textPrimary }]}>{user.name}</Text>
                <Ionicons name="chevron-down" size={16} color={theme.textPrimary} />
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={{ marginRight: 20 }} onPress={() => setCreateMenuVisible(true)}>
                    <Ionicons name="add-circle-outline" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSettingsVisible(true)}>
                    <Ionicons name="menu-outline" size={28} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Profile Info Row */}
            <View style={styles.profileInfoRow}>
                <View style={styles.avatarWrapper}>
                    <LinearGradient
                        colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
                        style={styles.avatarGradient}
                    />
                    <View style={[styles.avatarContainer, { backgroundColor: theme.surface }]}>
                        {user.profilePic ? (
                            <Image source={{ uri: `${SERVER_ROOT}${user.profilePic}` }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.textSecondary }}>{user.name?.[0]?.toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{user.postsCount || 0}</Text>
                        <Text style={[styles.statLabel, { color: theme.textPrimary }]}>Posts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{user.followers?.length || 0}</Text>
                        <Text style={[styles.statLabel, { color: theme.textPrimary }]}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: theme.textPrimary }]}>{user.following?.length || 0}</Text>
                        <Text style={[styles.statLabel, { color: theme.textPrimary }]}>Following</Text>
                    </View>
                </View>
            </View>

            {/* Bio */}
            <View style={styles.bioContainer}>
                <Text style={[styles.displayName, { color: theme.textPrimary }]}>{user.name}</Text>
                {user.bio ? (
                    <Text style={[styles.bioText, { color: theme.textPrimary }]}>{user.bio}</Text>
                ) : (
                    <Text style={[styles.bioText, { color: theme.textSecondary, fontStyle: 'italic' }]}>No bio yet.</Text>
                )}
                {user.website && (
                    <Text style={[styles.bioText, { color: '#00376b', fontWeight: '500' }]}>{user.website}</Text>
                )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.inputBg }]}>
                    <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Edit profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.inputBg }]}>
                    <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Share profile</Text>
                </TouchableOpacity>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity onPress={() => setActiveTab('grid')} style={[styles.tabItem, activeTab === 'grid' && { borderBottomColor: theme.textPrimary }]}>
                    <Ionicons name="grid-outline" size={24} color={activeTab === 'grid' ? theme.textPrimary : theme.textLight} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('reels')} style={[styles.tabItem, activeTab === 'reels' && { borderBottomColor: theme.textPrimary }]}>
                    <Ionicons name="videocam-outline" size={24} color={activeTab === 'reels' ? theme.textPrimary : theme.textLight} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('tagged')} style={[styles.tabItem, activeTab === 'tagged' && { borderBottomColor: theme.textPrimary }]}>
                    <Ionicons name="person-outline" size={24} color={activeTab === 'tagged' ? theme.textPrimary : theme.textLight} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const isLiked = selectedReel?.likes && currentUserId && selectedReel.likes.includes(currentUserId);

    return (
        <View style={[styles.container, { backgroundColor: theme.surface }]}>
            <FlatList
                data={activeTab === 'grid' ? myPosts : (activeTab === 'reels' ? myReels : [])}
                keyExtractor={item => item.id || item._id}
                numColumns={3}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.gridItem}
                        onPress={() => activeTab === 'reels' ? handleReelPress(item) : handlePostPress(item)}
                    >
                        {activeTab === 'grid' ? (
                            <Image source={{ uri: item.mediaUrl?.startsWith('http') ? item.mediaUrl : `${SERVER_ROOT}${item.mediaUrl || ''}` }} style={styles.gridImage} />
                        ) : (
                            <View style={{ flex: 1 }}>
                                <Video
                                    source={{ uri: item.url?.startsWith('http') ? item.url : `${SERVER_ROOT}${item.url || ''}` }}
                                    style={styles.gridImage}
                                    resizeMode="cover"
                                    shouldPlay={false}
                                    isMuted={true}
                                />
                                <View style={{ position: 'absolute', bottom: 5, left: 5 }}>
                                    <Ionicons name="play-outline" size={16} color="white" />
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={() => (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: theme.textSecondary }}>
                            {activeTab === 'reels' ? 'No reels yet' : 'No posts yet'}
                        </Text>
                    </View>
                )}
            />

            {/* Post Detail Modal */}
            <Modal
                visible={postDetailVisible}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setPostDetailVisible(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: theme.surface }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <TouchableOpacity onPress={() => setPostDetailVisible(false)}>
                            <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary, marginLeft: 20 }}>Post</Text>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {selectedPost && (
                            <PostItem
                                post={{
                                    ...selectedPost,
                                    user: selectedPost.user || user // Ensure user info is present
                                }}
                                theme={theme}
                                onOpenComments={() => setCommentsVisible(true)}
                                onOpenShare={() => setShareVisible(true)}
                            />
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Create Menu */}
            <Modal
                transparent={true}
                visible={createMenuVisible}
                animationType="fade"
                onRequestClose={() => setCreateMenuVisible(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setCreateMenuVisible(false)}
                >
                    <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 20, textAlign: 'center' }}>Create</Text>

                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: theme.border }}
                            onPress={() => {
                                setCreateMenuVisible(false);
                                if (onCreateStatus) onCreateStatus();
                            }}
                        >
                            <Ionicons name="images-outline" size={24} color={theme.textPrimary} style={{ marginRight: 15 }} />
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Post</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: theme.border }}
                            onPress={() => {
                                setCreateMenuVisible(false);
                                if (onCreateReel) onCreateReel();
                            }}
                        >
                            <Ionicons name="videocam-outline" size={24} color={theme.textPrimary} style={{ marginRight: 15 }} />
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Reel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, marginTop: 10 }}
                            onPress={() => setCreateMenuVisible(false)}
                        >
                            <Ionicons name="close-circle-outline" size={24} color="red" style={{ marginRight: 15 }} />
                            <Text style={{ fontSize: 16, color: 'red' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Reel Preview Modal */}
            <Modal
                visible={previewModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPreviewModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'black' }}>
                    {selectedReel && (
                        <>
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 40, left: 20, zIndex: 10 }}
                                onPress={() => setPreviewModalVisible(false)}
                            >
                                <Ionicons name="arrow-back" size={28} color="white" />
                            </TouchableOpacity>

                            <Video
                                source={{ uri: selectedReel.url.startsWith('http') ? selectedReel.url : `${SERVER_ROOT}${selectedReel.url}` }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                                shouldPlay={true}
                                isLooping
                            />

                            {/* Right Side Actions */}
                            <View style={{ position: 'absolute', bottom: 100, right: 10, alignItems: 'center', zIndex: 20 }}>
                                <TouchableOpacity style={{ marginBottom: 30 }} onPress={handleLikeReel}>
                                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={32} color={isLiked ? "red" : "white"} />
                                    <Text style={{ color: 'white', marginTop: 5 }}>{selectedReel.likes?.length || 0}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={{ marginBottom: 30 }} onPress={() => setCommentsVisible(true)}>
                                    <Ionicons name="chatbubble-outline" size={30} color="white" />
                                    <Text style={{ color: 'white', marginTop: 5 }}>{selectedReel.comments?.length || 0}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={{ marginBottom: 30 }} onPress={() => setShareVisible(true)}>
                                    <Ionicons name="paper-plane-outline" size={30} color="white" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{ marginBottom: 30, backgroundColor: 'rgba(255,0,0,0.8)', padding: 10, borderRadius: 25 }}
                                    onPress={handleDeleteReel}
                                >
                                    <Ionicons name="trash-outline" size={24} color="white" />
                                </TouchableOpacity>
                            </View>

                            <View style={{ position: 'absolute', bottom: 20, left: 10, right: 60, zIndex: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                                        {user.profilePic ? (
                                            <Image
                                                source={{ uri: `${SERVER_ROOT}${user.profilePic}` }}
                                                style={{ width: '100%', height: '100%' }}
                                            />
                                        ) : (
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{user.name?.[0]?.toUpperCase()}</Text>
                                        )}
                                    </View>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>{user.name}</Text>
                                </View>
                                <Text style={{ color: 'white', fontSize: 14 }}>{selectedReel.caption}</Text>
                            </View>
                        </>
                    )}
                </View>
            </Modal>

            {/* Settings Modal */}
            <Modal
                visible={settingsVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setSettingsVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPress={() => setSettingsVisible(false)}
                >
                    <View style={[styles.settingsSheet, { backgroundColor: theme.surface }]}>
                        <View style={styles.sheetGrabber} />
                        <Text style={[styles.settingsTitle, { color: theme.textPrimary }]}>Settings and activity</Text>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
                            <TouchableOpacity style={styles.settingsItem}>
                                <Ionicons name="settings-outline" size={24} color={theme.textPrimary} />
                                <Text style={[styles.settingsText, { color: theme.textPrimary }]}>Settings and privacy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.settingsItem}>
                                <Ionicons name="time-outline" size={24} color={theme.textPrimary} />
                                <Text style={[styles.settingsText, { color: theme.textPrimary }]}>Your activity</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.settingsItem}>
                                <Ionicons name="archive-outline" size={24} color={theme.textPrimary} />
                                <Text style={[styles.settingsText, { color: theme.textPrimary }]}>Archive</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.settingsItem}>
                                <Ionicons name="qr-code-outline" size={24} color={theme.textPrimary} />
                                <Text style={[styles.settingsText, { color: theme.textPrimary }]}>QR code</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.settingsItem}>
                                <Ionicons name="bookmark-outline" size={24} color={theme.textPrimary} />
                                <Text style={[styles.settingsText, { color: theme.textPrimary }]}>Saved</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.settingsItem}>
                                <Ionicons name="list-outline" size={24} color={theme.textPrimary} />
                                <Text style={[styles.settingsText, { color: theme.textPrimary }]}>Close Friends</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.settingsItem}>
                                <Ionicons name="star-outline" size={24} color={theme.textPrimary} />
                                <Text style={[styles.settingsText, { color: theme.textPrimary }]}>Favorites</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Global Modals for both Posts and Reels */}
            <CommentsSheet
                visible={commentsVisible}
                onClose={() => setCommentsVisible(false)}
                comments={(previewModalVisible ? selectedReel : selectedPost)?.comments || []}
                onAddComment={handleAddComment}
            />

            <ShareSheet
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                currentUser={{ _id: currentUserId }}
                selectedReel={previewModalVisible ? selectedReel : selectedPost}
            />
        </View>
    );
}

// Comments Component
const CommentsSheet = ({ visible, onClose, comments, onAddComment }) => {
    const [text, setText] = useState('');
    const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        } else {
            Animated.timing(slideAnim, { toValue: Dimensions.get('window').height, duration: 200, useNativeDriver: true }).start();
        }
    }, [visible]);

    const handleSend = () => {
        if (text.trim()) {
            onAddComment(text);
            setText('');
        }
    };

    if (!visible) return null;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            style={styles.commentOverlay}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 25}
        >
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
            <Animated.View style={[styles.commentSheet, { transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.commentHeader}>
                    <Text style={styles.commentTitle}>Comments</Text>
                </View>
                <FlatList
                    data={comments}
                    keyExtractor={(item, index) => index.toString()}
                    style={styles.commentList}
                    renderItem={({ item }) => (
                        <View style={styles.commentItem}>
                            <View style={styles.commentAvatar}>
                                <Ionicons name="person-circle" size={32} color="#ccc" />
                            </View>
                            <View style={styles.commentContent}>
                                <Text style={styles.commentUser}>{item.user?.name || 'User'}</Text>
                                <Text style={styles.commentText}>{item.text}</Text>
                            </View>
                        </View>
                    )}
                />
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Add a comment..."
                        placeholderTextColor="#aaa"
                        value={text}
                        onChangeText={setText}
                        returnKeyType="send"
                        onSubmitEditing={handleSend}
                    />
                    <TouchableOpacity onPress={handleSend}>
                        <Text style={styles.sendText}>Post</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </KeyboardAvoidingView>
    );
};

// Share Component
const ShareSheet = ({ visible, onClose, currentUser, selectedReel }) => {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [sentUsers, setSentUsers] = useState([]);
    const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
    const socket = useRef(null);

    useEffect(() => {
        if (visible) {
            fetchUsers();
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();

            // Socket
            const socketUrl = API_BASE.replace('/api/auth', '');
            socket.current = io(socketUrl);
            socket.current.emit('join', currentUser?._id);

        } else {
            Animated.timing(slideAnim, { toValue: Dimensions.get('window').height, duration: 200, useNativeDriver: true }).start();
            if (socket.current) socket.current.disconnect();
        }
    }, [visible]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/community/users`);
            const data = await res.json();
            if (Array.isArray(data)) setUsers(data.filter(u => u._id !== currentUser._id));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = (userId) => {
        setSentUsers(prev => [...prev, userId]);
        if (socket.current && selectedReel) {
            const reelUrl = selectedReel.url.startsWith('http') ? selectedReel.url : `${SERVER_ROOT}${selectedReel.url}`;
            socket.current.emit('sendMessage', {
                sender: currentUser._id,
                recipient: userId,
                content: reelUrl,
                type: 'reel'
            });
        }
    };

    if (!visible) return null;

    const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <View style={styles.commentOverlay}>
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
            <Animated.View style={[styles.commentSheet, { transform: [{ translateY: slideAnim }] }]}>
                <View style={[styles.commentHeader, { borderBottomWidth: 0 }]}>
                    <Text style={styles.commentTitle}>Share to</Text>
                </View>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#8E8E93" style={{ marginRight: 10 }} />
                    <TextInput
                        style={{ flex: 1, color: 'white' }}
                        placeholder="Search"
                        placeholderTextColor="#8E8E93"
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                {loading ? <ActivityIndicator color="white" /> : (
                    <FlatList
                        data={filtered}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => {
                            const isSent = sentUsers.includes(item._id);
                            return (
                                <TouchableOpacity style={styles.userItem} onPress={() => !isSent && handleSend(item._id)}>
                                    <View style={{ marginRight: 15 }}>
                                        {item.profilePic ? (
                                            <Image source={{ uri: `${API_BASE.replace('/api/auth', '')}${item.profilePic}` }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                                        ) : (
                                            <Ionicons name="person-circle" size={44} color="#ccc" />
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>{item.name}</Text>
                                    </View>
                                    <View style={[styles.sendButton, isSent && styles.sentButton]}>
                                        <Text style={{ color: isSent ? '#8E8E93' : 'white', fontWeight: 'bold' }}>{isSent ? 'Sent' : 'Send'}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        paddingTop: 10,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    usernameHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        marginRight: 5,
    },
    profileInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    avatarWrapper: {
        width: 86,
        height: 86,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 20,
    },
    avatarGradient: {
        position: 'absolute',
        width: 86,
        height: 86,
        borderRadius: 43,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        padding: 3,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
    },
    statsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 13,
    },
    bioContainer: {
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    displayName: {
        fontWeight: 'bold',
        marginBottom: 2,
    },
    bioText: {
        lineHeight: 18,
    },
    actionButtons: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    mainBtn: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    tabBar: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderTopColor: '#dbdbdb', // Or theme border
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'transparent',
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        padding: 2, // Increased spacing
    },
    gridImage: {
        width: '100%',
        height: '100%',
        backgroundColor: '#2C2C2E', // Placeholder color if image fails
    },
    // Modal & Comment Styles
    commentOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    commentSheet: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '60%',
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 100 : 90, // Clear the bottom nav bar (85px)
    },
    commentHeader: {
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#3A3A3C',
        paddingBottom: 10,
    },
    commentTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    commentList: {
        flex: 1,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    commentAvatar: {
        marginRight: 10,
    },
    commentContent: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 10,
    },
    commentUser: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 2,
    },
    commentText: {
        color: 'white',
        fontSize: 14,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        borderTopWidth: 0.5,
        borderTopColor: '#3A3A3C',
        paddingTop: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: 'white',
        marginRight: 10,
    },
    sendText: {
        color: '#007AFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 15
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    sendButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 5
    },
    sentButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#3A3A3C'
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    settingsSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '70%',
        paddingHorizontal: 20,
    },
    sheetGrabber: {
        width: 40,
        height: 5,
        backgroundColor: '#48484a',
        borderRadius: 2.5,
        alignSelf: 'center',
        marginVertical: 12,
    },
    settingsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    settingsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    settingsText: {
        fontSize: 16,
        marginLeft: 15,
    }
});
