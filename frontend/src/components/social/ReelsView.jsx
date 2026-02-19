import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity,
    Image, Alert, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView,
    Platform, TouchableWithoutFeedback, Animated, StatusBar, PanResponder,
    Share, RefreshControl, ScrollView
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import io from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../services/apiService';
import CommentsModal from './modals/CommentsModal';
import ShareModal from './modals/ShareModal';

const { width, height } = Dimensions.get('window');
const SCREEN_HEIGHT = height;

const getVideoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    // Remove /api/auth to get base
    const base = API_BASE.replace('/api/auth', '');
    // Ensure url starts with /
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
};

const ReelItem = ({ item, isActive, currentUser, onLike, onOpenMenu, playbackSpeed, onOpenComments, uiVisible, toggleUi, isCommentsOpen, isHidden, onUndoHide, onShare, isFullScreen, onToggleFullScreen }) => {
    const video = useRef(null);

    const [isPlaying, setIsPlaying] = useState(true);

    useEffect(() => {
        let mounted = true;

        const playVideo = async () => {
            if (isActive && video.current) {
                try {
                    await video.current.playAsync();
                    if (mounted) {
                        video.current.setRateAsync(playbackSpeed, true);
                        setIsPlaying(true);
                    }
                } catch (e) {
                    // console.warn("Video play error:", e);
                }
            } else if (!isActive && video.current) {
                try {
                    await video.current.pauseAsync();
                } catch (e) { }
            }
        };

        playVideo();

        return () => {
            mounted = false;
            if (video.current) {
                video.current.unloadAsync();
            }
        };
    }, [isActive, playbackSpeed]);

    useEffect(() => {
        if (isActive) {
            if (isPlaying) {
                video.current?.playAsync();
            } else {
                video.current?.pauseAsync();
            }
        }
    }, [isPlaying, isActive]);

    const handleTap = () => {
        setIsPlaying(!isPlaying);
    };

    const isLiked = item.likes?.includes(currentUser?._id) || false;

    const videoSource = getVideoUrl(item.url);
    console.log(`[ReelItem] user: ${item.user?.name}, source: ${videoSource}`);



    return (
        <TouchableWithoutFeedback onPress={handleTap}>
            <View style={[styles.reelContainer, { height: SCREEN_HEIGHT }]}>
                <Video
                    ref={video}
                    style={styles.video}
                    source={{ uri: getVideoUrl(item.url) }}
                    resizeMode={ResizeMode.COVER}
                    isLooping
                    shouldPlay={isActive && isPlaying}
                    rate={playbackSpeed}
                    useNativeControls={false}
                    posterSource={item.thumbnail ? { uri: getVideoUrl(item.thumbnail) } : null}
                    posterStyle={{ resizeMode: 'cover' }}
                    usePoster={true}
                    onPlaybackStatusUpdate={status => {
                        if (status.didJustFinish) {
                            // Loop or auto-scroll logic
                        }
                    }}
                />

                {!isPlaying && (
                    <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
                        <Ionicons name="play" size={70} color="rgba(255,255,255,0.7)" />
                    </View>
                )}

                {isFullScreen && (
                    <TouchableOpacity
                        style={{
                            position: 'absolute',
                            bottom: 40,
                            alignSelf: 'center',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            paddingVertical: 10,
                            paddingHorizontal: 20,
                            borderRadius: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.3)',
                            zIndex: 2
                        }}
                        onPress={onToggleFullScreen}
                    >
                        <Ionicons name="resize-outline" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Exit Full Screen</Text>
                    </TouchableOpacity>
                )}

                {/* Hidden Blur Overlay */}
                {isHidden && (
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="eye-off-outline" size={50} color="white" style={{ marginBottom: 20 }} />
                            <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Post Hidden</Text>
                            <Text style={{ color: '#ccc', marginBottom: 30 }}>You won't see this post again.</Text>
                            <TouchableOpacity style={{ backgroundColor: '#333', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 }} onPress={onUndoHide}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Undo</Text>
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                )}

                {/* Overlay UI - Hidden when uiVisible is false OR isFullScreen is true */}
                {uiVisible && !isHidden && !isFullScreen && (
                    <View style={styles.overlay}>
                        <View style={styles.bottomInfo}>
                            <View style={styles.userInfo}>
                                <View style={styles.avatarPlaceholder}>
                                    {item.user?.profilePic ? (
                                        <Image source={{ uri: `${API_BASE.replace('/api/auth', '')}${item.user.profilePic}` }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                    ) : null}
                                </View>
                                <Text style={styles.username}>{item.user?.name || 'User'}</Text>
                                <TouchableOpacity style={styles.followBtn}>
                                    <Text style={styles.followText}>Follow</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.caption}>{item.caption}</Text>
                        </View>

                        {/* Right Actions */}
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.actionItem} onPress={() => onLike(item._id)}>
                                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={35} color={isLiked ? "red" : "white"} style={styles.shadowIcon} />
                                <Text style={styles.actionText}>{item.likes?.length || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => onOpenComments(item)}>
                                <Ionicons name="chatbubble-outline" size={35} color="white" style={styles.shadowIcon} />
                                <Text style={styles.actionText}>{item.comments?.length || 0}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => onShare()}>
                                <Ionicons name="paper-plane-outline" size={35} color="white" style={styles.shadowIcon} />
                                <Text style={styles.actionText}>Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionItem} onPress={() => onOpenMenu(item)}>
                                <Ionicons name="ellipsis-vertical" size={30} color="white" style={styles.shadowIcon} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
};

