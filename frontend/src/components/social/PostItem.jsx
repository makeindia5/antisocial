import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Animated, TouchableWithoutFeedback, Modal, PanResponder, Alert, Share } from 'react-native';
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

    // Animation Values for Heart
    const heartScale = useState(new Animated.Value(0))[0];
    const heartOpacity = useState(new Animated.Value(0))[0];

    const getImageUrl = (url) => {
        if (!url) return 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        if (url.startsWith('http')) return url;
        return `${SERVER_ROOT}${url}`;
    };

    useEffect(() => {
        checkUserLiked();
    }, [post]);

    const checkUserLiked = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (post.likes?.includes(userId)) setLiked(true);
        } catch (e) { console.error(e); }
    };

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

                    {/* Middle Group */}
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

                    {/* Bottom Group */}
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

    return (
        <View style={styles.container}>
            {renderOptionsModal()}
            {renderQRModal()}
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerLeft} onPress={handleProfilePress}>
                    <Image
                        source={{ uri: getImageUrl(post.user?.profilePic) }}
                        style={styles.avatar}
                    />
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
                    <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenComments && onOpenComments(post)}>
                        <Ionicons name="chatbubble-outline" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenShare && onOpenShare(post)}>
                        <Ionicons name="paper-plane-outline" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={toggleSave}>
                    <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={theme.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Info / Caption */}
            <View style={styles.infoContainer}>
                <Text style={[styles.likes, { color: theme.textPrimary }]}>{(likes || []).length} likes</Text>
                <View style={styles.captionRow}>
                    <TouchableOpacity onPress={handleProfilePress}>
                        <Text style={[styles.username, { color: theme.textPrimary, fontSize: 13 }]}>{post.user?.name}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.caption, { color: theme.textPrimary }]}> {post.caption}</Text>
                </View>
                {post.comments?.length > 0 && (
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
        paddingBottom: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
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
        borderRadius: 20,
        padding: 20,
    },
    qrUsername: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 30,
    },
    shareQrBtn: {
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
    }
});
