import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Alert, Animated, Image, TouchableOpacity, ScrollView, Easing, KeyboardAvoidingView, Platform, RefreshControl, ActivityIndicator, Dimensions, FlatList, PanResponder, StatusBar, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import CreatePostModal from '../../src/components/social/modals/CreatePostModal';

import { Colors } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useSocket } from '../../src/context/SocketContext';
import DateTimePicker from '@react-native-community/datetimepicker';

// Components
import PillSwitcher from '../../src/components/ui/PillSwitcher';
import BottomNavBar from '../../src/components/navigation/BottomNavBar';
import PersonalChats from '../../src/components/views/PersonalChats';
import SocialChats from '../../src/components/views/SocialChats';
import SocialFeed from '../../src/components/social/SocialFeed';
import ReelsView from '../../src/components/social/ReelsView';
import SocialProfile from '../../src/components/social/SocialProfile';

import GroupDiscussionScreen from '../gd/index';
import AnnouncementGroupsScreen from '../announcement/index';
import AdminDashboard from '../admin/index';

const SERVER_URL = "http://192.168.29.129:5000";
const { width, height } = Dimensions.get('window');

export default function CommunityScreen() {
    const router = useRouter();
    const params = useLocalSearchParams(); // Get params
    const { colors, activeMode } = useTheme(); // Use global activeMode
    const { socket, onlineUsers, unreadCounts, lastMessages, markAsRead, userProfile, setUserProfile, userId: currentUserId, setUserId } = useSocket();
    const theme = colors || Colors;
    const styles = getStyles(theme);
    // --- State ---
    // activeMode is now global
    const [activeTab, setActiveTab] = useState('chats');

    // Handle initial tab from params
    useEffect(() => {
        if (params?.tab) {
            setActiveTab(params.tab);
        }
    }, [params?.tab]);

    // Reset tab when mode changes (only if no param override in this render cycle, but param persists so it might stick.
    // For now, let's keep the existing mode switch logic but maybe prioritize param if it just arrived?
    // Actually, simply adding the param check is usually enough if the navigation passes it.
    useEffect(() => {
        if (activeMode === 'personal' && !params?.tab) setActiveTab('chats');
        else if (activeMode === 'work') setActiveTab('home');
        else if (activeMode === 'social') setActiveTab('home');
    }, [activeMode]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSidebar, setShowSidebar] = useState(false);
    const [archivedChatIds, setArchivedChatIds] = useState([]);
    const [deletedChatIds, setDeletedChatIds] = useState([]);
    const [blockedUserIds, setBlockedUserIds] = useState([]);
    const [isSearchVisible, setIsSearchVisible] = useState(false);

    // Clear search when switching modes
    useEffect(() => {
        setSearchQuery('');
    }, [activeMode]);

    // Sync activeTab when switching modes
    useEffect(() => {
        // Mode switch animation
        Animated.sequence([
            Animated.timing(contentFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(contentFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
        ]).start();

        // Mode specific defaults
        if (activeMode === 'personal') setActiveTab('chats');
        else if (activeMode === 'social') setActiveTab('home');
        else if (activeMode === 'work') setActiveTab('home');
    }, [activeMode]);
    const userName = userProfile.name;
    const profilePic = userProfile.profilePic;
    const [showProfileMenu, setShowProfileMenu] = useState(false); // We'll keep the state for now to avoid breaking references if any, but it won't be used by the header. Actually, I'll remove it.
    const slideAnim = useRef(new Animated.Value(-50)).current;
    const contentFadeAnim = useRef(new Animated.Value(1)).current;
    const searchAnim = useRef(new Animated.Value(0)).current; // 0 = Closed, 1 = Open
    const socialFlatListRef = useRef(null);

    // Search Animation Effect
    useEffect(() => {
        Animated.timing(searchAnim, {
            toValue: isSearchVisible ? 1 : 0,
            duration: 300,
            useNativeDriver: false, // width/layout changes need false
            easing: Easing.bezier(0.25, 0.1, 0.25, 1)
        }).start();
    }, [isSearchVisible]);

    // Data
    const [users, setUsers] = useState([]);
    const [personalGroups, setPersonalGroups] = useState([]);

    // Status State
    const [groupedStatuses, setGroupedStatuses] = useState([]);
    const [textStatusVisible, setTextStatusVisible] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [statusColor, setStatusColor] = useState('#007AFF');
    const STATUS_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55', '#8E8E93', '#000000'];
    const [viewStatusModalVisible, setViewStatusModalVisible] = useState(false);
    const [currentUserStories, setCurrentUserStories] = useState([]);
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const pausedValue = useRef(0);
    const isPaused = useRef(false);

    // Create Post State
    const [communities, setCommunities] = useState([]); // New State
    const [createPostVisible, setCreatePostVisible] = useState(false);
    const [newPostMedia, setNewPostMedia] = useState(null);
    const [newPostType, setNewPostType] = useState('image');

    // Work Mode State
    const [meetModalVisible, setMeetModalVisible] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [userRole, setUserRole] = useState(null);
    const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
    const [isNumberHidden, setIsNumberHidden] = useState(false);

    // --- Instant Meet Logic ---
    const [meetTab, setMeetTab] = useState('join');
    const [createdCode, setCreatedCode] = useState(null);
    const [successMeetModalVisible, setSuccessMeetModalVisible] = useState(false);

    // Schedule Meeting State
    const [meetTitle, setMeetTitle] = useState('');
    const [meetDate, setMeetDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Social State
    const [socialPosts, setSocialPosts] = useState([]);
    const [explorePosts, setExplorePosts] = useState([]);
    const [socialRefreshing, setSocialRefreshing] = useState(false);







    const contactAdmin = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/admin-id`);
            const data = await res.json();
            if (data.adminId) {
                router.push({
                    pathname: `/chat/${data.adminId}`,
                    params: { name: 'Admin', profilePic: '', isAdminSupport: 'true' }
                });
            } else {
                Alert.alert("Info", "Admin not found");
            }
        } catch (e) { Alert.alert("Error", "Failed to contact admin"); }
    };


    // PanResponder for closing Viewer List
    const panResponderRef = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 50) {
                    setShowViewersList(false);
                }
            }
        })
    );
    const panResponder = panResponderRef.current;

    // Viewer List State
    const [showViewersList, setShowViewersList] = useState(false);

    // Group Creation State
    const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isAnnouncementGroup, setIsAnnouncementGroup] = useState(false); // Valid State

    const [uploading, setUploading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [upcomingMeetings, setUpcomingMeetings] = useState([]);

    // Derived Users with Socket Data
    const displayUsers = React.useMemo(() => {
        let filtered = users || [];
        if (searchQuery.trim()) {
            const lowerQ = searchQuery.toLowerCase();
            filtered = filtered.filter(u => u.name?.toLowerCase().includes(lowerQ));
        }
        // Filter Archived, Deleted, Blocked
        filtered = filtered.filter(u => {
            const uid = String(u._id);
            return !(archivedChatIds || []).includes(uid) &&
                !(deletedChatIds || []).includes(uid) &&
                !(blockedUserIds || []).includes(uid);
        });
        const safeOnlineUsers = onlineUsers || new Set();
        const safeLastMessages = lastMessages || {};
        const safeUnreadCounts = unreadCounts || {};

        return filtered.map(u => {
            const uId = String(u._id);
            const socketLastMsg = safeLastMessages[uId];
            return {
                ...u,
                status: safeOnlineUsers.has(uId) ? 'online' : u.status,
                unreadCount: (u.unreadCount || 0) + (safeUnreadCounts[uId] || 0),
                lastMessageText: socketLastMsg ? socketLastMsg.text : u.lastMessageText,
                lastMessageDate: socketLastMsg ? socketLastMsg.date : u.lastMessageDate,
            };
        }).sort((a, b) => {
            const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
            const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
            return dateB - dateA;
        });
    }, [users, onlineUsers, unreadCounts, lastMessages, searchQuery, archivedChatIds, deletedChatIds, blockedUserIds]);

    // Derived Groups with Socket Data
    const displayGroups = React.useMemo(() => {
        let filtered = personalGroups;
        if (searchQuery.trim() && activeMode === 'personal') {
            const lowerQ = searchQuery.toLowerCase();
            filtered = personalGroups.filter(g => g.name?.toLowerCase().includes(lowerQ));
        }
        // Filter Archived & Deleted
        filtered = filtered.filter(g => {
            const gid = String(g._id);
            return !archivedChatIds.includes(gid) && !deletedChatIds.includes(gid);
        });
        return filtered.map(g => {
            const gId = String(g._id);
            const socketLastMsg = (lastMessages || {})[`group_${gId}`];
            return {
                ...g,
                lastMessageText: socketLastMsg ? `${socketLastMsg.senderName}: ${socketLastMsg.text}` : g.lastMessageText,
                lastMessageDate: socketLastMsg ? socketLastMsg.date : g.lastMessageDate,
            };
        }).sort((a, b) => {
            const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
            const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
            return dateB - dateA;
        });
    }, [personalGroups, lastMessages, searchQuery, activeMode]);

    const displaySocialPosts = React.useMemo(() => {
        const posts = socialPosts || [];
        if (!searchQuery.trim() || activeMode !== 'social') return posts;
        const lowerQ = searchQuery.toLowerCase();
        return posts.filter(p =>
            p.caption?.toLowerCase().includes(lowerQ) ||
            p.user?.name?.toLowerCase().includes(lowerQ)
        );
    }, [socialPosts, searchQuery, activeMode]);

    const fetchCommunities = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (!userId) return;
            const res = await fetch(`${SERVER_URL}/api/auth/community/list/${userId}`);

            if (res.ok) {
                const data = await res.json();
                setCommunities(data);
            } else {
                const text = await res.text();
                console.error("Fetch Communities Failed:", res.status, text);
            }
        } catch (e) { console.error("Fetch Communities Error:", e); }
    };

    // --- Logic ---
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        await fetchStatuses();
        await fetchPersonalGroups();
        await fetchCommunities();
        if (activeMode === 'work') await fetchMeetings();
        if (activeMode === 'work') await fetchMeetings();
        if (activeMode === 'social') await fetchSocialPosts();
        await fetchArchivedChats();
        await fetchDeletedChats();
        await fetchBlockedUsers();
        setRefreshing(false);
    }, [activeMode]);

    useFocusEffect(
        useCallback(() => {
            checkRole();
            if (activeMode === 'personal') {
                fetchData();
                fetchStatuses();
                fetchPersonalGroups();
                fetchCommunities();
                fetchArchivedChats();
                fetchDeletedChats();
                fetchBlockedUsers();
            }
            if (activeMode === 'work') {
                fetchMeetings();
                fetchUnreadCounts();
            }
            if (activeMode === 'social') {
                fetchSocialPosts();
                fetchStatuses();
                fetchExplorePosts();
            }
        }, [activeMode])
    );

    const checkRole = async () => {
        const role = await AsyncStorage.getItem('userRole');
        setUserRole(role);
    };

    const fetchUnreadCounts = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/admin/group/list`);
            const uid = currentUserId || await AsyncStorage.getItem('userId');
            const role = await AsyncStorage.getItem('userRole');

            if (res.ok) {
                const groups = await res.json();
                const filtered = groups.filter(g =>
                    role === 'admin' || (g.members && g.members.some(m => (m._id === uid || m === uid)))
                );

                let totalUnread = 0;
                await Promise.all(filtered.map(async (group) => {
                    const lastRead = await AsyncStorage.getItem(`lastReadGroup_${group._id}`);
                    const lastReadDate = lastRead ? new Date(lastRead) : new Date(0);

                    const [resA, resM] = await Promise.all([
                        fetch(`${SERVER_URL}/api/admin/group/${group._id}/announcements`),
                        fetch(`${SERVER_URL}/api/admin/group/${group._id}/messages`)
                    ]);
                    const anns = resA.ok ? await resA.json() : [];
                    const msgs = resM.ok ? await resM.json() : [];

                    [...anns, ...msgs].forEach(item => {
                        if (new Date(item.createdAt) > lastReadDate) totalUnread++;
                    });
                }));
                setUnreadAnnouncements(totalUnread);
            }
        } catch (e) { }
    };

    const fetchMeetings = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/admin/meet/list`);
            if (res.ok) {
                const data = await res.json();
                setUpcomingMeetings(data);
            }
        } catch (e) { }
    };

    useEffect(() => {
        if (socket) {
            socket.on('userUpdated', () => fetchData());
            return () => socket.off('userUpdated');
        }
    }, [socket]);

    const fetchData = async () => {
        try {
            const uid = currentUserId || await AsyncStorage.getItem('userId');
            if (!uid) {
                console.log("fetchData: No userId found");
                return;
            }

            // Fetch Latest Current User Info
            try {
                const userRes = await fetch(`${SERVER_URL}/api/auth/user/${uid}`);
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setUserProfile({ name: userData.name, profilePic: userData.profilePic });
                }
            } catch (e) {
                console.log("Profile Fetch Error (falling back to storage):", e);
                const name = await AsyncStorage.getItem('userName');
                const pic = await AsyncStorage.getItem('profilePic');
                setUserProfile({ name: name || 'User', profilePic: pic || '' });
            }

            const res = await fetch(`${SERVER_URL}/api/auth/community/users?currentUserId=${uid}`);
            if (res.ok) {
                const data = await res.json();
                console.log("[CommunityScreen] Users Fetched:", data.length);
                setUsers(data.filter(u => String(u._id) !== String(uid)));
            } else {
                console.error("[CommunityScreen] Fetch Users Failed:", res.status);
            }
        } catch (e) {
            console.log("Fetch Data Global Error:", e);
        }
    };



    const fetchPersonalGroups = async () => {
        try {
            const uid = currentUserId || await AsyncStorage.getItem('userId');
            if (!uid) return;
            const res = await fetch(`${SERVER_URL}/api/auth/chat/groups/${uid}`);
            if (res.ok) {
                const data = await res.json();
                setPersonalGroups(data);
            }
        } catch (e) { console.log("Fetch Groups Error", e); }
    };

    const fetchSocialPosts = async () => {
        try {
            setSocialRefreshing(true);
            const uid = currentUserId || await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/posts/feed?userId=${uid}`);
            if (res.ok) {
                const data = await res.json();
                setSocialPosts(data);
            }
        } catch (e) {
            console.error("Fetch Social Posts Error:", e);
        } finally {
            setSocialRefreshing(false);
        }
    };

    const fetchExplorePosts = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/posts/explore`);
            if (res.ok) {
                const data = await res.json();
                setExplorePosts(data);
            }
        } catch (e) {
            console.error("Fetch Explore Error:", e);
        }
    };

    const fetchArchivedChats = async () => {
        try {
            const uid = currentUserId || await AsyncStorage.getItem('userId');
            if (!uid) return;
            const res = await fetch(`${SERVER_URL}/api/auth/chat/archived/${uid}`);
            if (res.ok) {
                const ids = await res.json();
                setArchivedChatIds(ids);
            }
        } catch (e) { }
    };

    const fetchDeletedChats = async () => {
        try {
            const uid = currentUserId || await AsyncStorage.getItem('userId');
            if (!uid) return;
            const res = await fetch(`${SERVER_URL}/api/auth/chat/deleted/${uid}`);
            if (res.ok) {
                const ids = await res.json();
                setDeletedChatIds(ids);
            }
        } catch (e) { }
    };

    const fetchBlockedUsers = async () => {
        try {
            const uid = currentUserId || await AsyncStorage.getItem('userId');
            if (!uid) return;
            const res = await fetch(`${SERVER_URL}/api/auth/social/blocked/${uid}`);
            if (res.ok) {
                const ids = await res.json();
                setBlockedUserIds(ids);
            }
        } catch (e) { }
    };

    // --- Status Grouping Logic ---
    const fetchStatuses = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/status/feed`);
            if (res.ok) {
                const data = await res.json();
                const groups = {};

                // Group by User (Filter > 24h)
                const now = new Date();
                const ONE_DAY_MS = 24 * 60 * 60 * 1000;

                data.filter(status => (now - new Date(status.createdAt)) < ONE_DAY_MS).forEach(status => {
                    const uid = String(status.user?._id || status.user);
                    if (!groups[uid]) groups[uid] = { user: status.user, items: [], latestTime: new Date(0) };
                    groups[uid].items.push(status);

                    const statusTime = new Date(status.createdAt);
                    if (statusTime > groups[uid].latestTime) {
                        groups[uid].latestTime = statusTime;
                    }
                });

                // Sort Items inside each group: Oldest -> Newest (Story Order)
                if (groups) {
                    Object.values(groups).forEach(group => {
                        if (group && group.items) {
                            group.items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                        }
                    });

                    const sortedGroups = Object.values(groups).sort((a, b) => b.latestTime - a.latestTime);
                    setGroupedStatuses(sortedGroups);
                }
            }
        } catch (e) { console.log("Fetch Status Error", e); }
    };

    const handleCreateStory = () => {
        Alert.alert(
            "Add to Story",
            "Share a photo or video",
            [
                {
                    text: "Camera",
                    onPress: async () => {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') return Alert.alert("Error", "Camera permission required");
                        const res = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.8,
                            allowsEditing: true,
                            aspect: [9, 16],
                        });
                        if (!res.canceled && res.assets[0]) {
                            uploadStatusImage(res.assets[0]);
                        }
                    }
                },
                {
                    text: "Gallery",
                    onPress: async () => {
                        const res = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.8,
                            allowsEditing: true,
                            aspect: [9, 16],
                        });
                        if (!res.canceled && res.assets[0]) {
                            uploadStatusImage(res.assets[0]);
                        }
                    }
                },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const handleCreateStatus = async (type = 'text', content = null, color = null) => {
        setUploading(true);
        try {
            const userId = await AsyncStorage.getItem('userId');
            const payload = { userId, type, content: content || statusText, caption: '', color: color || statusColor };
            const res = await fetch(`${SERVER_URL}/api/auth/status/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setTextStatusVisible(false);
                setStatusText('');
                await fetchStatuses(); // Robust: Wait for refresh
                Alert.alert("Success", "Story uploaded!");
            }
        } catch (e) { Alert.alert("Error", "Failed to upload story"); }
        finally { setUploading(false); }
    };

    const uploadStatusImage = async (asset) => {
        setUploading(true);
        try {
            const localUri = asset.uri;
            const filename = asset.fileName || localUri.split('/').pop();
            const formData = new FormData();
            formData.append('file', { uri: localUri, name: filename, type: 'image/jpeg' });

            const uploadRes = await fetch(`${SERVER_URL}/api/auth/upload`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = await uploadRes.json();
            if (uploadRes.ok) await handleCreateStatus('image', data.url);
            else Alert.alert("Upload Failed", data.error);
        } catch (e) { Alert.alert("Error", e.message); }
        finally { setUploading(false); }
    };

    const pickStatusImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [9, 16],
            quality: 0.8
        });
        if (!result.canceled && result.assets[0]) uploadStatusImage(result.assets[0]);
    };

    const pickProfilePicture = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (!result.canceled && result.assets[0]) {
            setUploading(true);
            try {
                const asset = result.assets[0];
                const formData = new FormData();
                formData.append('image', { uri: asset.uri, name: 'profile.jpg', type: 'image/jpeg' }); // Ensure mimeType is image/jpeg
                formData.append('userId', currentUserId);

                const res = await fetch(`${SERVER_URL}/api/auth/upload-avatar`, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const data = await res.json();
                if (res.ok) {
                    setUserProfile(prev => ({ ...prev, profilePic: data.profilePic }));
                    setShowProfileMenu(false);
                    Alert.alert("Success", "Profile picture updated!");
                }
            } catch (e) { Alert.alert("Error", e.message); }
            finally { setUploading(false); }
        }
    };

    const handleLogout = async () => {
        Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout", style: "destructive", onPress: async () => {
                    await AsyncStorage.clear();
                    setUserId(null);
                    setUserProfile({ name: '', profilePic: '' });
                    if (Platform.OS === 'web') {
                        router.replace('/web-login');
                    } else {
                        router.replace('/(auth)/login');
                    }
                }
            }
        ]);
    };

    // --- Status Viewer Logic (Multi-Item) ---
    const handleViewStatus = (group) => {
        if (!group || !group.items) return;
        setCurrentUserStories(group.items);
        setCurrentStoryIndex(0);
        setViewStatusModalVisible(true);
        pausedValue.current = 0;
    };

    // Sync active stories with groupedStatuses for realtime viewer updates
    useEffect(() => {
        if (viewStatusModalVisible && activeStory) {
            const currentUserIdInStatus = String(activeStory.user?._id || activeStory.user);
            const updatedGroup = groupedStatuses.find(g => String(g.user._id || g.user) === currentUserIdInStatus);
            if (updatedGroup) {
                setCurrentUserStories(updatedGroup.items);
            }
        }
    }, [groupedStatuses]);

    useEffect(() => {
        if (viewStatusModalVisible && activeStory) {
            startStatusTimer();
            // Record view for everyone (inc self) to update ring color
            fetch(`${SERVER_URL}/api/auth/status/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statusId: activeStory._id, userId: currentUserId })
            }).then(res => {
                if (res.ok) fetchStatuses();
            }).catch(err => console.log("View Error", err));
        }
    }, [currentStoryIndex, viewStatusModalVisible]);

    const startStatusTimer = (startValue = 0) => {
        pausedValue.current = startValue;
        progressAnim.setValue(startValue);
        const duration = 5000 * (1 - startValue);

        Animated.timing(progressAnim, {
            toValue: 1, duration: duration, easing: Easing.linear, useNativeDriver: false
        }).start(({ finished }) => {
            if (finished && !isPaused.current) handleNextStory();
        });
    };

    const handlePressIn = () => {
        isPaused.current = true;
        progressAnim.stopAnimation(value => {
            pausedValue.current = value;
        });
    };

    const handlePressOut = () => {
        isPaused.current = false;
        if (pausedValue.current < 1) {
            startStatusTimer(pausedValue.current);
        }
    };

    const handleNextStory = () => {
        setCurrentStoryIndex(prev => {
            if (prev + 1 < currentUserStories.length) {
                return prev + 1;
            } else {
                setViewStatusModalVisible(false);
                return prev;
            }
        });
    };

    // --- Group Creation Logic ---
    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return Alert.alert("Error", "Name required");
        if (selectedUsers.length === 0) return Alert.alert("Error", "Select at least 1 member");

        setUploading(true);
        try {
            const userId = await AsyncStorage.getItem('userId');
            const members = [...selectedUsers];

            let url = `${SERVER_URL}/api/auth/chat/group/create`;
            let body = {
                name: newGroupName,
                createdBy: userId,
                members: members,
                type: 'group'
            };

            if (isAnnouncementGroup) {
                // creating a community
                url = `${SERVER_URL}/api/auth/community/create`;
                body = {
                    name: newGroupName,
                    description: "Community created via app",
                    createdBy: userId,
                    members: members,
                    image: "" // Optional image
                };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                setCreateGroupModalVisible(false);
                setNewGroupName('');
                setSelectedUsers([]);
                if (isAnnouncementGroup) {
                    await fetchCommunities();
                    Alert.alert("Success", "Community created!");
                } else {
                    await fetchPersonalGroups();
                    Alert.alert("Success", "Group created!");
                }
            } else {
                Alert.alert("Error", data.error || "Failed");
            }
        } catch (e) { Alert.alert("Error", e.message); }
        finally { setUploading(false); }
    };



    const handleTabPress = async (tab) => {
        if (tab === 'settings') {
            router.push('/mode-switch');
            return;
        }

        if (activeMode === 'social' && tab === 'create') {
            Alert.alert(
                "Create Post",
                "Select media from",
                [
                    {
                        text: "Camera", onPress: async () => {
                            const { status } = await ImagePicker.requestCameraPermissionsAsync();
                            if (status !== 'granted') return Alert.alert("Error", "Camera permission required");
                            const res = await ImagePicker.launchCameraAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.All,
                                quality: 0.8
                            });
                            if (!res.canceled && res.assets[0]) {
                                setNewPostMedia(res.assets[0]);
                                setNewPostType(res.assets[0].type || 'image');
                                setCreatePostVisible(true);
                            }
                        }
                    },
                    {
                        text: "Gallery", onPress: async () => {
                            const res = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.All,
                                quality: 0.8
                            });
                            if (!res.canceled && res.assets[0]) {
                                setNewPostMedia(res.assets[0]);
                                setNewPostType(res.assets[0].type || 'image');
                                setCreatePostVisible(true);
                            }
                        }
                    },
                    { text: "Cancel", style: "cancel" }
                ]
            );
            return;
        }

        setActiveTab(tab);
    };

    const toggleUserSelection = (uid) => {
        if (selectedUsers.includes(uid)) setSelectedUsers(prev => prev.filter(id => id !== uid));
        else setSelectedUsers(prev => [...prev, uid]);
    };

    const renderGroupCreationModal = () => (
        <Modal visible={createGroupModalVisible} animationType="slide" onRequestClose={() => setCreateGroupModalVisible(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.border }}>
                    <TouchableOpacity onPress={() => setCreateGroupModalVisible(false)}>
                        <Ionicons name="close" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', marginLeft: 15, color: theme.textPrimary }}>
                        {isAnnouncementGroup ? "New Community" : "New Group"}
                    </Text>
                </View>

                <View style={{ padding: 20 }}>
                    <Text style={{ color: theme.textPrimary, marginBottom: 5, fontWeight: '600' }}>Group Name</Text>
                    <TextInput
                        style={{ padding: 15, borderRadius: 10, borderWidth: 1, borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface, marginBottom: 20 }}
                        placeholder="e.g. Finance Team"
                        placeholderTextColor={theme.textLight}
                        value={newGroupName}
                        onChangeText={setNewGroupName}
                    />

                    <Text style={{ color: theme.textPrimary, marginBottom: 10, fontWeight: '600' }}>Select Members ({selectedUsers.length})</Text>
                    <FlatList
                        data={users}
                        keyExtractor={item => item._id}
                        style={{ maxHeight: height * 0.5 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => toggleUserSelection(item._id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderColor: theme.border }}>
                                <Image source={{ uri: `${SERVER_URL}${item.profilePic}` }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: theme.textPrimary, fontSize: 16 }}>{item.name}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.email}</Text>
                                </View>
                                <Ionicons name={selectedUsers.includes(item._id) ? "checkmark-circle" : "ellipse-outline"} size={24} color={selectedUsers.includes(item._id) ? theme.primary : theme.textLight} />
                            </TouchableOpacity>
                        )}
                    />
                </View>

                <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
                    <TouchableOpacity
                        onPress={handleCreateGroup}
                        style={{ backgroundColor: theme.primary, padding: 15, borderRadius: 15, alignItems: 'center', opacity: (newGroupName && selectedUsers.length > 0) ? 1 : 0.6 }}
                        disabled={!(newGroupName && selectedUsers.length > 0)}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                            {isAnnouncementGroup ? "Create Community" : "Create Group"} ({selectedUsers.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );

    // --- Group Options (Delete/Pin) ---
    const handleGroupOptions = (group) => {
        Alert.alert(
            group.name,
            "Choose an action",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Group",
                    style: "destructive",
                    onPress: () => {
                        Alert.alert("Confirm Delete", "Are you sure? This cannot be undone.", [
                            { text: "Cancel", style: "cancel" },
                            {
                                text: "Delete", style: "destructive", onPress: async () => {
                                    try {
                                        // Check if it's a Community (has announcementsGroup) or a Group
                                        const isCommunity = !!(group.announcementsGroup || (group.admins && !group.type));
                                        // Note: 'group.type' exists on ChatGroup ('group'/'announcement'), not on Community.

                                        let url = `${SERVER_URL}/api/auth/chat/group/${group._id}`;
                                        if (isCommunity) {
                                            url = `${SERVER_URL}/api/auth/community/${group._id}`;
                                        }

                                        const res = await fetch(url, { method: 'DELETE' });
                                        if (res.ok) {
                                            if (isCommunity) await fetchCommunities();
                                            else await fetchPersonalGroups();

                                            Alert.alert("Deleted", isCommunity ? "Community deleted" : "Group deleted");
                                        } else {
                                            const text = await res.text();
                                            console.log("Delete Failed:", text);
                                            Alert.alert("Error", "Could not delete item");
                                        }
                                    } catch (e) { Alert.alert("Error", e.message); }
                                }
                            }
                        ]);
                    }
                }
            ]
        );
    };

    const activeStory = (currentUserStories && currentUserStories.length > 0) ? currentUserStories[currentStoryIndex] : null;

    const renderViewerModal = () => (
        <Modal visible={showViewersList} animationType="slide" transparent onRequestClose={() => setShowViewersList(false)}>
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'transparent' }}
                activeOpacity={1}
                onPress={() => setShowViewersList(false)}
            />
            <View style={{ height: '50%', backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
                <View
                    {...(panResponder?.panHandlers || {})}
                    style={{ alignItems: 'center', marginBottom: 15, paddingVertical: 10 }}
                >
                    <View style={{ width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2 }} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 15 }}>
                    Viewed by {activeStory?.viewers?.filter(v => v && (v.user?._id || v.user) && String(v.user?._id || v.user) !== String(currentUserId))?.length || 0}
                </Text>
                <FlatList
                    data={activeStory?.viewers?.filter(v => v && (v.user?._id || v.user) && String(v.user?._id || v.user) !== String(currentUserId)) || []}
                    keyExtractor={(item, idx) => idx.toString()}
                    renderItem={({ item }) => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                            {item.user?.profilePic ? (
                                <Image
                                    source={{ uri: `${SERVER_URL}${item.user.profilePic}` }}
                                    style={{ width: 44, height: 44, borderRadius: 22, marginRight: 15 }}
                                />
                            ) : (
                                <View style={{ width: 44, height: 44, borderRadius: 22, marginRight: 15, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: theme.textSecondary, fontWeight: 'bold' }}>{item.user?.name?.[0]?.toUpperCase()}</Text>
                                </View>
                            )}
                            <View>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textPrimary }}>
                                    {item.user?.name || 'Unknown User'}
                                </Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                                    {new Date(item.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>No views yet</Text>}
                />
            </View>
        </Modal>
    );

    const renderHeaderContent = () => {
        const getTitleStyle = () => {
            switch (activeMode) {
                case 'social':
                    return {
                        fontSize: 38,
                        fontWeight: '600',
                        fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'serif',
                        marginTop: Platform.OS === 'ios' ? 0 : -10,
                        letterSpacing: -0.5,
                        textTransform: 'none'
                    };
                case 'work':
                    return { fontSize: 24, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif-medium' };
                default:
                    return { fontSize: 24, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif' };
            }
        };

        // Interpolations
        // Header expands from 60 to 110 (approx)
        const headerHeight = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 120] });

        // Search Bar (Bottom Row) Logic
        const searchOpacity = searchAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
        const searchTranslateY = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });

        // Ensure Title stays visible (no fade out)

        return (
            <Animated.View style={{ height: headerHeight, overflow: 'hidden', paddingHorizontal: 16 }}>
                {/* Top Row: Menu | Title | Search Icon */}
                <View style={{ height: 60, flexDirection: 'row', alignItems: 'center' }}>
                    {activeMode === 'personal' ? (
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white', marginLeft: 0, flex: 1 }}>
                            {activeTab === 'chats' ? 'All Chat' :
                                activeTab === 'groups' ? 'Groups' :
                                    activeTab === 'updates' ? 'Status' :
                                        activeTab === 'calls' ? 'Calls' :
                                            activeTab === 'community' ? 'Communities' :
                                                activeTab === 'settings' ? 'Settings' : 'Intraa'}
                        </Text>
                    ) : (
                        <>
                            <TouchableOpacity onPress={() => setShowSidebar(true)} style={{ width: 40, zIndex: 10 }}>
                                <Ionicons name="menu" size={28} color="white" />
                            </TouchableOpacity>

                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={[{ color: 'white' }, getTitleStyle()]}>
                                    Intraa
                                </Text>
                            </View>
                        </>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', zIndex: 10 }}>
                        {activeMode === 'personal' ? (
                            <>
                                <TouchableOpacity onPress={() => { setIsSearchVisible(!isSearchVisible); if (isSearchVisible) setSearchQuery(''); }} style={{ marginRight: 15 }}>
                                    <Ionicons name="search" size={24} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowSidebar(true)}>
                                    <Ionicons name="menu" size={24} color="white" />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity onPress={(() => {
                                // Toggle
                                setIsSearchVisible(!isSearchVisible);
                                if (isSearchVisible) setSearchQuery('');
                            })}>
                                <Ionicons name={isSearchVisible ? "close" : "search"} size={28} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Bottom Row: Search Bar (Expanded Area) */}
                <Animated.View style={{
                    height: 50,
                    opacity: searchOpacity,
                    transform: [{ translateY: searchTranslateY }],
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingBottom: 10
                }}>
                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 15,
                        paddingHorizontal: 15,
                        height: 40
                    }}>
                        <Ionicons name="search" size={20} color="rgba(255,255,255,0.7)" />
                        <TextInput
                            style={{ flex: 1, marginLeft: 10, color: 'white', fontSize: 16 }}
                            placeholder="Search..."
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        )}
                    </View>
                </Animated.View>
            </Animated.View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: (activeMode === 'social' && activeTab === 'reels') ? 'black' : theme.background }}>
            <StatusBar translucent backgroundColor="transparent" style={(activeMode === 'social' && activeTab === 'reels') ? 'light' : 'light'} />
            {/* Unified Curved Header */}
            {/* Unified Curved Header - Hidden on Reels Tab */}
            {!(activeMode === 'social' && activeTab === 'reels') && (
                <>
                    {activeMode === 'social' ? (
                        <LinearGradient
                            colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 15, paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10 }}
                        >
                            {renderHeaderContent()}
                            <View style={{ paddingHorizontal: 16 }}>
                            </View>
                        </LinearGradient>
                    ) : (
                        <View style={{
                            backgroundColor: activeMode === 'personal' ? '#075E54' : theme.primary,
                            borderBottomLeftRadius: 30,
                            borderBottomRightRadius: 30,
                            paddingBottom: 15,
                            paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10
                        }}>
                            {renderHeaderContent()}
                            <View style={{ paddingHorizontal: 16 }}>
                            </View>
                        </View>
                    )}
                </>
            )}


            <Animated.View style={[styles.contentContainer, { opacity: contentFadeAnim }]}>
                {renderContent()}
            </Animated.View>

            {/* Unconditionally render BottomNavBar since it now handles Personal mode too */}
            <BottomNavBar mode={activeMode} activeTab={activeTab} onTabPress={handleTabPress} theme={theme} />

            {/* Status Modal */}
            <Modal visible={viewStatusModalVisible} transparent animationType="fade" onRequestClose={() => setViewStatusModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center' }}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', paddingTop: 10, paddingHorizontal: 10 }}>
                            {currentUserStories.map((story, index) => (
                                <View key={index} style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.4)', marginRight: 5, borderRadius: 2, overflow: 'hidden' }}>
                                    {index === currentStoryIndex ? (
                                        <Animated.View style={{ height: '100%', backgroundColor: 'white', width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
                                    ) : index < currentStoryIndex ? (
                                        <View style={{ height: '100%', backgroundColor: 'white' }} />
                                    ) : (
                                        <View style={{ height: '100%', backgroundColor: 'transparent' }} />
                                    )}
                                </View>
                            ))}
                        </View>
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            {activeStory?.type === 'image' ? (
                                <Image source={{ uri: activeStory.content?.startsWith('http') ? activeStory.content : `${SERVER_URL}${activeStory.content}` }} style={{ width: width, height: height * 0.8 }} resizeMode="contain" />
                            ) : (
                                <View style={{ width: '100%', flex: 1, backgroundColor: activeStory?.color || 'black', justifyContent: 'center', alignItems: 'center', padding: 30 }}>
                                    <Text style={{ color: 'white', fontSize: 30, fontWeight: 'bold', textAlign: 'center' }}>{activeStory?.content}</Text>
                                </View>
                            )}
                        </View>
                        <View style={{ position: 'absolute', top: 30, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 99 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Image source={{ uri: `${SERVER_URL}${activeStory?.user?.profilePic}` }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }} />
                                <View>
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                                        {(() => {
                                            const storyUserId = typeof activeStory?.user === 'object' ? activeStory?.user?._id : activeStory?.user;
                                            return (String(storyUserId) === String(currentUserId)) ? "Me" : activeStory?.user?.name || "User";
                                        })()}
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                                        {(() => {
                                            const date = new Date(activeStory?.createdAt);
                                            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        })()}
                                    </Text>
                                </View>
                            </View>

                            {/* Delete Button (Only for Me) */}
                            {(activeStory?.user?._id === currentUserId || activeStory?.user === currentUserId) && (
                                <TouchableOpacity onPress={() => {
                                    Alert.alert("Delete Story", "Are you sure?", [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Delete",
                                            style: "destructive",
                                            onPress: async () => {
                                                try {
                                                    await fetch(`${SERVER_URL}/api/auth/status/${activeStory._id}`, { method: 'DELETE' });
                                                    fetchStatuses();
                                                    setViewStatusModalVisible(false);
                                                } catch (e) { }
                                            }
                                        }
                                    ]);
                                }}>
                                    <Ionicons name="trash-outline" size={24} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* View Count (Only for Me) */}
                        {(activeStory?.user?._id === currentUserId || activeStory?.user === currentUserId) && (
                            <TouchableOpacity
                                style={{ position: 'absolute', bottom: 30, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', zIndex: 100 }}
                                onPress={() => setShowViewersList(true)}
                            >
                                <Ionicons name="eye" size={20} color="white" style={{ marginRight: 8 }} />
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{activeStory?.viewers?.filter(v => String(v.user?._id || v.user) !== String(currentUserId))?.length || 0}</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1 }}
                            onPress={handleNextStory}
                            onPressIn={handlePressIn}
                            onPressOut={handlePressOut}
                            activeOpacity={1}
                        />
                    </SafeAreaView>
                </View>
            </Modal>

            {renderViewerModal()}
            {renderSearchResults()}
            {renderTextStatusCreator()}
            {renderGroupCreationModal()}
            {renderMeetModal()}
            {renderSuccessMeetModal()}
            {renderSidebar()}


            {renderCreatePostModal()}

            {uploading && (
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
                    <ActivityIndicator size="large" color="white" />
                </View>
            )}
        </View>
    );

    function renderContent() {
        if (activeMode === 'personal') {
            if (activeTab === 'settings') {
                return (
                    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
                        {/* Profile Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 15, marginBottom: 25, backgroundColor: theme.surface, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 }}>
                            <View style={{ width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.inputBg || '#e0e0e0' }}>
                                {profilePic ? (
                                    <Image source={{ uri: `${SERVER_URL}${profilePic}` }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                                ) : (
                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.textSecondary }}>{userName?.[0]?.toUpperCase() || 'U'}</Text>
                                )}
                            </View>
                            <View style={{ marginLeft: 15 }}>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.textPrimary }}>{userName || 'User'}</Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Available</Text>
                            </View>
                        </View>

                        {/* Account */}
                        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginLeft: 10, textTransform: 'uppercase', color: theme.primary }}>Account</Text>
                        <View style={{ borderRadius: 12, overflow: 'hidden', elevation: 1, backgroundColor: theme.surface, marginBottom: 25 }}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }} onPress={() => router.push('/settings/privacy')}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="key-outline" size={24} color={theme.textSecondary} style={{ marginRight: 15 }} />
                                    <Text style={{ fontSize: 16, color: theme.textPrimary }}>Privacy</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Chats */}
                        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginLeft: 10, textTransform: 'uppercase', color: theme.primary }}>Chats</Text>
                        <View style={{ borderRadius: 12, overflow: 'hidden', elevation: 1, backgroundColor: theme.surface, marginBottom: 25 }}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }} onPress={() => {
                                Alert.alert("Select Theme", "Choose your preferred appearance", [
                                    { text: "Light", onPress: () => { } },
                                    { text: "Dark", onPress: () => { } },
                                    { text: "Cancel", style: "cancel" }
                                ]);
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="color-palette-outline" size={24} color={theme.textSecondary} style={{ marginRight: 15 }} />
                                    <Text style={{ fontSize: 16, color: theme.textPrimary }}>Theme</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }} onPress={async () => {
                                try {
                                    const result = await require('expo-image-picker').launchImageLibraryAsync({ mediaTypes: require('expo-image-picker').MediaTypeOptions.Images, allowsEditing: true, aspect: [9, 16], quality: 0.8 });
                                    if (!result.canceled && result.assets[0]) {
                                        await AsyncStorage.setItem('chat_wallpaper_global', result.assets[0].uri);
                                        Alert.alert("Success", "Default wallpaper updated.");
                                    }
                                } catch (e) { Alert.alert("Error", "Could not set wallpaper"); }
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="image-outline" size={24} color={theme.textSecondary} style={{ marginRight: 15 }} />
                                    <Text style={{ fontSize: 16, color: theme.textPrimary }}>Default Wallpaper</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Help */}
                        <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginLeft: 10, textTransform: 'uppercase', color: theme.primary }}>Help</Text>
                        <View style={{ borderRadius: 12, overflow: 'hidden', elevation: 1, backgroundColor: theme.surface, marginBottom: 25 }}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }} onPress={() => router.push('/settings/help')}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="help-circle-outline" size={24} color={theme.textSecondary} style={{ marginRight: 15 }} />
                                    <Text style={{ fontSize: 16, color: theme.textPrimary }}>Help Center</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }} onPress={() => Alert.alert("App Info", "Finance Chat v1.1.0\nBuild: 2026.01.28")}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="information-circle-outline" size={24} color={theme.textSecondary} style={{ marginRight: 15 }} />
                                    <Text style={{ fontSize: 16, color: theme.textPrimary }}>App Info</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Logout */}
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, backgroundColor: theme.surface, elevation: 1, marginBottom: 20 }} onPress={() => {
                            Alert.alert("Logout", "Are you sure you want to logout?", [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Logout", style: "destructive", onPress: async () => {
                                        await AsyncStorage.clear();
                                        router.replace('/');
                                    }
                                }
                            ]);
                        }}>
                            <Ionicons name="log-out-outline" size={24} color="red" style={{ marginRight: 10 }} />
                            <Text style={{ fontSize: 16, fontWeight: '600', color: 'red' }}>Logout</Text>
                        </TouchableOpacity>
                    </ScrollView>
                );
            }

            return (
                <PersonalChats
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    users={displayUsers}
                    onChatSelect={(item) => {
                        if (!item) return;
                        markAsRead(item._id);
                        router.push({
                            pathname: `/chat/${item._id}`,
                            params: {
                                name: item.name,
                                profilePic: item.profilePic || ''
                            }
                        });
                    }}
                    personalGroups={displayGroups.filter(g => g.type !== 'announcement')}
                    communities={communities} // Pass real communities
                    onGroupSelect={(group) => router.push(`/chat/group/${group._id}`)}
                    onCommunitySelect={(community) => router.push(`/community/${community._id}`)} // New Handler
                    onGroupOptions={handleGroupOptions}
                    statuses={groupedStatuses}
                    onViewStatus={handleViewStatus}
                    onAddStatus={pickStatusImage}
                    onAddTextStatus={() => setTextStatusVisible(true)}
                    hasStatus={groupedStatuses.some(g => (g.user._id || g.user) === currentUserId)}
                    profilePic={profilePic}
                    userName={userName}
                    onCreateGroup={() => { setIsAnnouncementGroup(false); setCreateGroupModalVisible(true); }}
                    onCreateCommunity={() => { setIsAnnouncementGroup(true); setCreateGroupModalVisible(true); }}
                    currentUserId={currentUserId}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textPrimary} />}
                />
            );
        }

        // Work Mode
        if (activeMode === 'work') {
            return (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginLeft: 0, marginTop: 10, marginBottom: 15 }]}>Workplace Tools</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        {[
                            { icon: 'megaphone', label: 'Announcements', color: '#FF3B30', onPress: () => router.push('/announcement'), badge: unreadAnnouncements },
                            { icon: 'videocam', label: 'Meetings', color: '#5856D6', onPress: () => setMeetModalVisible(true) },
                            { icon: 'people', label: 'Discussions', color: '#FF9500', onPress: () => router.push('/gd') },
                            // Only show Admin Support to non-admins
                            userRole !== 'admin' && {
                                icon: 'chatbubble-ellipses',
                                label: 'Admin Support',
                                color: '#007AFF',
                                onPress: contactAdmin,
                                badge: users.find(u => u.role === 'admin')?.unreadCount || 0
                            },
                        ].filter(Boolean).map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={{ width: (width - 50) / 2, padding: 10, borderRadius: 20, marginBottom: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, height: 110, position: 'relative' }}
                                onPress={item.onPress}
                            >
                                <View style={{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8, backgroundColor: item.color + '20' }}>
                                    <Ionicons name={item.icon} size={24} color={item.color} />
                                </View>
                                <Text style={{ fontWeight: '600', fontSize: 13, color: theme.textPrimary }}>{item.label}</Text>
                                {item.badge > 0 && (
                                    <View style={{ position: 'absolute', top: 10, right: 15, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                                        <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{item.badge}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Admin: Show Support Chats */}
                    {userRole === 'admin' && (
                        <View style={{ marginTop: 30, marginBottom: 20 }}>
                            <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginLeft: 0, marginBottom: 10 }]}>Support Messages</Text>
                            <View style={{ backgroundColor: theme.surface, borderRadius: 20, overflow: 'hidden' }}>
                                {displayUsers.filter(u => u.lastMessageText).length > 0 ? (
                                    displayUsers.filter(u => u.lastMessageText).map((u, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.inputBg }}
                                            onPress={() => router.push({ pathname: `/chat/${u._id}`, params: { name: u.name, profilePic: u.profilePic || '' } })}
                                        >
                                            {u.profilePic ? (
                                                <Image source={{ uri: `${SERVER_URL}${u.profilePic}` }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 15, backgroundColor: theme.inputBg }} />
                                            ) : (
                                                <View style={{ width: 44, height: 44, borderRadius: 22, marginRight: 15, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }}>
                                                    <Text style={{ fontWeight: 'bold', color: theme.textSecondary }}>{u.name?.[0]?.toUpperCase()}</Text>
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.textPrimary }}>{u.name}</Text>
                                                <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>{u.lastMessageText}</Text>
                                            </View>
                                            {u.unreadCount > 0 && <View style={{ backgroundColor: '#FF3B30', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: 'white', fontSize: 10 }}>{u.unreadCount}</Text></View>}
                                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: 10 }} />
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={{ padding: 20, textAlign: 'center', color: theme.textSecondary }}>No messages yet.</Text>
                                )}
                            </View>
                        </View>
                    )}

                    {upcomingMeetings.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginLeft: 0 }]}>Upcoming Meetings</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5 }}>
                                {upcomingMeetings.map((meet, idx) => {
                                    const meetTime = new Date(meet.scheduledTime);
                                    const now = new Date();
                                    const diff = meetTime.getTime() - now.getTime();
                                    // Allow join if started OR 10 mins before
                                    const canJoin = meet.isStarted || diff <= 10 * 60 * 1000 || userRole === 'admin';

                                    return (
                                        <View key={idx} style={{
                                            width: 220,
                                            backgroundColor: theme.surface,
                                            padding: 15,
                                            borderRadius: 20,
                                            marginRight: 10,
                                            borderWidth: 1,
                                            borderColor: theme.border
                                        }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: theme.textPrimary, fontWeight: 'bold', fontSize: 16 }}>{meet.title}</Text>
                                                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
                                                        {meetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {meetTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </Text>
                                                </View>
                                                {meet.isStarted && (
                                                    <View style={{ backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>LIVE</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {/* Code Display */}
                                            <TouchableOpacity
                                                onPress={() => { import('expo-clipboard').then(c => c.setStringAsync(meet.code)); Alert.alert("Copied Code"); }}
                                                style={{ marginTop: 8 }}
                                            >
                                                <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
                                                    Code: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 15 }}>{meet.code}</Text>
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => {
                                                    setJoinCode(meet.code);
                                                    setMeetTab('join');
                                                    setMeetModalVisible(true);
                                                }}
                                                style={{
                                                    marginTop: 15,
                                                    backgroundColor: meet.isStarted ? '#34C759' : theme.primary,
                                                    padding: 10,
                                                    borderRadius: 12,
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
                                                    {meet.isStarted ? 'Join Live' : 'Join Meeting'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                </ScrollView>
            );
        }

        // Social Mode
        if (activeMode === 'social' && activeTab === 'home') {
            return (
                <SocialFeed
                    theme={theme}
                    posts={socialPosts}
                    currentUser={{ ...userProfile, _id: currentUserId }}
                    statuses={groupedStatuses}
                    onCreateStatus={handleCreateStory}
                    onViewStatus={handleViewStatus}
                    onRefresh={onRefresh}
                    refreshing={socialRefreshing}
                />
            );
        }
        if (activeMode === 'social' && activeTab === 'chats') {
            return (
                <SocialChats
                    activeTab="chats"
                    users={displayUsers}
                    currentUserId={currentUserId}
                    onChatSelect={(item) => {
                        if (!item) return;
                        markAsRead(item._id);
                        router.push({
                            pathname: `/chat/${item._id}`,
                            params: {
                                name: item.name,
                                profilePic: item.profilePic || '',
                                mode: 'social'
                            }
                        });
                    }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textPrimary} />}
                />
            );
        }
        if (activeMode === 'social' && activeTab === 'reels') return <ReelsView theme={theme} onFullScreenChange={() => { }} refreshTrigger={refreshing} />;
        if (activeMode === 'social' && activeTab === 'profile') return <SocialProfile theme={theme} userId={currentUserId || 'check_auth'} isOwnProfile={true} />;

        return null;
    }

    function renderSearchResults() {
        if (!isSearchVisible) return null;

        const results = (() => {
            if (activeMode === 'personal') return [...displayUsers, ...displayGroups];
            if (activeMode === 'work') return displayUsers.filter(u => u.role === 'admin');
            return displaySocialPosts;
        })();

        // Filter again if query exists (redundant but safe)
        const finalResults = searchQuery.trim()
            ? results.filter(item => {
                const q = searchQuery.toLowerCase();
                return (item.name?.toLowerCase().includes(q)) ||
                    (item.caption?.toLowerCase().includes(q));
            })
            : []; // Don't show everything when empty, show recent? For now show nothing or helper.

        return (
            <View style={{
                position: 'absolute',
                top: Platform.OS === 'ios' ? 170 : 160,
                left: 0, right: 0, bottom: 0,
                backgroundColor: theme.background,
                zIndex: 99
            }}>

                <View style={{ flex: 1 }}>
                    {searchQuery.length > 0 ? (
                        <FlatList
                            data={finalResults}
                            keyExtractor={(item, index) => item._id || index.toString()}
                            contentContainerStyle={{ padding: 20 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsSearchVisible(false);
                                        if (activeMode === 'social') {
                                            // Provide logic for "Go to post" if needed
                                        } else {
                                            router.push({
                                                pathname: item.members ? `/chat/group/${item._id}` : `/chat/${item._id}`,
                                                params: { name: item.name, profilePic: item.profilePic || '' }
                                            });
                                        }
                                    }}
                                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: theme.surface, padding: 12, borderRadius: 16, borderBottomWidth: 1, borderColor: theme.border }}
                                >
                                    {item.profilePic || item.mediaUrl ? (
                                        <Image
                                            source={{ uri: (item.profilePic || item.mediaUrl).startsWith('http') ? (item.profilePic || item.mediaUrl) : `${SERVER_URL}${item.profilePic || item.mediaUrl}` }}
                                            style={{ width: 44, height: 44, borderRadius: 22, marginRight: 15, backgroundColor: theme.inputBg }}
                                        />
                                    ) : (
                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                            <Ionicons name={item.members ? "people" : "person"} size={20} color={theme.textSecondary} />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: theme.textPrimary, fontWeight: 'bold', fontSize: 16 }}>{item.name || item.caption || "Unnamed"}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.email || (item.user?.name ? `by ${item.user.name}` : "Details")}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={{ alignItems: 'center', marginTop: 50 }}>
                                    <Text style={{ color: theme.textSecondary }}>No results found</Text>
                                </View>
                            }
                        />
                    ) : (
                        <TouchableOpacity activeOpacity={1} onPress={() => setIsSearchVisible(false)} style={{ flex: 1 }}>
                            {/* Silent backdrop to close */}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    }

    // --- Main Render ---
    return (
        <View style={styles.safeArea}>
            <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

            <View style={styles.contentContainer}>
                {renderContent()}
            </View>

            <BottomNavBar
                mode={activeMode}
                activeTab={activeTab}
                onTabPress={handleTabPress}
                theme={theme}
            />

            {/* Modals */}
            {renderCreatePostModal()}
            {renderSidebar()}
            {renderMeetModal()}
            {renderTextStatusCreator()}
            {renderSuccessMeetModal()}
            {renderSearchResults()}
            {renderGroupCreationModal()}
        </View>
    );

    // --- Render Helpers ---

    function renderCreatePostModal() {
        return (
            <CreatePostModal
                visible={createPostVisible}
                onClose={() => setCreatePostVisible(false)}
                media={newPostMedia}
                type={newPostType}
                userId={currentUserId}
                onSuccess={() => {
                    fetchSocialPosts(); // Refresh feed
                }}
            />
        );
    }

    function renderSidebar() {
        return (
            <Modal visible={showSidebar} transparent animationType="fade" onRequestClose={() => setShowSidebar(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'transparent' }} onPress={() => setShowSidebar(false)} activeOpacity={1}>
                    <View style={{
                        position: 'absolute',
                        top: 50,
                        right: 10,
                        width: 240,
                        backgroundColor: theme.surface,
                        borderRadius: 8,
                        paddingVertical: 10,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5
                    }}>
                        <TouchableOpacity onPress={() => { setShowSidebar(false); setIsAnnouncementGroup(false); setCreateGroupModalVisible(true); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>New group</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); setIsAnnouncementGroup(true); setCreateGroupModalVisible(true); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>New community</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); router.push('/features/archived'); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Archived chats</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); router.push('/features/starred'); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Starred messages</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); router.push('/features/blocked'); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Blocked users</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); router.push('/settings'); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Settings</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); router.push('/settings/help'); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Help / Support</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); router.push('/linked-devices'); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Linked devices</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { togglePrivacy(); setShowSidebar(false); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>{isNumberHidden ? "Show phone number" : "Hide phone number"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setShowSidebar(false); handleLogout(); }} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    }

    function renderMeetModal() {
        return (
            <Modal animationType="slide" transparent visible={meetModalVisible} onRequestClose={() => setMeetModalVisible(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setMeetModalVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ backgroundColor: theme.surface, padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30 }}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: theme.textPrimary }}>Meetings</Text>

                        {/* Tabs - Only show if Admin */}
                        {userRole === 'admin' ? (
                            <View style={{ flexDirection: 'row', marginBottom: 20, backgroundColor: theme.inputBg, borderRadius: 12, padding: 4 }}>
                                <TouchableOpacity onPress={() => setMeetTab('join')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: meetTab === 'join' ? theme.surface : 'transparent', borderRadius: 10 }}>
                                    <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Join</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setMeetTab('scheduled')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: meetTab === 'scheduled' ? theme.surface : 'transparent', borderRadius: 10 }}>
                                    <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Schedule</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setMeetTab('instant')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: meetTab === 'instant' ? theme.surface : 'transparent', borderRadius: 10 }}>
                                    <Text style={{ fontWeight: '600', color: theme.textPrimary }}>Instant</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {meetTab === 'scheduled' && userRole === 'admin' && (
                            <View>
                                <TextInput
                                    placeholder="Meeting Title"
                                    placeholderTextColor={theme.textLight}
                                    style={{ borderWidth: 1, borderColor: theme.border, padding: 15, borderRadius: 12, fontSize: 16, color: theme.textPrimary, marginBottom: 15 }}
                                    value={meetTitle}
                                    onChangeText={setMeetTitle}
                                />

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flex: 1, marginRight: 10, padding: 15, borderWidth: 1, borderColor: theme.border, borderRadius: 12, alignItems: 'center' }}>
                                        <Text style={{ color: theme.textPrimary }}>{meetDate.toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setShowTimePicker(true)} style={{ flex: 1, marginLeft: 10, padding: 15, borderWidth: 1, borderColor: theme.border, borderRadius: 12, alignItems: 'center' }}>
                                        <Text style={{ color: theme.textPrimary }}>{meetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </TouchableOpacity>
                                </View>

                                {(showDatePicker || showTimePicker) && (
                                    <DateTimePicker
                                        value={meetDate}
                                        mode={showDatePicker ? 'date' : 'time'}
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(false);
                                            setShowTimePicker(false);
                                            if (selectedDate) setMeetDate(selectedDate);
                                        }}
                                    />
                                )}

                                <TouchableOpacity style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 16, alignItems: 'center' }} onPress={scheduleMeeting}>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Schedule Meeting</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {(meetTab === 'join' || userRole !== 'admin') ? (
                            <>
                                <TextInput
                                    placeholder="Enter Room Code"
                                    placeholderTextColor={theme.textLight}
                                    style={{ borderWidth: 1, borderColor: theme.border, padding: 15, borderRadius: 12, fontSize: 16, color: theme.textPrimary, marginBottom: 20 }}
                                    value={joinCode}
                                    onChangeText={setJoinCode}
                                />
                                <TouchableOpacity
                                    style={{ backgroundColor: '#5856D6', padding: 16, borderRadius: 16, alignItems: 'center' }}
                                    onPress={async () => {
                                        if (!joinCode.trim()) return Alert.alert("Error", "Enter code");
                                        try {
                                            const res = await fetch(`${SERVER_URL}/api/auth/meet/verify`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ code: joinCode.trim() })
                                            });
                                            const data = await res.json();
                                            if (res.ok && data.success) {
                                                const meeting = data.meeting;
                                                // Time Check
                                                if (meeting.scheduledTime) {
                                                    const meetingTime = new Date(meeting.scheduledTime);
                                                    const now = new Date();
                                                    // Buffer 10 mins
                                                    const timeDiff = meetingTime - now;
                                                    const isEarly = timeDiff > 10 * 60 * 1000;

                                                    if (isEarly) {
                                                        if (userRole === 'admin') {
                                                            // Admin Override Prompt
                                                            return Alert.alert(
                                                                "Scheduled Future Meeting",
                                                                `This meeting is set for ${meetingTime.toLocaleTimeString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.\nDo you want to start it now?`,
                                                                [
                                                                    { text: "Cancel", style: "cancel" },
                                                                    {
                                                                        text: "Start Anyway",
                                                                        onPress: async () => {
                                                                            try {
                                                                                await fetch(`${SERVER_URL}/api/auth/meet/start`, {
                                                                                    method: 'POST',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ code: joinCode.trim() })
                                                                                });
                                                                                setMeetModalVisible(false);
                                                                                router.push(`/meet/${joinCode.trim()}`);
                                                                            } catch (e) { console.error("Start Error:", e); }
                                                                        }
                                                                    }
                                                                ]
                                                            );
                                                        } else {
                                                            // User Block
                                                            return Alert.alert(
                                                                "Not Started",
                                                                `This meeting is scheduled for ${meetingTime.toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.\nPlease join at the scheduled time.`
                                                            );
                                                        }
                                                    }
                                                }

                                                setMeetModalVisible(false);
                                                router.push(`/meet/${joinCode.trim()}`);
                                            } else {
                                                Alert.alert("Invalid Meeting", "The meeting code you entered is incorrect or expired.");
                                            }
                                        } catch (e) { Alert.alert("Error", "Connection failed"); }
                                    }}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Join Now</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                <Ionicons name="flash" size={50} color={theme.primary} style={{ marginBottom: 15 }} />
                                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: 20 }}>Create a new meeting instantly and share the code.</Text>
                                <TouchableOpacity
                                    style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 16, alignItems: 'center', width: '100%' }}
                                    onPress={createInstantMeet}
                                >
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Start Instant Meeting</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </TouchableOpacity>
            </Modal>
        );
    }


    function renderTextStatusCreator() {
        return (
            <Modal visible={textStatusVisible} animationType="slide">
                <View style={{ flex: 1, backgroundColor: statusColor, justifyContent: 'center', alignItems: 'center' }}>
                    <SafeAreaView style={{ width: '100%', height: '100%', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', width: '90%', justifyContent: 'space-between', marginTop: 20 }}>
                            <TouchableOpacity onPress={() => setTextStatusVisible(false)}><Ionicons name="close" size={30} color="white" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleCreateStatus('text')}><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Post</Text></TouchableOpacity>
                        </View>
                        <TextInput value={statusText} onChangeText={setStatusText} placeholder="Type a status..." placeholderTextColor="rgba(255,255,255,0.6)" style={{ fontSize: 30, color: 'white', textAlign: 'center', flex: 1, width: '80%' }} multiline autoFocus />
                        <View style={{ flexDirection: 'row', marginBottom: 30, gap: 15 }}>
                            {STATUS_COLORS.map(c => <TouchableOpacity key={c} onPress={() => setStatusColor(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 2, borderColor: 'white' }} />)}
                        </View>
                        <View style={{ flexDirection: 'row', marginBottom: 20, gap: 20 }}>
                            <TouchableOpacity onPress={pickStatusImage} style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 }}>
                                <Ionicons name="image" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>
        );
    }

    function renderSuccessMeetModal() {
        return (
            <Modal transparent visible={successMeetModalVisible} onRequestClose={() => setSuccessMeetModalVisible(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setSuccessMeetModalVisible(false)}>
                    <View style={{ backgroundColor: theme.surface, padding: 30, borderRadius: 30, alignItems: 'center', width: '85%' }}>
                        <Ionicons name="checkmark-circle" size={80} color="#4CD964" />
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.textPrimary, marginVertical: 10 }}>Success!</Text>

                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginVertical: 15 }}
                            onPress={() => {
                                import('expo-clipboard').then(Clipboard => {
                                    Clipboard.setStringAsync(createdCode);
                                    Alert.alert("Copied to clipboard");
                                });
                            }}
                        >
                            <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.textPrimary, marginRight: 15, letterSpacing: 2 }}>{createdCode}</Text>
                            <Ionicons name="copy-outline" size={24} color={theme.primary} />
                        </TouchableOpacity>

                        <Text style={{ color: theme.textSecondary, marginBottom: 20, textAlign: 'center' }}>Share this code with others to join.</Text>

                        <TouchableOpacity style={{ backgroundColor: theme.primary, padding: 15, borderRadius: 15, width: '100%', alignItems: 'center' }} onPress={() => { setSuccessMeetModalVisible(false); router.push(`/meet/${createdCode}`); }}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Join Now</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    }
}

function getStyles(theme) {
    return StyleSheet.create({
        safeArea: { flex: 1, backgroundColor: theme.background },
        header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.background },
        headerTitle: { fontSize: 34, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
        headerSubtitle: { fontSize: 16, color: theme.textSecondary, fontWeight: '500', marginTop: 2 },
        profileBtn: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
        profilePicParams: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: theme.surface },
        contentContainer: { flex: 1, backgroundColor: theme.background },

        // Mode Selector Styles
        modalOverlay: { flex: 1, justifyContent: 'flex-end' },
        blurContainer: { flex: 1, justifyContent: 'flex-end' },
        modeSelectorCard: { backgroundColor: theme.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, paddingBottom: 50, shadowColor: "#000", shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 },
        modeSelectorTitle: { fontSize: 22, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 25, textAlign: 'center' },
        modeOptionsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
        modeOption: { alignItems: 'center', flex: 1 },
        modeIconContainer: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
        modeLabel: { fontSize: 14, fontWeight: '600' }
    });
}