const ReelOptionsModal = ({ visible, onClose, onOptionSelect, currentSpeed, isOwner, reelUser, onHide, isFullScreen }) => {
    const [currentView, setCurrentView] = React.useState('main'); // main, speed, quality, not_interested
    const panY = useRef(new Animated.Value(0)).current;

    // Reset view on close
    React.useEffect(() => {
        if (!visible) {
            setCurrentView('main');
        } else {
            panY.setValue(0);
        }
    }, [visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gestureState) => {
                // Close if dragged down far enough OR if it was a tap (minimal movement)
                if (gestureState.dy > 100 || (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5)) {
                    onClose();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true
                    }).start();
                }
            },
        })
    ).current;

    const getSpeedLabel = (speed) => {
        if (speed === 1) return '1x (Normal)';
        return `${speed}x`;
    };

    const [qrVisible, setQrVisible] = React.useState(false);

    const renderQRContent = () => (
        <View style={{ alignItems: 'center', padding: 20 }}>
            <View style={styles.grabber} />
            <Text style={[styles.menuTitle, { fontSize: 20, marginBottom: 20 }]}>Reel QR Code</Text>
            <Image
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=reel:${reelUser?._id}` }}
                style={{ width: 200, height: 200, backgroundColor: 'white', borderRadius: 15, padding: 10 }}
            />
            <Text style={[styles.menuSubtitle, { marginTop: 15, fontSize: 14 }]}>@{reelUser?.name?.toLowerCase().replace(/\s/g, '')}</Text>
            <TouchableOpacity
                style={[styles.followBtn, { marginTop: 30, paddingHorizontal: 40, paddingVertical: 10, borderColor: '#007AFF' }]}
                onPress={() => {
                    Share.share({
                        message: `Check out this reel on Intraa: reel:${reelUser?._id}`,
                    });
                }}
            >
                <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Share link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => setCurrentView('main')}>
                <Text style={{ color: 'white' }}>Back</Text>
            </TouchableOpacity>
        </View>
    );

    const renderMainContent = () => (
        <>
            <View
                style={{ width: '100%', alignItems: 'center', paddingVertical: 20 }}
                {...panResponder.panHandlers}
            >
                <View style={styles.grabber} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Section 1: Interest */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => onOptionSelect('interested')}>
                        <Ionicons name="add-circle-outline" size={24} color="white" />
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>Interested</Text>
                            <Text style={styles.menuSubtitle}>More of your reels will be like this.</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentView('not_interested')}>
                        <Ionicons name="remove-circle-outline" size={24} color="white" />
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>Not interested</Text>
                            <Text style={styles.menuSubtitle}>Fewer of your reels will be like this.</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Section 2: Actions */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => onOptionSelect('save')}>
                        <Ionicons name="bookmark-outline" size={24} color="white" />
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>Save reel</Text>
                            <Text style={styles.menuSubtitle}>Add this to your saved reels.</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentView('qr')}>
                        <Ionicons name="qr-code-outline" size={24} color="white" />
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>QR code</Text>
                            <Text style={styles.menuSubtitle}>Share this reel via QR.</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => onOptionSelect('remix')}>
                        <Ionicons name="git-compare-outline" size={24} color="#666" />
                        <View style={styles.menuTextContainer}>
                            <Text style={[styles.menuTitle, { color: '#666' }]}>Remix this reel</Text>
                            <Text style={[styles.menuSubtitle, { color: '#666' }]}>Only videos originally created as reels can be remixed.</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Section 3: Owner Actions */}
                {isOwner && (
                    <View style={styles.menuGroup}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => onOptionSelect('delete')}>
                            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                            <View style={styles.menuTextContainer}>
                                <Text style={[styles.menuTitle, { color: '#FF3B30' }]}>Delete</Text>
                                <Text style={styles.menuSubtitle}>Permanently remove this reel.</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Section 4: Settings */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentView('speed')}>
                        <Ionicons name="speedometer-outline" size={24} color="white" />
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>Playback speed</Text>
                            <Text style={styles.menuSubtitle}>{getSpeedLabel(currentSpeed)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => setCurrentView('quality')}>
                        <Ionicons name="settings-outline" size={24} color="white" />
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>Quality settings</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => onOptionSelect('full_screen')}>
                        <Ionicons name={isFullScreen ? "resize-outline" : "scan-outline"} size={24} color="white" />
                        <View style={styles.menuTextContainer}>
                            <Text style={styles.menuTitle}>{isFullScreen ? "Exit full screen" : "Full screen"}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </>
    );

    const renderSubMenu = (title, options, onBack) => (
        <>
            <View style={styles.subMenuHeader}>
                <TouchableOpacity onPress={onBack} style={{ padding: 10 }}>
                    <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.subMenuTitle}>{title}</Text>
                <View style={{ width: 44 }} />
            </View>
            <View style={styles.menuGroup}>
                {options.map((opt, i) => (
                    <TouchableOpacity key={i} style={styles.menuItem} onPress={() => { onOptionSelect({ type: title.toLowerCase(), value: opt }); onClose(); }}>
                        <Text style={[styles.menuTitle, { flex: 1 }]}>{opt}</Text>
                        {opt.includes('Normal') || opt === 'Auto' ? <Ionicons name="checkmark" size={20} color="#007AFF" /> : null}
                    </TouchableOpacity>
                ))}
            </View>
        </>
    );

    const renderNotInterested = () => (
        <>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={styles.grabber} />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Post hidden</Text>
                <TouchableOpacity style={{ position: 'absolute', right: 0, top: 0 }} onPress={() => setCurrentView('main')}>
                    <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Undo</Text>
                </TouchableOpacity>
            </View>
            <Text style={{ color: '#ccc', textAlign: 'center', marginBottom: 20 }}>We'll suggest fewer posts like this.</Text>

            <View style={styles.menuGroup}>
                <TouchableOpacity style={styles.menuItem} onPress={onHide}>
                    <Ionicons name="close-circle-outline" size={24} color="white" />
                    <Text style={[styles.menuTitle, { marginLeft: 15 }]}>Don't suggest posts from {reelUser?.name || 'User'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={onHide}>
                    <Ionicons name="text-outline" size={24} color="white" />
                    <Text style={[styles.menuTitle, { marginLeft: 15 }]}>Don't suggest posts with certain words</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={onHide}>
                    <Ionicons name="options-outline" size={24} color="white" />
                    <Text style={[styles.menuTitle, { marginLeft: 15 }]}>Manage content preferences</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={onHide}>
                    <Ionicons name="sad-outline" size={24} color="white" />
                    <Text style={[styles.menuTitle, { marginLeft: 15 }]}>This post made me uncomfortable</Text>
                </TouchableOpacity>
            </View>
        </>
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.modalContent,
                        { transform: [{ translateY: panY }] }
                    ]}
                >
                    {currentView === 'main' && renderMainContent()}
                    {currentView === 'speed' && renderSubMenu('Playback Speed', ['0.5x', '1x (Normal)', '1.5x', '2x'], () => setCurrentView('main'))}
                    {currentView === 'quality' && renderSubMenu('Quality Settings', ['Auto (Recommended)', 'High Quality', 'Data Saver'], () => setCurrentView('main'))}
                    {currentView === 'not_interested' && renderNotInterested()}
                    {currentView === 'qr' && renderQRContent()}
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const ReelsView = ({ theme, onFullScreenChange, refreshTrigger, reels = [], onRefresh, refreshing, isFullScreen }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [uiVisible, setUiVisible] = useState(true);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [selectedReel, setSelectedReel] = useState(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [hiddenReelIds, setHiddenReelIds] = useState([]);

    console.log("[ReelsView] Received reels:", reels?.length, reels && reels.length > 0 ? reels[0] : "Empty");

    const socket = useRef(null);

    useEffect(() => {
        const loadUser = async () => {
            const uid = await AsyncStorage.getItem('userId');
            setCurrentUser({ _id: uid });
        };
        loadUser();

        // Socket integration
        socket.current = io(API_BASE.replace('/api/auth', ''));
        return () => socket.current?.disconnect();
    }, []);

    const handleLike = async (reelId) => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE}/reels/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reelId, userId })
            });
            const data = await res.json();
            if (data.success) {
                // We need to update the parent state or local if we had one. 
                // Since reels come from props, we might need a way to update them.
                // For now, let's trigger a refresh if possible, or we might need to lift state up fully.
                // Ideally, SocialScreen should handle the update, but for now we rely on onRefresh.
                if (onRefresh) onRefresh();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleComment = (reel) => {
        setSelectedReel(reel);
        setIsCommentsOpen(true);
    };

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setActiveIndex(viewableItems[0].index);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 80 // Increased to ensure focus before playing
    }).current;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="black" hidden={isFullScreen} />
            <FlatList
                data={reels}
                keyExtractor={item => item._id}
                renderItem={({ item, index }) => (
                    <ReelItem
                        item={item}
                        isActive={index === activeIndex}
                        currentUser={currentUser}
                        onLike={handleLike}
                        onOpenMenu={(r) => { setSelectedReel(r); setMenuVisible(true); }}
                        playbackSpeed={playbackSpeed}
                        onOpenComments={handleComment}
                        uiVisible={uiVisible}
                        toggleUi={() => setUiVisible(!uiVisible)}
                        isCommentsOpen={isCommentsOpen}
                        isHidden={hiddenReelIds.includes(item._id)}
                        onUndoHide={() => setHiddenReelIds(prev => prev.filter(id => id !== item._id))}
                        onShare={() => { setSelectedReel(item); setShareModalVisible(true); }}
                        isFullScreen={isFullScreen}
                        onToggleFullScreen={() => onFullScreenChange()}
                    />
                )}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                snapToInterval={SCREEN_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="white" />
                }
                removeClippedSubviews={true}
                maxToRenderPerBatch={3}
                windowSize={5}
                initialNumToRender={1}
                ListEmptyComponent={
                    <View style={{ height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: 'white', fontSize: 18 }}>No reels found</Text>
                        <TouchableOpacity onPress={onRefresh} style={{ marginTop: 20, padding: 10, backgroundColor: '#333', borderRadius: 5 }}>
                            <Text style={{ color: 'white' }}>Refresh</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            <ReelOptionsModal
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                currentSpeed={playbackSpeed}
                isOwner={selectedReel?.user?._id === currentUser?._id}
                reelUser={selectedReel?.user}
                isFullScreen={isFullScreen}
                onOptionSelect={(opt) => {
                    if (typeof opt === 'object') {
                        if (opt.type === 'playback speed') setPlaybackSpeed(parseFloat(opt.value));
                    } else if (opt === 'interested') {
                        Alert.alert("Feedback", "We'll show you more reels like this.");
                    } else if (opt === 'delete') {
                        // Logic to delete reel
                        Alert.alert("Delete Reel", "Are you sure?", [
                            { text: "Cancel" },
                            {

                                text: "Delete", style: 'destructive', onPress: async () => {
                                    const userId = await AsyncStorage.getItem('userId');
                                    const res = await fetch(`${API_BASE}/reels/delete`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ reelId: selectedReel._id, userId })
                                    });
                                    if (res.ok) {
                                        if (onRefresh) onRefresh();
                                        setMenuVisible(false);
                                    }
                                }
                            }
                        ]);
                    } else if (opt === 'full_screen') {
                        if (onFullScreenChange) onFullScreenChange();
                        setMenuVisible(false);
                    }
                }}
                onHide={() => {
                    if (selectedReel) {
                        setHiddenReelIds(prev => [...prev, selectedReel._id]);
                        setMenuVisible(false);
                    }
                }}
            />

            <ShareModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                currentUser={currentUser}
                selectedItem={selectedReel}
                itemType="reel"
            />

            {/* Header Title */}
            {!isFullScreen && (
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Reels</Text>
                    <TouchableOpacity onPress={() => onRefresh && onRefresh()}>
                        <Ionicons name="refresh-outline" size={28} color="white" />
                    </TouchableOpacity>
                </View>
            )}

            <CommentsModal
                visible={isCommentsOpen}
                onClose={() => setIsCommentsOpen(false)}
                comments={selectedReel?.comments || []}
                onAddComment={async (text) => {
                    try {
                        const userId = await AsyncStorage.getItem('userId');
                        const url = `${API_BASE}/reels/comment`;
                        const body = { reelId: selectedReel._id, userId, text };

                        console.log("[ReelsView] Adding comment:", url, body);

                        const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });

                        if (!res.ok) {
                            const errorText = await res.text();
                            console.error(`[ReelsView] Server error (${res.status}):`, errorText);
                            throw new Error(`Server returned ${res.status}`);
                        }

                        const data = await res.json();
                        if (data.success) {
                            if (onRefresh) onRefresh();
                            setSelectedReel(prev => ({ ...prev, comments: data.comments }));
                        }
                    } catch (e) {
                        console.error("[ReelsView] Comment error:", e);
                        Alert.alert("Error", `Could not add comment: ${e.message}`);
                    }
                }}
            />
        </View>
    );
};

export default ReelsView;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    reelContainer: {
        width: width,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: 'black', // DEBUG: Visible if video fails to load
    },
    overlay: {
        position: 'absolute',
        bottom: 90, // Increased to avoid overlap with BottomNavBar
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        padding: 20,
    },
    bottomInfo: {
        flex: 1,
        marginRight: 20,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.5)',
        marginRight: 10,
        overflow: 'hidden'
    },
    username: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
        marginRight: 10,
    },
    followBtn: {
        borderWidth: 1,
        borderColor: 'white',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 2,
    },
    followText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    caption: {
        color: 'white',
        fontSize: 14,
    },
    actions: {
        alignItems: 'center',
    },
    actionItem: {
        alignItems: 'center',
        marginBottom: 20,
    },
    actionText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 5,
    },
    header: {
        position: 'absolute',
        top: 50, // Custom safe area, moved down
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    headerTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1C1C1E', // Dark grey like insta
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        padding: 20,
        maxHeight: '80%',
    },
    grabber: {
        width: 40,
        height: 4,
        backgroundColor: '#3A3A3C',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    menuGroup: {
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden'
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    menuTextContainer: {
        marginLeft: 15,
        flex: 1
    },
    menuTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '500'
    },
    menuSubtitle: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 2
    },
    subMenuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    subMenuTitle: {
        color: 'white',
        fontSize: 17,
        fontWeight: '600',
    },
    // Comment Modal Styles
    commentModalOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
        justifyContent: 'flex-end',
    },
    commentBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    commentSheet: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '60%', // Instagram style height
        padding: 20
    },
    commentHeader: {
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#3A3A3C',
        paddingBottom: 10
    },
    commentTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
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
        padding: 10
    },
    commentUser: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 2
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
        paddingTop: 10
    },
    input: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: 'white',
        marginRight: 10
    },
    sendText: {
        color: '#007AFF',
        fontWeight: 'bold',
        fontSize: 16
    },
    shadowIcon: {
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3
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
    searchIcon: {
        marginRight: 10
    },
    searchInput: {
        flex: 1,
        color: 'white',
        fontSize: 16
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15
    },
    userAvatarContainer: {
        marginRight: 15
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25
    },
    userInfoContainer: {
        flex: 1
    },
    userName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16
    },
    userHandle: {
        color: '#8E8E93',
        fontSize: 14
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
    sendButtonText: {
        color: 'white',
        fontWeight: 'bold'
    },
    sentButtonText: {
        color: '#8E8E93'
    }
});
