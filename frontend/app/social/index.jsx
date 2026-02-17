import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, RefreshControl, Platform, StatusBar, Image, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, GlobalStyles } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../src/services/apiService';
const SERVER_ROOT = API_BASE.replace('/api/auth', '');

// Components
import SocialFeed from '../../src/components/social/SocialFeed';
import ReelsView from '../../src/components/social/ReelsView';
import SocialProfile from '../../src/components/social/SocialProfile';

export default function SocialScreen() {
    const router = useRouter();
    const { colors: theme } = useTheme();
    const [activeTab, setActiveTab] = useState('home'); // home, explore, create, reels, profile

    const [posts, setPosts] = useState([]);
    const [reels, setReels] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [explorePosts, setExplorePosts] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const userName = await AsyncStorage.getItem('userName');
            const userAvatar = await AsyncStorage.getItem('userAvatar');
            setCurrentUser({ _id: userId, name: userName, profilePic: userAvatar });

            fetchFeed();
            fetchReels();
            fetchStatuses();
            fetchExplore();
            fetchNotifications();
        } catch (e) { console.error(e); }
    };

    const fetchFeed = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/posts/feed?userId=${userId}`);
            const data = await res.json();
            if (Array.isArray(data)) setPosts(data);
        } catch (e) { console.error(e); }
    };

    const fetchReels = async () => {
        try {
            const res = await fetch(`${API_BASE}/reels/feed`);
            const data = await res.json();
            if (Array.isArray(data)) setReels(data);
        } catch (e) { console.error(e); }
    };

    const fetchStatuses = async () => {
        try {
            const res = await fetch(`${API_BASE}/status/feed`);
            const data = await res.json();
            if (Array.isArray(data)) setStatuses(data);
        } catch (e) { console.error(e); }
    };

    const fetchExplore = async () => {
        try {
            const res = await fetch(`${API_BASE}/posts/explore`);
            const data = await res.json();
            if (Array.isArray(data)) setExplorePosts(data);
        } catch (e) { console.error(e); }
    };

    const fetchNotifications = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/social/notifications/${userId}`);
            const data = await res.json();
            if (Array.isArray(data)) setNotifications(data);
        } catch (e) { console.error(e); }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchFeed(), fetchReels(), fetchStatuses(), fetchExplore(), fetchNotifications()]);
        setRefreshing(false);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return (
                    <SocialFeed
                        theme={theme}
                        posts={posts}
                        statuses={statuses}
                        currentUser={currentUser}
                        onRefresh={onRefresh}
                        refreshing={refreshing}
                    />
                );
            case 'explore':
                return (
                    <View style={{ flex: 1 }}>
                        <View style={[styles.searchBarContainer, { backgroundColor: theme.inputBg }]}>
                            <Ionicons name="search" size={20} color={theme.textSecondary} />
                            <Text style={{ marginLeft: 10, color: theme.textSecondary }}>Search</Text>
                        </View>
                        <ExploreGrid theme={theme} posts={explorePosts} />
                    </View>
                );
            case 'reels':
                return (
                    <ReelsView
                        reels={reels}
                        theme={theme}
                        onRefresh={onRefresh}
                        refreshing={refreshing}
                    />
                );
            case 'profile':
                return (
                    <SocialProfile
                        user={currentUser}
                        isOwnProfile={true}
                        theme={theme}
                    />
                );
            case 'notifications':
                return (
                    <FlatList
                        data={notifications}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.notifItem}>
                                <View style={styles.notifAvatarContainer}>
                                    <Image source={{ uri: `${SERVER_ROOT}${item.sender?.profilePic}` }} style={styles.notifAvatar} />
                                </View>
                                <Text style={{ color: theme.textPrimary, flex: 1, fontSize: 13 }}>
                                    <Text style={{ fontWeight: 'bold' }}>{item.sender?.name}</Text>
                                    {item.type === 'like' ? ' liked your post.' : (item.type === 'comment' ? ` commented: ${item.commentText}` : ' started following you.')}
                                </Text>
                                {(item.postId || item.reelId) && (
                                    <Image source={{ uri: `${SERVER_ROOT}${item.postId?.mediaUrl || item.reelId?.thumbnail}` }} style={styles.notifImage} />
                                )}
                            </TouchableOpacity>
                        )}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        ListEmptyComponent={() => (
                            <View style={GlobalStyles.containerCenter}>
                                <Ionicons name="heart-outline" size={60} color={theme.textLight} />
                                <Text style={{ color: theme.textSecondary, marginTop: 10 }}>No notifications yet</Text>
                            </View>
                        )}
                    />
                );
            default:
                return null;
        }
    };

    const ExploreGrid = ({ theme, posts }) => (
        <ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {posts.map((post, i) => (
                    <TouchableOpacity key={i} style={{ width: '33.33%', height: 120, padding: 1 }}>
                        <Image source={{ uri: post.mediaUrl.startsWith('http') ? post.mediaUrl : `${SERVER_ROOT}${post.mediaUrl}` }} style={{ width: '100%', height: '100%' }} />
                        {post.type === 'video' && <Ionicons name="play" size={16} color="white" style={{ position: 'absolute', bottom: 5, right: 5 }} />}
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: activeTab === 'reels' ? '#000' : theme.background }}>
            <StatusBar barStyle={activeTab === 'reels' ? 'light-content' : (theme.name === 'dark' ? 'light-content' : 'dark-content')} />
            {/* Header (Only for Home/Profile) */}
            {(activeTab === 'home' || activeTab === 'notifications') && (
                <View style={[styles.header, { borderBottomWidth: 0.5, borderBottomColor: theme.border }]}>
                    <Text style={[styles.logo, { color: theme.textPrimary }]}>
                        {activeTab === 'home' ? 'Intraa' : 'Notifications'}
                    </Text>
                    {activeTab === 'home' && (
                        <View style={styles.headerIcons}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => setActiveTab('notifications')}>
                                <Ionicons name="heart-outline" size={28} color={theme.textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/social/messages')}>
                                <Ionicons name="chatbubble-ellipses-outline" size={26} color={theme.textPrimary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Main Content */}
            <View style={{ flex: 1 }}>
                {renderContent()}
            </View>

            {/* Bottom Tab Bar */}
            <View style={[styles.tabBar, {
                backgroundColor: activeTab === 'reels' ? '#000' : theme.surface,
                borderTopColor: activeTab === 'reels' ? '#333' : theme.border
            }]}>
                <TabIcon name="home-outline" activeName="home" label="home" current={activeTab} onPress={() => setActiveTab('home')} theme={theme} isDark={activeTab === 'reels'} />
                <TabIcon name="search-outline" activeName="search" label="explore" current={activeTab} onPress={() => setActiveTab('explore')} theme={theme} isDark={activeTab === 'reels'} />
                <TabIcon name="add-square-outline" activeName="add-square" label="create" current={activeTab} onPress={() => router.push('/social/create')} theme={theme} isDark={activeTab === 'reels'} />
                <TabIcon name="play-circle-outline" activeName="play-circle" label="reels" current={activeTab} onPress={() => setActiveTab('reels')} theme={theme} isDark={activeTab === 'reels'} />
                <TabIcon name="person-circle-outline" activeName="person-circle" label="profile" current={activeTab} onPress={() => setActiveTab('profile')} theme={theme} isDark={activeTab === 'reels'} />
            </View>
        </SafeAreaView>
    );
}

function TabIcon({ name, activeName, label, current, onPress, theme, isDark }) {
    const isActive = current === label;
    return (
        <TouchableOpacity onPress={onPress} style={styles.tabItem}>
            <Ionicons
                name={isActive ? activeName : name}
                size={28}
                color={isActive ? (isDark ? '#fff' : theme.primary) : (isDark ? '#888' : theme.textSecondary)}
            />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    logo: {
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'serif',
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        marginLeft: 20,
    },
    tabBar: {
        flexDirection: 'row',
        height: 60,
        borderTopWidth: 0.5,
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: Platform.OS === 'ios' ? 20 : 5,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 15,
        padding: 10,
        borderRadius: 10,
    },
    notifItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    notifAvatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notifAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    notifImage: {
        width: 44,
        height: 44,
        borderRadius: 4,
        marginLeft: 10,
    }
});
