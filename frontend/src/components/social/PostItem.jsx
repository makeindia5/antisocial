import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Animated, TouchableWithoutFeedback, Modal, PanResponder, Alert, Share, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useRouter } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../services/apiService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SERVER_ROOT = API_BASE.replace('/api/auth', '');

export default function PostItem({ post, theme, onOpenComments, onOpenShare }) {
    const router = useRouter();
    const [likes, setLikes] = useState(post.likes || []);
    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [lastTap, setLastTap] = useState(0);
    const [optionsVisible, setOptionsVisible] = useState(false);
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editCaptionText, setEditCaptionText] = useState('');

    const [currentUserId, setCurrentUserId] = useState(null);
    const [isOwner, setIsOwner] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);

    const [hideLikes, setHideLikes] = useState(post.hideLikes || false);
    const [hideShares, setHideShares] = useState(post.hideShares || false);
    const [turnOffCommenting, setTurnOffCommenting] = useState(post.turnOffCommenting || false);
    const [isPinned, setIsPinned] = useState(post.isPinned || false);
    const [caption, setCaption] = useState(post.caption || '');

    const updateSetting = async (field, value) => {
        try {
            const res = await fetch(`${API_BASE}/posts/${post._id}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, [field]: value })
            });
            const data = await res.json();
            if (data.success) {
                if (field === 'hideLikes') setHideLikes(value);
                if (field === 'hideShares') setHideShares(value);
                if (field === 'turnOffCommenting') setTurnOffCommenting(value);
                if (field === 'isPinned') setIsPinned(value);
                if (field === 'isArchived') {
                    Alert.alert("Archived", "Post has been archived.");
                    setOptionsVisible(false);
                }
            } else {
                Alert.alert("Error", data.error || "Failed to update setting");
            }
        } catch (e) { console.error(e); }
    };

    const handleEditCaption = () => {
        setOptionsVisible(false);
        setEditCaptionText(caption);
        setEditModalVisible(true);
    };

    const submitEditCaption = async () => {
        try {
            const res = await fetch(`${API_BASE}/posts/${post._id}/edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, caption: editCaptionText })
            });
            const data = await res.json();
            if (data.success) {
                setCaption(editCaptionText);
                setEditModalVisible(false);
            } else {
                Alert.alert("Error", data.error || "Failed to update caption");
            }
        } catch (e) { console.error(e); }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete", style: "destructive", onPress: async () => {
                        try {
                            const res = await fetch(`${API_BASE}/posts/delete`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ postId: post._id, userId: currentUserId })
                            });
                            setOptionsVisible(false);
                            setIsDeleted(true);
                        } catch (e) { console.error(e); }
                    }
                }
            ]
        );
    };

    // Animation Values for Heart
    const heartScale = useState(new Animated.Value(0))[0];
    const heartOpacity = useState(new Animated.Value(0))[0];

    const getImageUrl = (url) => {
        if (!url) return null; // We'll handle nulls where Image is rendered
        if (url.startsWith('http')) return url;
        return `${SERVER_ROOT}${url}`;
    };

    useEffect(() => {
        const init = async () => {
            try {
                const id = await AsyncStorage.getItem('userId');
                setCurrentUserId(id);
                if (id && (String(post.user?._id) === String(id) || String(post.user) === String(id))) {
                    setIsOwner(true);
                } else {
                    setIsOwner(false);
                }
                if (post.likes?.includes(id)) setLiked(true);
            } catch (e) { console.error(e); }
        };
        init();
    }, [post]);

    const toggleLike = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/posts/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId: post._id, userId })
            });
            const data = await res.json();
            if (data.success) {
                setLikes(data.likes);
                setLiked(!liked);
            }
        } catch (e) { console.log(e); }
    };

    const handleDoubleTap = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
            if (!liked) toggleLike();
            animateHeart();
        } else {
            setLastTap(now);
        }
    };

    const animateHeart = () => {
        heartScale.setValue(0);
        heartOpacity.setValue(1);
        Animated.sequence([
            Animated.spring(heartScale, {
                toValue: 1,
                useNativeDriver: true,
                friction: 3
            }),
            Animated.timing(heartOpacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true
            })
        ]).start();
    };

    const toggleSave = () => setSaved(!saved);

    const handleProfilePress = () => {
        if (post.user?._id) {
            router.push({
                pathname: '/social/profile/[id]',
                params: { id: post.user._id }
            });
        }
    };

    const formatTime = (date) => {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffDay > 0) return `${diffDay}d ago`;
        if (diffHour > 0) return `${diffHour}h ago`;
        if (diffMin > 0) return `${diffMin}m ago`;
        return 'Just now';
    };

    // Zoom Logic
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const [isZooming, setIsZooming] = useState(false);

    const initialDistance = useRef(null);
    const initialMidX = useRef(null);
    const initialMidY = useRef(null);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: (evt, gestureState) => evt.nativeEvent.touches.length === 2,
            onMoveShouldSetPanResponder: (evt, gestureState) => evt.nativeEvent.touches.length === 2,
            onPanResponderGrant: (evt, gestureState) => {
                if (evt.nativeEvent.touches.length === 2) {
                    setIsZooming(true);
                    const touches = evt.nativeEvent.touches;
                    const distance = Math.sqrt(
                        Math.pow(touches[0].pageX - touches[1].pageX, 2) +
                        Math.pow(touches[0].pageY - touches[1].pageY, 2)
                    );
                    initialDistance.current = distance;
                }
            },
            onPanResponderMove: (evt, gestureState) => {
                const touches = evt.nativeEvent.touches;
                if (touches.length === 2 && initialDistance.current) {
                    const currentDistance = Math.sqrt(
                        Math.pow(touches[0].pageX - touches[1].pageX, 2) +
                        Math.pow(touches[0].pageY - touches[1].pageY, 2)
                    );

                    const newScale = currentDistance / initialDistance.current;
                    scale.setValue(Math.max(1, newScale));

                    // Calculate center point movement
                    const midX = (touches[0].pageX + touches[1].pageX) / 2;
                    const midY = (touches[0].pageY + touches[1].pageY) / 2;

                    if (!initialMidX.current) {
                        initialMidX.current = midX;
                        initialMidY.current = midY;
                    }

                    translateX.setValue(midX - initialMidX.current);
                    translateY.setValue(midY - initialMidY.current);
                }
            },
            onPanResponderRelease: () => {
                setIsZooming(false);
                initialDistance.current = null;
                initialMidX.current = null;
                initialMidY.current = null;

                Animated.parallel([
                    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }),
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }),
                    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7 })
                ]).start();
            }
        })
    ).current;

    if (isDeleted) return null;

    const renderOptionsModal = () => (
        <Modal
            visible={optionsVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setOptionsVisible(false)}
        >
            <TouchableOpacity
                style={styles.modalBackdrop}
                activeOpacity={1}
                onPress={() => setOptionsVisible(false)}
            >
                <View style={[styles.optionsSheet, { backgroundColor: theme.surface }]}>
                    <View style={styles.sheetGrabber} />

                    <View style={{ width: '100%', flexShrink: 1 }}>
                        <Animated.ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                            {/* Top Row: Save & QR */}
                            <View style={styles.topRowOptions}>
                                <TouchableOpacity
                                    style={styles.pillOption}
                                    onPress={() => { toggleSave(); setOptionsVisible(false); }}
                                >
                                    <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={theme.textPrimary} />
                                    <Text style={[styles.pillText, { color: theme.textPrimary }]}>{saved ? 'Saved' : 'Save'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.pillOption}
                                    onPress={() => { setOptionsVisible(false); setTimeout(() => setQrModalVisible(true), 100); }}
                                >
                                    <Ionicons name="qr-code-outline" size={24} color={theme.textPrimary} />
                                    <Text style={[styles.pillText, { color: theme.textPrimary }]}>QR code</Text>
                                </TouchableOpacity>
                            </View>

                            {isOwner ? (
                                <View style={[styles.optionsGroup, { borderTopColor: theme.border }]}>
                                    <TouchableOpacity style={styles.groupItem} onPress={() => { Share.share({ message: `Check out this post: post:${post._id}` }); setOptionsVisible(false); }}>
                                        <Ionicons name="logo-facebook" size={24} color={theme.textPrimary} />
                                        <Text style={[styles.groupText, { color: theme.textPrimary }]}>Share to Facebook</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.groupItem} onPress={() => updateSetting('isArchived', true)}>
                                        <Ionicons name="time-outline" size={24} color={theme.textPrimary} />
                                        <Text style={[styles.groupText, { color: theme.textPrimary }]}>Archive</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.groupItem} onPress={() => updateSetting('hideLikes', !hideLikes)}>
                                        <Ionicons name={hideLikes ? "heart" : "heart-dislike-outline"} size={24} color={theme.textPrimary} />
                                        <Text style={[styles.groupText, { color: theme.textPrimary }]}>{hideLikes ? 'Show like count' : 'Hide like count'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.groupItem} onPress={() => updateSetting('hideShares', !hideShares)}>
                                        <Ionicons name={hideShares ? "paper-plane" : "paper-plane-outline"} size={24} color={theme.textPrimary} />
                                        <Text style={[styles.groupText, { color: theme.textPrimary }]}>{hideShares ? 'Show share count' : 'Hide share count'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.groupItem} onPress={() => updateSetting('turnOffCommenting', !turnOffCommenting)}>
                                        <Ionicons name={turnOffCommenting ? "chatbubble" : "chatbubble-outline"} size={24} color={theme.textPrimary} />
                                        <Text style={[styles.groupText, { color: theme.textPrimary }]}>{turnOffCommenting ? 'Turn on commenting' : 'Turn off commenting'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.groupItem} onPress={handleEditCaption}>
                                        <Ionicons name="pencil-outline" size={24} color={theme.textPrimary} />
                                        <Text style={[styles.groupText, { color: theme.textPrimary }]}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.groupItem} onPress={handleDelete}>
                                        <Ionicons name="trash-outline" size={24} color="#ff3040" />
                                        <Text style={[styles.groupText, { color: "#ff3040" }]}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <View style={[styles.optionsGroup, { borderTopColor: theme.border }]}>
                                        <TouchableOpacity
                                            style={styles.groupItem}
                                            onPress={() => { Alert.alert("Favorites", "Post added to your favourites!"); setOptionsVisible(false); }}
                                        >
                                            <Ionicons name="star-outline" size={24} color={theme.textPrimary} />
                                            <Text style={[styles.groupText, { color: theme.textPrimary }]}>Add to favourites</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.groupItem}
                                            onPress={() => {
                                                Alert.alert(
                                                    "Unfollow",
                                                    `Are you sure you want to unfollow ${post.user?.name}?`,
                                                    [
                                                        { text: "Cancel", style: "cancel" },
                                                        { text: "Unfollow", style: "destructive", onPress: () => setOptionsVisible(false) }
                                                    ]
                                                );
                                            }}
                                        >
                                            <Ionicons name="person-remove-outline" size={24} color={theme.textPrimary} />
                                            <Text style={[styles.groupText, { color: theme.textPrimary }]}>Unfollow</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.optionsGroup, { borderTopColor: theme.border }]}>
                                        <TouchableOpacity
                                            style={styles.groupItem}
                                            onPress={() => { Alert.alert("About", "This account was created in 2024. All posts are verified."); setOptionsVisible(false); }}
                                        >
                                            <Ionicons name="information-circle-outline" size={24} color={theme.textPrimary} />
                                            <Text style={[styles.groupText, { color: theme.textPrimary }]}>About this account</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.groupItem}
                                            onPress={() => { Alert.alert("Hidden", "This post will be hidden from your feed."); setOptionsVisible(false); }}
                                        >
                                            <Ionicons name="eye-off-outline" size={24} color={theme.textPrimary} />
                                            <Text style={[styles.groupText, { color: theme.textPrimary }]}>Hide</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.groupItem}
                                            onPress={() => { Alert.alert("Reported", "Thank you for reporting. We will review this post."); setOptionsVisible(false); }}
                                        >
                                            <Ionicons name="warning-outline" size={24} color="#ff3040" />
                                            <Text style={[styles.groupText, { color: "#ff3040" }]}>Report</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </Animated.ScrollView>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    const renderQRModal = () => (
        <Modal
            visible={qrModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setQrModalVisible(false)}
        >
            <TouchableOpacity
                style={styles.qrBackdrop}
                activeOpacity={1}
                onPress={() => setQrModalVisible(false)}
            >
                <View style={[styles.qrContainer, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.qrTitle, { color: theme.textPrimary }]}>QR code</Text>
                    <Image
                        source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=post:${post._id}` }}
                        style={styles.qrImage}
                    />
                    <Text style={[styles.qrUsername, { color: theme.textPrimary }]}>@{post.user?.name?.toLowerCase().replace(/\s/g, '')}</Text>
                    <TouchableOpacity
                        style={[styles.shareQrBtn, { backgroundColor: theme.primary }]}
                        onPress={() => {
                            Share.share({
                                message: `Check out this post on Intraa: post:${post._id}`,
                            });
                        }}
                    >
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Share link</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    const renderEditModal = () => (
        <Modal
            visible={editModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setEditModalVisible(false)}
        >
            <View style={styles.editBackdrop}>
                <View style={[styles.editContainer, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.editTitle, { color: theme.textPrimary }]}>Edit Caption</Text>
                    <TextInput
                        style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.border }]}
                        value={editCaptionText}
                        onChangeText={setEditCaptionText}
                        multiline
                        autoFocus
                    />
                    <View style={styles.editActions}>
                        <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.editCancelBtn}>
                            <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={submitEditCaption} style={[styles.editSaveBtn, { backgroundColor: theme.primary }]}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={styles.container}>
            {renderOptionsModal()}
            {renderQRModal()}
            {renderEditModal()}
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerLeft} onPress={handleProfilePress}>
                    {getImageUrl(post.user?.profilePic) ? (
                        <Image
                            source={{ uri: getImageUrl(post.user?.profilePic) }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="person" size={20} color={theme.textSecondary} />
                        </View>
                    )}
                    <Text style={[styles.username, { color: theme.textPrimary }]}>{post.user?.name || 'Unknown User'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setOptionsVisible(true)}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Media */}
            <View style={[styles.mediaContainer, isZooming && { zIndex: 1000 }]}>
                <View
                    style={{ flex: 1 }}
                    {...panResponder.panHandlers}
                >
                    <TouchableWithoutFeedback
                        onPress={handleDoubleTap}
                    >
                        <Animated.View style={{
                            flex: 1,
                            transform: [
                                { scale: scale },
                                { translateX: translateX },
                                { translateY: translateY }
                            ]
                        }}>
                            {post.type === 'video' ? (
                                <Video
                                    source={{ uri: getImageUrl(post.mediaUrl) }}
                                    style={styles.media}
                                    resizeMode="cover"
                                    shouldPlay={false}
                                    isLooping
                                    useNativeControls={false}
                                />
                            ) : (
                                <Image source={{ uri: getImageUrl(post.mediaUrl) }} style={styles.media} />
                            )}

                            {/* Heart Animation Overlay */}
                            <View style={StyleSheet.absoluteFillObject}>
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <Animated.View style={{
                                        transform: [{ scale: heartScale }],
                                        opacity: heartOpacity
                                    }}>
                                        <Ionicons name="heart" size={100} color="white" />
                                    </Animated.View>
                                </View>
                            </View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </View>


            {/* Actions */}
            <View style={styles.actionRow}>
                <View style={styles.actionLeft}>
                    <TouchableOpacity onPress={toggleLike} style={styles.actionBtn}>
                        <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? "#ff3040" : theme.textPrimary} />
                    </TouchableOpacity>
                    {!turnOffCommenting && (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenComments && onOpenComments(post)}>
                            <Ionicons name="chatbubble-outline" size={24} color={theme.textPrimary} />
                        </TouchableOpacity>
                    )}
                    {!hideShares && (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenShare && onOpenShare(post)}>
                            <Ionicons name="paper-plane-outline" size={24} color={theme.textPrimary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity onPress={toggleSave}>
                    <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Info / Caption */}
            <View style={styles.infoContainer}>
                {!hideLikes && <Text style={[styles.likes, { color: theme.textPrimary }]}>{(likes || []).length} likes</Text>}
                <View style={styles.captionRow}>
                    <TouchableOpacity onPress={handleProfilePress}>
                        <Text style={[styles.username, { color: theme.textPrimary, fontSize: 13 }]}>{post.user?.name}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.caption, { color: theme.textPrimary }]}> {caption}</Text>
                </View>
                {!turnOffCommenting && post.comments?.length > 0 && (
                    <TouchableOpacity onPress={() => onOpenComments && onOpenComments(post)}>
                        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
                            View all {post.comments?.length || 0} comments
                        </Text>
                    </TouchableOpacity>
                )}
                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 4 }}>{formatTime(post.createdAt)}</Text>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 15,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    username: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    mediaContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH * 1.0, // 1:1 or 4:5 Aspect Ratio
        backgroundColor: '#eee',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10
    },
    actionBtn: {
        marginRight: 16,
    },
    infoContainer: {
        paddingHorizontal: 12,
    },
    likes: {
        fontWeight: 'bold',
        fontSize: 13,
        marginBottom: 4,
    },
    captionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    caption: {
        fontSize: 13,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 999
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    optionsSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 50,
        paddingTop: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
        width: '100%',
        maxHeight: '90%',
    },
    sheetGrabber: {
        width: 40,
        height: 5,
        backgroundColor: '#48484a',
        borderRadius: 2.5,
        marginVertical: 12,
    },
    topRowOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginVertical: 10,
    },
    pillOption: {
        flex: 0.48,
        height: 80,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(150,150,150,0.1)',
        borderWidth: 0.5,
        borderColor: 'rgba(150,150,150,0.2)',
    },
    pillText: {
        fontSize: 12,
        marginTop: 8,
        fontWeight: '500',
    },
    optionsGroup: {
        width: '100%',
        marginTop: 15,
        borderTopWidth: 0.5,
    },
    groupItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    groupText: {
        fontSize: 16,
        marginLeft: 15,
    },
    qrBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrContainer: {
        width: '80%',
        padding: 40,
        borderRadius: 30,
        alignItems: 'center',
    },
    qrTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 30,
    },
    qrImage: {
        width: 200,
        height: 200,
        backgroundColor: 'white',
        width: 200, height: 200, marginBottom: 15
    },
    qrUsername: {
        fontSize: 16, fontWeight: 'bold', marginBottom: 20
    },
    shareQrBtn: {
        width: '100%', paddingVertical: 12, alignItems: 'center', borderRadius: 8
    },
    editBackdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20
    },
    editContainer: {
        width: '100%', borderRadius: 12, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84
    },
    editTitle: {
        fontSize: 18, fontWeight: 'bold', marginBottom: 15
    },
    editInput: {
        borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 20
    },
    editActions: {
        flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center'
    },
    editCancelBtn: {
        paddingVertical: 10, paddingHorizontal: 15, marginRight: 10
    },
    editSaveBtn: {
        paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20
    }
});
