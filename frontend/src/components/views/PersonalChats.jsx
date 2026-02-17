import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Dimensions, RefreshControl, Alert, FlatList, Animated, Modal, BlurView, TouchableWithoutFeedback, Platform } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import Card from '../ui/Card';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

import Link from 'expo-router/link'; // Unused but keeping style
import AsyncStorage from '@react-native-async-storage/async-storage';
const SERVER_URL = "http://192.168.29.129:5000";

const formatLastSeen = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) return `at ${timeStr}`;
    if (diffDays === 1) return `yesterday at ${timeStr}`;
    if (diffDays < 7) return `on ${date.toLocaleDateString([], { weekday: 'short' })} at ${timeStr}`;
    return `on ${date.toLocaleDateString()}`;
};

export default function PersonalChats({
    activeTab,
    setActiveTab,
    users,
    onChatSelect,
    personalGroups,
    communities, // New Prop
    onCommunitySelect, // New Prop
    onGroupSelect,
    onGroupOptions,
    statuses = [],
    currentUserId,
    onViewStatus,
    onAddStatus,
    refreshControl,
    onCreateGroup,

    onCreateCommunity,
    hasStatus,
    profilePic,
    userName, // Added missing prop
    onAddTextStatus, // New Prop
    chatTabs // New Prop: Override default tabs
}) {
    const { colors: theme } = useTheme();

    // Action Modal State
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [modalType, setModalType] = useState('user'); // 'user' or 'group'

    // Profile Preview State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewUser, setPreviewUser] = useState(null);

    // Updates Menu State
    const [updatesMenuVisible, setUpdatesMenuVisible] = useState(false);
    const [statusPrivacyModalVisible, setStatusPrivacyModalVisible] = useState(false);
    const [privacyOption, setPrivacyOption] = useState('contacts'); // 'contacts', 'except', 'only'

    // Privacy Selection State
    const [showContactSelection, setShowContactSelection] = useState(false);
    const [contactSelectionType, setContactSelectionType] = useState('except'); // 'except' or 'include'
    const [statusPrivacyExcluded, setStatusPrivacyExcluded] = useState([]);
    const [statusPrivacyIncluded, setStatusPrivacyIncluded] = useState([]);
    const [tempSelectedContacts, setTempSelectedContacts] = useState([]);

    useEffect(() => {
        if (activeTab === 'Updates') {
            fetchStatusPrivacy();
        }
    }, [activeTab]);

    const fetchStatusPrivacy = async () => {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/user/details/${currentUserId}`);
            const data = await res.json();
            if (data) {
                if (data.statusPrivacy) setPrivacyOption(data.statusPrivacy);
                if (data.statusPrivacyExcluded) setStatusPrivacyExcluded(data.statusPrivacyExcluded);
                if (data.statusPrivacyIncluded) setStatusPrivacyIncluded(data.statusPrivacyIncluded);
            }
        } catch (e) {
            console.error("Failed to fetch privacy settings", e);
        }
    };

    const saveStatusPrivacy = async (newPrivacy, newExcluded, newIncluded) => {
        try {
            const body = {
                userId: currentUserId,
                privacy: newPrivacy !== undefined ? newPrivacy : privacyOption,
                excluded: newExcluded !== undefined ? newExcluded : statusPrivacyExcluded,
                included: newIncluded !== undefined ? newIncluded : statusPrivacyIncluded
            };

            await fetch(`${SERVER_URL}/api/auth/user/status/privacy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            // Update local state
            if (newPrivacy) setPrivacyOption(newPrivacy);
            if (newExcluded) setStatusPrivacyExcluded(newExcluded);
            if (newIncluded) setStatusPrivacyIncluded(newIncluded);

        } catch (e) {
            Alert.alert("Error", "Failed to save privacy settings");
        }
    };

    const handlePrivacyOptionSelect = (option) => {
        if (option === 'contacts') {
            setPrivacyOption('contacts');
            saveStatusPrivacy('contacts');
        } else if (option === 'except') {
            setContactSelectionType('except');
            setTempSelectedContacts([...statusPrivacyExcluded]);
            setShowContactSelection(true);
            // Don't save yet, wait for selection
        } else if (option === 'only') {
            setContactSelectionType('include');
            setTempSelectedContacts([...statusPrivacyIncluded]);
            setShowContactSelection(true);
            // Don't save yet
        }
    };

    const handleContactToggle = (userId) => {
        setTempSelectedContacts(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const saveContactSelection = () => {
        setShowContactSelection(false);
        if (contactSelectionType === 'except') {
            setPrivacyOption('except');
            setStatusPrivacyExcluded(tempSelectedContacts);
            saveStatusPrivacy('except', tempSelectedContacts, undefined);
        } else {
            setPrivacyOption('only');
            setStatusPrivacyIncluded(tempSelectedContacts);
            saveStatusPrivacy('only', undefined, tempSelectedContacts);
        }
    };

    // ... existing handleBlockUser ...

    const handleArchive = async (chatId) => {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/chat/archive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, chatId })
            });
            const data = await res.json();
            if (data.success) {
                // Optimistic Update or Refresh
                Alert.alert("Success", "Chat archived");
                // TODO: Trigger a refresh of the lists via parent callback if available
                // For now, we rely on the parent to fetch or user to pull-to-refresh
                if (refreshControl && refreshControl.props.onRefresh) {
                    refreshControl.props.onRefresh();
                }
            } else {
                Alert.alert("Error", data.error || "Failed to archive");
            }
        } catch (e) {
            Alert.alert("Error", "Network error");
        }
    };

    const handleDeleteChat = async (chatId) => {
        const isGroup = modalType === 'group';

        Alert.alert(
            isGroup ? "Exit Group" : "Clear Chat",
            isGroup ? "Are you sure you want to leave this group?" : "Are you sure you want to clear this chat? This will delete all messages.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: isGroup ? "Exit" : "Clear",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Default: Clear Chat (Messages only)
                            let url = `${SERVER_URL}/api/auth/messages/clear`;
                            let body = { user1: currentUserId, user2: chatId };

                            if (isGroup) {
                                // For groups: Exit Group
                                url = `${SERVER_URL}/api/auth/chat/group/remove/${chatId}`;
                                body = { userId: currentUserId };
                            }

                            const res = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body)
                            });
                            const data = await res.json();

                            if (data.success || res.ok) {
                                Alert.alert("Success", isGroup ? "Left group" : "Chat cleared");
                                if (refreshControl && refreshControl.props.onRefresh) {
                                    refreshControl.props.onRefresh();
                                }
                            } else {
                                Alert.alert("Error", data.error || "Failed to action");
                            }
                        } catch (e) {
                            Alert.alert("Error", "Network error");
                        }
                    }
                }
            ]
        );
    };

    const handleBlockUser = async (targetId) => {
        try {
            const res = await fetch(`${SERVER_URL}/api/auth/social/block`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, targetId })
            });
            const data = await res.json();
            if (data.success) {
                Alert.alert("Success", data.isBlocked ? "User blocked" : "User unblocked");
                // Refresh
                if (refreshControl && refreshControl.props.onRefresh) {
                    refreshControl.props.onRefresh();
                }
            }
        } catch (e) {
            Alert.alert("Error", "Failed to block user");
        }
    };

    const renderUpdatesMenu = () => {
        if (!updatesMenuVisible) return null;
        return (
            <Modal transparent visible={updatesMenuVisible} onRequestClose={() => setUpdatesMenuVisible(false)} animationType="none">
                <TouchableOpacity style={styles.menuBackdrop} onPress={() => setUpdatesMenuVisible(false)} activeOpacity={1}>
                    <View style={[styles.dropdownMenu, { backgroundColor: theme.surface }]}>

                        <TouchableOpacity onPress={() => { setUpdatesMenuVisible(false); setStatusPrivacyModalVisible(true); }} style={styles.menuItem}>
                            <Text style={[styles.menuText, { color: theme.textPrimary }]}>Status privacy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setUpdatesMenuVisible(false); Alert.alert("Settings", "Navigate to Settings"); }} style={styles.menuItem}>
                            <Text style={[styles.menuText, { color: theme.textPrimary }]}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    const renderStatusPrivacyModal = () => {
        return (
            <Modal visible={statusPrivacyModalVisible} animationType="slide" transparent={true} onRequestClose={() => setStatusPrivacyModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.privacyModalContainer, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.privacyTitle, { color: theme.textPrimary }]}>Status privacy</Text>
                        <Text style={{ color: theme.textSecondary, marginBottom: 20 }}>Who can see my status updates</Text>

                        <TouchableOpacity style={styles.radioButtonContainer} onPress={() => handlePrivacyOptionSelect('contacts')}>
                            <Ionicons name={privacyOption === 'contacts' ? "radio-button-on" : "radio-button-off"} size={24} color={TEAL} />
                            <Text style={[styles.radioText, { color: theme.textPrimary }]}>My contacts</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.radioButtonContainer} onPress={() => handlePrivacyOptionSelect('except')}>
                            <Ionicons name={privacyOption === 'except' ? "radio-button-on" : "radio-button-off"} size={24} color={TEAL} />
                            <Text style={[styles.radioText, { color: theme.textPrimary }]}>My contacts except...</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.radioButtonContainer} onPress={() => handlePrivacyOptionSelect('only')}>
                            <Ionicons name={privacyOption === 'only' ? "radio-button-on" : "radio-button-off"} size={24} color={TEAL} />
                            <Text style={[styles.radioText, { color: theme.textPrimary }]}>Only share with...</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.privacySaveButton, { backgroundColor: TEAL }]} onPress={() => setStatusPrivacyModalVisible(false)}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderContactSelectionModal = () => {
        return (
            <Modal visible={showContactSelection} animationType="slide" transparent={true} onRequestClose={() => setShowContactSelection(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.privacyModalContainer, { backgroundColor: theme.surface, height: '80%' }]}>
                        <Text style={[styles.privacyTitle, { color: theme.textPrimary }]}>
                            {contactSelectionType === 'except' ? 'Hide status from...' : 'Share status with...'}
                        </Text>

                        <ScrollView style={{ flex: 1, width: '100%' }}>
                            {users.map(user => {
                                const isSelected = tempSelectedContacts.includes(user._id);
                                return (
                                    <TouchableOpacity key={user._id} style={styles.contactItem} onPress={() => handleContactToggle(user._id)}>
                                        <Image source={{ uri: user.profilePic ? `${SERVER_URL}${user.profilePic}` : 'https://via.placeholder.com/150' }} style={styles.contactAvatar} />
                                        <Text style={[styles.contactName, { color: theme.textPrimary }]}>{user.name}</Text>
                                        <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? TEAL : theme.textSecondary} />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity style={[styles.privacySaveButton, { backgroundColor: TEAL, marginTop: 10 }]} onPress={saveContactSelection}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    const renderProfilePreviewModal = () => {
        if (!previewUser) return null;
        return (
            <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
                <TouchableOpacity style={styles.previewBackdrop} activeOpacity={1} onPress={() => setPreviewVisible(false)}>
                    <View style={styles.previewContainer}>
                        <View style={styles.previewHeader}><Text style={styles.previewName}>{previewUser.name}</Text></View>
                        <Image source={{ uri: previewUser.profilePic ? `${SERVER_URL}${previewUser.profilePic}` : 'https://via.placeholder.com/300' }} style={styles.previewImage} />
                        <View style={{ padding: 10, backgroundColor: 'white' }}>
                            <Text style={{ fontSize: 14, color: '#333', fontStyle: 'italic' }}>{previewUser.bio || previewUser.about || "No about info"}</Text>
                            {previewUser.phoneNumber && !previewUser.isNumberHidden && (
                                <Text style={{ fontSize: 14, color: '#075E54', marginTop: 4 }}>{previewUser.phoneNumber}</Text>
                            )}
                        </View>
                        <View style={styles.previewActions}>
                            <TouchableOpacity onPress={() => { setPreviewVisible(false); onChatSelect(previewUser); }} style={styles.previewActionBtn}>
                                <Ionicons name="chatbubble-ellipses" size={24} color={TEAL} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setPreviewVisible(false); Alert.alert("Call", "Calling..."); }} style={styles.previewActionBtn}>
                                <Ionicons name="call" size={24} color={TEAL} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => {
                                setPreviewVisible(false);
                                Alert.alert(
                                    previewUser.name,
                                    `${previewUser.bio || "No about info"}\n\n${(!previewUser.isNumberHidden && previewUser.phoneNumber) ? previewUser.phoneNumber : ""}`
                                );
                            }} style={styles.previewActionBtn}>
                                <Ionicons name="information-circle" size={24} color={TEAL} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    // Swipe Helpers
    const renderRightActions = (progress, dragX, item, isGroup) => {
        const trans = dragX.interpolate({
            inputRange: [0, 50, 100, 101],
            outputRange: [-20, 0, 0, 1],
        });
        return (
            <View style={{ flexDirection: 'row', width: 140 }}>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#8e8e93' }]} onPress={() => Alert.alert("More", "More options")}>
                    <Ionicons name="ellipsis-horizontal" size={24} color="white" />
                    <Text style={styles.swipeText}>More</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#388E3C' }]} onPress={() => handleArchive(item._id)}>
                    <Ionicons name="archive" size={24} color="white" />
                    <Text style={styles.swipeText}>Archive</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderLeftActions = (progress, dragX, item) => {
        return (
            <View style={{ flexDirection: 'row', width: 140 }}>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#34B7F1' }]} onPress={() => Alert.alert("Read", "Mark as read/unread")}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: 'white', marginBottom: 2 }}></View>
                    <Text style={styles.swipeText}>Unread</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.swipeAction, { backgroundColor: '#8e8e93' }]} onPress={() => Alert.alert("Pin", "Chat Pinned")}>
                    <Ionicons name="pin" size={24} color="white" />
                    <Text style={styles.swipeText}>Pin</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderActionModal = () => {
        if (!selectedItem) return null;
        const isGroup = modalType === 'group';

        return (
            <Modal
                visible={actionModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setActionModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalDismiss}
                        activeOpacity={1}
                        onPress={() => setActionModalVisible(false)}
                    />
                    <View style={[styles.actionSheet, { backgroundColor: theme.surface }]}>
                        <View style={styles.actionSheetHandle} />

                        <View style={styles.actionHeader}>
                            {selectedItem.profilePic ? (
                                <Image source={{ uri: `${SERVER_URL}${selectedItem.profilePic}` }} style={styles.avatarSmallImg} />
                            ) : (
                                <View style={[styles.avatarSmall, { backgroundColor: theme.inputBg }]}>
                                    <Ionicons name={isGroup ? "people" : "person"} size={22} color={theme.textSecondary} />
                                </View>
                            )}
                            <View style={{ marginLeft: 12 }}>
                                <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>{selectedItem.name}</Text>
                                <Text style={{ fontSize: 13, color: theme.textSecondary }}>Choose an action</Text>
                            </View>
                        </View>

                        <View style={styles.actionGrid}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => {
                                    handleArchive(selectedItem._id);
                                    setActionModalVisible(false);
                                }}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: theme.primary }]}>
                                    <Ionicons name="archive-outline" size={22} color="white" />
                                </View>
                                <Text style={[styles.actionText, { color: theme.textPrimary }]}>Archive {isGroup ? 'Group' : 'Chat'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => {
                                    handleDeleteChat(selectedItem._id);
                                    setActionModalVisible(false);
                                }}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#e74c3c' }]}>
                                    <Ionicons name="trash-outline" size={22} color="white" />
                                </View>
                                <Text style={[styles.actionText, { color: theme.textPrimary }]}>{isGroup ? 'Exit Group' : 'Clear Chat'}</Text>
                            </TouchableOpacity>

                            {!isGroup && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => {
                                        handleBlockUser(selectedItem._id);
                                        setActionModalVisible(false);
                                    }}
                                >
                                    <View style={[styles.actionIcon, { backgroundColor: '#555' }]}>
                                        <Ionicons name="ban-outline" size={22} color="white" />
                                    </View>
                                    <Text style={[styles.actionText, { color: theme.textPrimary }]}>Block User</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setActionModalVisible(false)}
                        >
                            <Text style={{ color: theme.primary, fontSize: 17, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };


    // --- Teal Theme Styles ---
    const TEAL = '#075E54';
    const TEAL_DARK = '#128C7E';
    const LIGHT_GREEN = '#25D366';
    const CHECKMARK_BLUE = '#34B7F1';


    const renderStoriesRail = () => {
        // Filter valid stories
        const validStories = statuses.filter(g => {
            const isMe = String(g.user._id || g.user) === String(currentUserId);
            return !isMe && g.items && g.items.length > 0;
        });

        const myGroup = statuses.find(g => String(g.user?._id || g.user) === String(currentUserId));
        const hasMyStory = myGroup && myGroup.items.length > 0;

        return (
            <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
                    {/* My Story */}
                    <TouchableOpacity style={{ alignItems: 'center', marginRight: 15 }} onPress={hasMyStory ? () => onViewStatus(myGroup) : onAddStatus}>
                        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: hasMyStory ? TEAL : '#e0e0e0', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                            {profilePic ? (
                                <Image source={{ uri: `${SERVER_URL}${profilePic}` }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                            ) : (
                                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name="person" size={24} color="white" />
                                </View>
                            )}
                            {!hasMyStory && (
                                <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: TEAL, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'white' }}>
                                    <Ionicons name="add" size={12} color="white" />
                                </View>
                            )}
                        </View>
                        <Text style={{ fontSize: 12, marginTop: 4, color: 'black' }}>Your Story</Text>
                    </TouchableOpacity>

                    {/* Other Stories */}
                    {validStories.map((group, index) => (
                        <TouchableOpacity key={index} style={{ alignItems: 'center', marginRight: 15 }} onPress={() => onViewStatus(group)}>
                            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: TEAL, justifyContent: 'center', alignItems: 'center' }}>
                                <Image source={{ uri: `${SERVER_URL}${group.user.profilePic}` }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                            </View>
                            <Text style={{ fontSize: 12, marginTop: 4, color: 'black' }} numberOfLines={1}>
                                {group.user.name?.split(' ')[0]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
    };

    const renderChatList = () => {
        if (!users || users.length === 0) return <EmptyState theme={theme} text="No chats yet" />;
        return (
            <View style={{ flex: 1, backgroundColor: 'white' }}>
                {renderProfilePreviewModal()}
                <ScrollView
                    contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
                    refreshControl={refreshControl ? (
                        <RefreshControl
                            refreshing={refreshControl.props.refreshing}
                            onRefresh={refreshControl.props.onRefresh}
                            colors={[TEAL]}
                        />
                    ) : null}
                >
                    {users.map((item, index) => (
                        <Swipeable
                            key={item._id}
                            renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item, false)}
                            renderLeftActions={(progress, dragX) => renderLeftActions(progress, dragX, item)}
                        >
                            <TouchableOpacity
                                style={styles.chatItem}
                                onPress={() => onChatSelect(item)}
                                onLongPress={() => {
                                    setSelectedItem(item);
                                    setModalType('user');
                                    setActionModalVisible(true);
                                }}
                            >
                                <View style={styles.cardRow}>
                                    <TouchableOpacity onPress={() => { setPreviewUser(item); setPreviewVisible(true); }}>
                                        {item.profilePic ? (
                                            <Image source={{ uri: `${SERVER_URL}${item.profilePic}` }} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.placeholderAvatar, { backgroundColor: '#e0e0e0' }]}>
                                                <Ionicons name="person" size={24} color="white" />
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.textContainer}>
                                        <View style={styles.topRow}>
                                            <Text style={[styles.name, { color: 'black' }]} numberOfLines={1}>{item.name}</Text>
                                            <Text style={{ fontSize: 11, color: item.unreadCount > 0 ? LIGHT_GREEN : '#667781' }}>
                                                {item.lastMessageDate && item.lastMessageDate !== new Date(0).toISOString()
                                                    ? new Date(item.lastMessageDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : ''}
                                            </Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <View style={{ flex: 1, marginRight: 10, flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={[styles.messagePreview, { color: '#667781' }]} numberOfLines={1}>
                                                    {item.lastMessageText || 'Tap to message'}
                                                </Text>
                                            </View>
                                            {item.unreadCount > 0 && (
                                                <View style={[styles.badge, { backgroundColor: LIGHT_GREEN }]}>
                                                    <Text style={styles.badgeText}>{item.unreadCount}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </Swipeable>
                    ))
                    }
                </ScrollView >

            </View>
        );
    };

    const renderGroupList = () => {
        return (
            <View style={{ flex: 1, backgroundColor: 'white' }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }} refreshControl={refreshControl}>
                    {/* Create Group Item */}
                    {/* Hiding explicit button to use FAB or Menu if strict UI compliance, but keeping for functionality */}

                    {(!personalGroups || personalGroups.length === 0) ? (
                        <Text style={{ textAlign: 'center', marginTop: 20, color: '#667781' }}>No groups yet</Text>
                    ) : (
                        personalGroups
                            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                            .map((group, index) => (
                                <TouchableOpacity
                                    key={group._id}
                                    onPress={() => onGroupSelect(group)}
                                    onLongPress={() => {
                                        setSelectedItem(group);
                                        setModalType('group');
                                        setActionModalVisible(true);
                                    }}
                                    style={styles.chatItem}
                                >
                                    <View style={styles.cardRow}>
                                        <View style={[styles.groupAvatar, { backgroundColor: '#e0e0e0' }]}>
                                            <Ionicons name={group.type === 'announcement' ? "megaphone" : "people"} size={28} color="white" />
                                        </View>
                                        <View style={styles.textContainer}>
                                            <View style={styles.topRow}>
                                                <Text style={[styles.name, { color: 'black', flex: 1 }]} numberOfLines={1}>{group.name}</Text>
                                                {group.mutedBy && group.mutedBy.some(m => String(m.user) === String(currentUserId)) && (
                                                    <Ionicons name="volume-mute" size={16} color="#667781" style={{ marginLeft: 5 }} />
                                                )}
                                            </View>
                                            <Text style={[styles.messagePreview, { color: '#667781' }]} numberOfLines={1}>
                                                {group.lastMessage || 'Tap to view group'}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                    )}
                </ScrollView>

            </View>
        );
    };



    const renderUpdatesList = () => {
        const myGroup = statuses.find(g => String(g.user?._id || g.user) === String(currentUserId));


        const otherStatuses = statuses.filter(g => {
            const isMe = String(g.user._id || g.user) === String(currentUserId);
            return !isMe && g.items && g.items.length > 0;
        });

        return (
            <View style={{ flex: 1, backgroundColor: 'white' }}>
                {renderUpdatesMenu()}
                {renderStatusPrivacyModal()}
                {renderContactSelectionModal()}

                <ScrollView contentContainerStyle={{ paddingBottom: 120 }} refreshControl={refreshControl}>
                    {/* Status Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, marginBottom: 10 }}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'black' }}>Status</Text>
                        <TouchableOpacity
                            style={{ backgroundColor: '#f0f2f5', padding: 6, borderRadius: 20 }}
                            onPress={() => setUpdatesMenuVisible(true)}
                        >
                            <Ionicons name="ellipsis-horizontal" size={20} color="black" />
                        </TouchableOpacity>
                    </View>


                    {/* Horizontal Status ScrollView */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
                        {/* My Status Card */}
                        <TouchableOpacity style={styles.statusCard} onPress={myGroup ? () => onViewStatus(myGroup) : onAddStatus}>
                            <View style={[styles.statusCardInner, { backgroundColor: myGroup ? '#333' : '#232D36', justifyContent: myGroup ? 'flex-start' : 'center', alignItems: myGroup ? 'flex-start' : 'center' }]}>
                                {myGroup ? (
                                    <>
                                        {/* Existing Status Layout */}
                                        {(() => {
                                            const latestItem = myGroup.items[myGroup.items.length - 1];
                                            return (
                                                latestItem.type === 'image' ?
                                                    <Image source={{ uri: `${SERVER_URL}${latestItem.content}` }} style={styles.statusCardImage} /> :
                                                    <View style={[styles.statusCardImage, { backgroundColor: latestItem.color || '#333', justifyContent: 'center', alignItems: 'center' }]}>
                                                        <Text style={{ color: 'white', fontSize: 12 }}>{latestItem.content}</Text>
                                                    </View>
                                            );
                                        })()}

                                        <View style={styles.statusAvatarContainer}>
                                            <Image source={{ uri: profilePic ? `${SERVER_URL}${profilePic}` : 'https://via.placeholder.com/150' }} style={styles.statusAvatarImg} />
                                        </View>
                                        <Text style={styles.statusCardName}>My Status</Text>
                                    </>
                                ) : (
                                    <>
                                        {/* Add Status Layout (No Status) */}
                                        <View style={{ marginBottom: 10 }}>
                                            <Image source={{ uri: profilePic ? `${SERVER_URL}${profilePic}` : 'https://via.placeholder.com/150' }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                                            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#25D366', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#232D36' }}>
                                                <Ionicons name="add" size={16} color="white" />
                                            </View>
                                        </View>
                                        <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>Add status</Text>
                                    </>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Other Status Cards */}
                        {otherStatuses.map((group, index) => {
                            const isViewed = group.items.every(item => item.viewers && item.viewers.some(v => String(v.user && v.user._id ? v.user._id : v.user) === String(currentUserId)));
                            return (
                                <TouchableOpacity key={group.user._id} style={styles.statusCard} onPress={() => onViewStatus(group)}>
                                    <View style={[styles.statusCardInner, { borderColor: isViewed ? '#e0e0e0' : TEAL, borderWidth: isViewed ? 0 : 2 }]}>
                                        {(() => {
                                            const latestItem = group.items[group.items.length - 1];
                                            return (
                                                latestItem.type === 'image' ?
                                                    <Image source={{ uri: `${SERVER_URL}${latestItem.content}` }} style={styles.statusCardImage} /> :
                                                    <View style={[styles.statusCardImage, { backgroundColor: latestItem.color || '#555', justifyContent: 'center', alignItems: 'center' }]}>
                                                        <Text style={{ color: 'white', fontSize: 12 }}>{latestItem.content}</Text>
                                                    </View>
                                            );
                                        })()}

                                        <View style={[styles.statusAvatarContainer, { borderColor: TEAL, borderWidth: 2 }]}>
                                            <Image source={{ uri: `${SERVER_URL}${group.user.profilePic}` }} style={styles.statusAvatarImg} />
                                        </View>

                                        <Text style={styles.statusCardName} numberOfLines={1}>{group.user.name}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={{ height: 1, backgroundColor: '#f0f0f0', marginVertical: 5 }} />

                    {/* Communities Section */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'black' }}>Communities</Text>

                        </View>

                        {/* Create Community Item */}
                        <TouchableOpacity onPress={onCreateCommunity} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: '#f0f2f5', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                <Ionicons name="add" size={28} color={TEAL} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'black' }}>New Community</Text>
                                <Text style={{ color: '#667781', fontSize: 13 }}>Create a community to bring members together</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Communities List */}
                        {(!communities || communities.length === 0) ? (
                            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                <Text style={{ color: '#667781' }}>No communities yet</Text>
                            </View>
                        ) : (
                            communities
                                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                                .map((group, index) => (
                                    <TouchableOpacity
                                        key={group._id}
                                        onPress={() => onCommunitySelect ? onCommunitySelect(group) : onGroupSelect(group)}
                                        onLongPress={() => onGroupOptions && onGroupOptions(group)}
                                        style={[styles.chatItem, { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }]}
                                    >
                                        <View style={styles.cardRow}>
                                            <View style={[styles.groupAvatar, { backgroundColor: '#f0f2f5', borderRadius: 15 }]}>
                                                <Ionicons name="megaphone" size={24} color={TEAL} />
                                            </View>
                                            <View style={styles.textContainer}>
                                                <View style={styles.topRow}>
                                                    <Text style={[styles.name, { color: 'black' }]}>{group.name}</Text>
                                                    <Text style={{ fontSize: 11, color: '#667781' }}>
                                                        {new Date(group.createdAt).toLocaleDateString()}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.messagePreview, { color: '#667781' }]} numberOfLines={1}>
                                                    Tap to view community updates
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))
                        )}
                    </View>
                </ScrollView >

                {/* Floating Action Buttons */}
                < View style={{ position: 'absolute', bottom: 110, right: 20, alignItems: 'center' }
                }>
                    <TouchableOpacity style={{ backgroundColor: '#f0f2f5', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }} onPress={onAddTextStatus}>
                        <Ionicons name="pencil" size={20} color="#667781" />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: TEAL, width: 55, height: 55, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 }} onPress={onAddStatus}>
                        <Ionicons name="camera" size={24} color="white" />
                    </TouchableOpacity>
                </View >
            </View >
        );
    };

    const renderCallList = () => {
        // Mock Data for Calls
        const calls = [
            { id: 1, name: 'Alice Smith', type: 'incoming', date: new Date(), missed: false },
            { id: 2, name: 'Bob Johnson', type: 'outgoing', date: new Date(Date.now() - 3600000), missed: false },
            { id: 3, name: 'Charlie Brown', type: 'incoming', date: new Date(Date.now() - 86400000), missed: true },
        ];

        return (
            <View style={{ flex: 1, backgroundColor: 'white' }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}>
                    {calls.map((call) => (
                        <TouchableOpacity key={call.id} style={styles.chatItem}>
                            <View style={styles.cardRow}>
                                <View style={[styles.groupAvatar, { backgroundColor: '#f0f2f5', borderRadius: 25 }]}>
                                    <Ionicons name="person" size={24} color="#667781" />
                                </View>
                                <View style={styles.textContainer}>
                                    <Text style={[styles.name, { color: 'black' }]}>{call.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons
                                            name={call.type === 'incoming' ? (call.missed ? "arrow-down" : "arrow-down") : "arrow-up"}
                                            size={16}
                                            color={call.missed ? '#FF3B30' : (call.type === 'outgoing' ? '#007AFF' : '#34C759')}
                                        />
                                        <Text style={{ marginLeft: 5, color: '#667781' }}>
                                            {call.date.toLocaleDateString()} , {call.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity style={{ padding: 10 }}>
                                    <Ionicons name="call-outline" size={24} color={TEAL} />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    ))}
                    <View style={{ padding: 20, alignItems: 'center' }}>
                        <Text style={{ color: '#667781', fontSize: 12 }}>Your personal calls are end-to-end encrypted</Text>
                    </View>
                </ScrollView>

            </View>
        );
    };

    const renderContent = ({ item }) => {
        return (
            <View style={{ width: SCREEN_WIDTH, flex: 1, backgroundColor: 'white' }}>
                {item === 'chats' && renderChatList()}
                {item === 'groups' && renderGroupList()}
                {item === 'updates' && renderUpdatesList()}
                {item === 'calls' && renderCallList()}
            </View>
        );
    };

    // Debug
    console.log(`[PersonalChats] Render. ActiveTab: ${activeTab}, Users: ${users?.length}, Groups: ${personalGroups?.length}`);

    const Container = Platform.OS === 'web' ? View : GestureHandlerRootView;

    return (
        <Container style={{ flex: 1, backgroundColor: 'white' }}>
            {activeTab === 'chats' && renderChatList()}
            {activeTab === 'groups' && renderGroupList()}
            {activeTab === 'updates' && renderUpdatesList()}
            {activeTab === 'calls' && renderCallList()}
            {renderActionModal()}
            {renderUpdatesMenu()}
            {renderStatusPrivacyModal()}
        </Container>
    );
}

const EmptyState = ({ theme, text }) => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
        <Ionicons name="chatbubbles-outline" size={60} color="#e0e0e0" />
        <Text style={{ color: '#667781', marginTop: 20 }}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    storiesContainer: { paddingVertical: 15, marginBottom: 5 },
    storyItem: { alignItems: 'center', marginRight: 16 },
    storyRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    storyAvatar: { width: 50, height: 50, borderRadius: 25 },
    storyName: { fontSize: 12, fontWeight: '500' },

    // New Status Card Styles
    statusCard: {
        width: 100,
        height: 160,
        marginRight: 10,
    },
    statusCardInner: {
        width: '100%',
        height: '100%',
        borderRadius: 15,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f0f2f5',
    },
    statusCardImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    statusAvatarContainer: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#075E54', // TEAL
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    statusAvatarImg: {
        width: '100%',
        height: '100%',
    },
    addStatusBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#075E54', // TEAL
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
    },
    statusCardName: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderTopWidth: 1,
        paddingBottom: 20
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    tabText: { fontWeight: '600' },

    storyName: { fontSize: 16, fontWeight: '600' },

    chatItem: {
        paddingVertical: 10, // Tighter padding
        paddingHorizontal: 15,
        backgroundColor: 'white'
    },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', },
    placeholderAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    placeholderText: { fontSize: 20, fontWeight: 'bold' },
    onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#25D366', borderWidth: 2, borderColor: 'white' },
    textContainer: { flex: 1, marginLeft: 15, justifyContent: 'center', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', paddingBottom: 10 }, // Separator line logic
    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    name: { fontSize: 16, fontWeight: 'bold' }, // Bolder name
    messagePreview: { fontSize: 14 },
    groupAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    createGroupBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 15, borderWidth: 1 },
    badge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: 'black', // WhatsApp uses black text on green badge sometimes, or white.
        fontSize: 10,
        fontWeight: 'bold',
    },

    // FAB Details
    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 55,
        height: 55,
        borderRadius: 28,
        backgroundColor: '#075E54', // Teal
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4.5,
    },

    // Action Modal Styles (Refined)
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalDismiss: {
        flex: 1,
    },
    actionSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 10,
        width: '100%',
        maxWidth: 600,
        alignSelf: 'center',
    },
    actionSheetHandle: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    actionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    avatarSmall: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarSmallImg: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    actionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    actionGrid: {
        marginBottom: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    actionIcon: {
        width: 40,
        height: 40,
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
    },

    // Updates Menu Styles
    menuBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)', // Slight dim
        alignItems: 'flex-end',
    },
    dropdownMenu: {
        width: 200,
        marginTop: 50, // Top margin to align with header
        marginRight: 10,
        borderRadius: 8,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        paddingVertical: 5,
    },
    menuItem: {
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    menuText: {
        fontSize: 16,
    },

    // Privacy Modal Styles
    privacyModalContainer: {
        width: '85%',
        maxWidth: 500,
        borderRadius: 20,
        padding: 24,
        alignSelf: 'center',
        elevation: 5,
        marginBottom: 'auto',
        marginTop: 'auto',
    },
    privacyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    radioButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    radioText: {
        fontSize: 16,
        marginLeft: 12,
    },
    privacySaveButton: {
        marginTop: 20,
        paddingVertical: 12,
        borderRadius: 25,
        alignItems: 'center',
        alignSelf: 'flex-end',
        paddingHorizontal: 30,
    },
    // Swipe Actions
    swipeAction: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
        height: '100%',
    },
    swipeText: {
        color: 'white',
        fontSize: 10,
        marginTop: 4,
        fontWeight: 'bold',
    },
    // Profile Preview Styles
    previewBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewContainer: {
        width: 280,
        backgroundColor: 'white',
        elevation: 10,
        borderRadius: 0,
    },
    previewHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 5,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 10,
    },
    previewName: {
        color: 'white',
        fontSize: 18,
        paddingLeft: 5,
    },
    previewImage: {
        width: 280,
        height: 280,
    },
    previewActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
        backgroundColor: 'white',
    },
    previewActionBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
