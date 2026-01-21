import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Alert, Animated, Image, TouchableOpacity, ScrollView, Easing, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { Video } from 'expo-av'; // Ensure installed or handled
import * as ImagePicker from 'expo-image-picker';

import { API_BASE } from '../../src/services/apiService';
import { Colors } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';

// Components
import ModeSwitcher from '../../src/components/navigation/ModeSwitcher';
import BottomNavBar from '../../src/components/navigation/BottomNavBar';
import PersonalChats from '../../src/components/views/PersonalChats';

// Views (Imports from existing screens)
// Note: Depending on file structure, these might need adjustments.
import GroupDiscussionScreen from '../gd/index';
import AnnouncementGroupsScreen from '../announcement/index';
import AdminDashboard from '../admin/index';

const SERVER_URL = "http://192.168.29.129:5000";

export default function CommunityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const theme = colors || Colors;
  const styles = getStyles(theme);

  // --- State ---
  const [activeMode, setActiveMode] = useState('personal'); // 'personal' | 'work' | 'social'
  const [activeTab, setActiveTab] = useState('chats');

  // Header State
  const [userName, setUserName] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const slideAnim = useRef(new Animated.Value(-50)).current;

  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Enhancements State
  const [profileZoomVisible, setProfileZoomVisible] = useState(false);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [isNumberHidden, setIsNumberHidden] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [adminId, setAdminId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Data State
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ chat: 0, gd: 0, announcement: 0 });
  const [hasCompanyAccess, setHasCompanyAccess] = useState(false);

  // Verification Modal State
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [companyIdInput, setCompanyIdInput] = useState('');



  // Personal Groups State
  const [activePersonalTab, setActivePersonalTab] = useState('chats'); // 'chats' | 'groups'
  const [personalGroups, setPersonalGroups] = useState([]);
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]); // Array of user IDs
  const [isAnnouncementGroup, setIsAnnouncementGroup] = useState(false);

  // Status State
  const [statuses, setStatuses] = useState([]);
  const [textStatusVisible, setTextStatusVisible] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusColor, setStatusColor] = useState('#007AFF');
  // Status State (Deduped)
  const STATUS_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55', '#8E8E93', '#000000'];

  // Status Viewer State
  const [viewStatusModalVisible, setViewStatusModalVisible] = useState(false);
  const [currentStatusUser, setCurrentStatusUser] = useState(null);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);

  // Refresh State
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  // --- Effects ---
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  useEffect(() => {
    // Set default tab when mode changes
    if (activeMode === 'personal') setActiveTab('chats');
    else if (activeMode === 'work') setActiveTab('gd');
    else if (activeMode === 'social') setActiveTab('home');
  }, [activeMode]);

  useEffect(() => {
    const socket = io("http://192.168.29.129:5000");
    socket.on('connect', () => socket.emit('joinGD'));
    socket.on('receiveMessage', async (msg) => {
      // Simple count update logic (refined later)
      if (msg.groupId === 'finance-gd') setCounts(p => ({ ...p, gd: p.gd + 1 }));
    });
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (activeTab === 'groups' && personalGroups.length === 0) {
      fetchPersonalGroups();
    }
    if (activeTab === 'status') {
      fetchStatuses();
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const access = await AsyncStorage.getItem('hasCompanyAccess');
      if (access === 'true') setHasCompanyAccess(true);

      const name = await AsyncStorage.getItem('userName');
      if (name) setUserName(name);
      const pic = await AsyncStorage.getItem('profilePic');
      if (pic) setProfilePic(pic);
      const phone = await AsyncStorage.getItem('phoneNumber');
      if (phone) setPhoneNumber(phone);
      const hidden = await AsyncStorage.getItem('isNumberHidden');
      if (hidden === 'true') setIsNumberHidden(true);
      const userId = await AsyncStorage.getItem('userId');
      setCurrentUserId(userId);

      const res = await fetch(`${API_BASE}/community/users?currentUserId=${userId}`);

      const role = await AsyncStorage.getItem('userRole');
      if (role) setUserRole(role);

      // Fetch Admin ID
      try {
        const adminRes = await fetch(`${API_BASE}/admin-id`);
        const adminData = await adminRes.json();
        if (adminData.adminId) setAdminId(adminData.adminId);
      } catch (e) { }

      if (res.ok) {
        const data = await res.json();
        console.log("Fetched users:", data.length);
        if (data.length > 0) {
          console.log("First user sample:", JSON.stringify(data[0], null, 2));
        }
        // already filtered self in backend often, but redundant check is fine or if backend returns all
        setUsers(data.filter(u => u._id !== currentUserId));
      }
    } catch (e) {
      console.log("Fetch Data Error:", e);
    }
  };

  const handleModeSwitch = (mode) => {
    if (mode === 'work') {
      if (!hasCompanyAccess) {
        setVerifyModalVisible(true);
        return;
      }
    }
    setActiveMode(mode);
  };

  const handleVerifyCompany = async () => {
    if (!companyIdInput.trim()) {
      Alert.alert("Error", "Please enter a Company ID");
      return;
    }
    try {
      const userId = await AsyncStorage.getItem('userId');
      const res = await fetch(`${API_BASE}/company/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, companyId: companyIdInput })
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Company Access Granted!");
        setHasCompanyAccess(true);
        await AsyncStorage.setItem('hasCompanyAccess', 'true');
        setVerifyModalVisible(false);
        setActiveMode('work');
      } else {
        Alert.alert("Verification Failed", data.error || "Invalid ID");
      }
    } catch (error) {
      Alert.alert("Error", "Network request failed");
    }
  };

  const handleChatSelect = (item) => {
    router.push({ pathname: `/chat/${item._id}`, params: { name: item.name } });
  };

  const handleGroupOptions = async (group) => {
    const userId = await AsyncStorage.getItem('userId');
    const isPinned = group.pinnedBy && group.pinnedBy.includes(userId);

    Alert.alert(
      group.name,
      "Choose an action",
      [
        {
          text: isPinned ? "Unpin Group" : "Pin Group",
          onPress: async () => {
            try {
              const res = await fetch(`${SERVER_URL}/api/auth/chat/group/pin/${group._id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
              });
              const data = await res.json();
              if (data.success) {
                fetchPersonalGroups();
              }
            } catch (e) { Alert.alert("Error", "Failed to update pin"); }
          }
        },
        {
          text: "Delete Group",
          style: "destructive",
          onPress: async () => {
            Alert.alert("Confirm Delete", "Irreversible action.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete", style: "destructive", onPress: async () => {
                  try {
                    const res = await fetch(`${SERVER_URL}/api/auth/chat/group/${group._id}`, { method: 'DELETE' });
                    if (res.ok) fetchPersonalGroups();
                  } catch (e) { Alert.alert("Error", "Network error"); }
                }
              }
            ])
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  }; // Logic replaced.

  // Remove old code below

  const fetchPersonalGroups = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const res = await fetch(`${SERVER_URL}/api/auth/chat/groups/${userId}`);
      const data = await res.json();
      if (res.ok) {
        const sorted = data.sort((a, b) => {
          const aPinned = a.pinnedBy && a.pinnedBy.includes(userId);
          const bPinned = b.pinnedBy && b.pinnedBy.includes(userId);
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          return new Date(b.lastMessage?.createdAt || b.createdAt) - new Date(a.lastMessage?.createdAt || a.createdAt);
        });
        setPersonalGroups(sorted);
      }
    } catch (e) { console.error("Fetch Groups Error", e); }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedUsers.length === 0) {
      Alert.alert("Error", "Please enter group name and select at least one member.");
      return;
    }

    try {
      const userId = await AsyncStorage.getItem('userId');
      const res = await fetch(`${SERVER_URL}/api/auth/chat/group/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          members: selectedUsers,
          createdBy: userId,
          type: isAnnouncementGroup ? 'announcement' : 'group'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setCreateGroupModalVisible(false);
        setNewGroupName('');
        setSelectedUsers([]);
        fetchPersonalGroups();
        Alert.alert("Success", "Group created!");
      } else {
        Alert.alert("Error", data.error || "Failed to create group");
      }
    } catch (e) { Alert.alert("Error", "Network Error"); }
  };

  const fetchStatuses = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/status/feed`);
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (e) {
      console.error("Fetch Status Error", e);
    }
  };

  const handleCreateStatus = async () => {
    console.log("Create Status (Media) Pressed");

    // Request Permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    // Pick Image/Video
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          name: `status.${asset.type === 'video' ? 'mp4' : 'jpg'}`
        });

        // Upload
        console.log("Uploading to:", `${SERVER_URL}/api/auth/upload`);
        const uploadRes = await fetch(`${SERVER_URL}/api/auth/upload`, {
          method: 'POST',
          // headers: { 'Content-Type': 'multipart/form-data' }, // Let fetch handle boundary
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          console.log("Upload success:", uploadData);

          // Create Status
          const userId = await AsyncStorage.getItem('userId');
          const res = await fetch(`${SERVER_URL}/api/auth/status/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              type: asset.type || 'image',
              content: uploadData.url
            })
          });

          if (res.ok) {
            fetchStatuses();
            Alert.alert("Success", "Status Uploaded");
          } else {
            const err = await res.json();
            Alert.alert("Error", err.error || "Failed to create status");
          }
        } else {
          const errText = await uploadRes.text();
          console.log("Upload failed:", errText);
          Alert.alert("Error", "Upload failed: " + uploadRes.status);
        }
      }
    } catch (e) {
      console.error("Media Status Error:", e);
      Alert.alert("Error", "Something went wrong: " + e.message);
    }
  };

  const handleCameraStatus = async () => {
    console.log("Camera Status Pressed");

    // Request Camera Permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera permissions to make this work!');
      return;
    }

    // Launch Camera
    try {
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        // Reuse upload/create logic
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          name: `status.${asset.type === 'video' ? 'mp4' : 'jpg'}`
        });

        // Upload
        console.log("Uploading Camera media to:", `${SERVER_URL}/api/auth/upload`);
        const uploadRes = await fetch(`${SERVER_URL}/api/auth/upload`, {
          method: 'POST',
          // headers: { 'Content-Type': 'multipart/form-data' },
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          console.log("Upload success:", uploadData);

          const userId = await AsyncStorage.getItem('userId');
          const res = await fetch(`${SERVER_URL}/api/auth/status/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              type: asset.type || 'image',
              content: uploadData.url
            })
          });

          if (res.ok) {
            fetchStatuses();
            Alert.alert("Success", "Status Uploaded");
          } else {
            const err = await res.json();
            Alert.alert("Error", err.error || "Failed to create status");
          }
        } else {
          const errText = await uploadRes.text();
          Alert.alert("Error", "Upload failed: " + uploadRes.status);
        }
      }
    } catch (e) {
      console.error("Camera Error:", e);
      Alert.alert("Error", "Camera failed: " + e.message);
    }
  };



  // --- Status Logic ---
  const handleViewStatus = (userStatus) => {
    setCurrentStatusUser(userStatus);
    setCurrentStatusIndex(0);
    setViewStatusModalVisible(true);
  };

  const handleNextStatus = useCallback(() => {
    if (currentStatusUser && currentStatusIndex < currentStatusUser.statuses.length - 1) {
      setCurrentStatusIndex(prev => prev + 1);
    } else {
      setViewStatusModalVisible(false);
      setCurrentStatusUser(null);
    }
  }, [currentStatusUser, currentStatusIndex]);

  const handlePrevStatus = useCallback(() => {
    if (currentStatusIndex > 0) {
      setCurrentStatusIndex(prev => prev - 1);
    }
  }, [currentStatusIndex]);

  // Auto-Advance Effect
  useEffect(() => {
    let timer;
    if (viewStatusModalVisible && currentStatusUser) {
      const status = currentStatusUser.statuses[currentStatusIndex];
      // Only auto-advance for image/text (5 seconds). Video handles its own completion.
      if (status.type === 'image' || status.type === 'text') {
        timer = setTimeout(() => {
          handleNextStatus();
        }, 5000);
      }
    }
    return () => clearTimeout(timer);
  }, [viewStatusModalVisible, currentStatusUser, currentStatusIndex, handleNextStatus]);

  const handleDeleteStatus = async () => {
    const status = currentStatusUser.statuses[currentStatusIndex];
    const userId = await AsyncStorage.getItem('userId');

    if (!userId) {
      Alert.alert("Error", "User not identified. Please relogin.");
      return;
    }

    Alert.alert("Delete Status", "Are you sure you want to delete this update?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            console.log("Deleting status:", status._id, "User:", userId);
            const res = await fetch(`${SERVER_URL}/api/auth/status/${status._id}?userId=${userId}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
              // Remove from local list or close
              if (currentStatusUser.statuses.length === 1) {
                setViewStatusModalVisible(false);
                fetchStatuses(); // Refresh main list
              } else {
                // Remove locally and stay or move
                const updatedStatuses = currentStatusUser.statuses.filter(s => s._id !== status._id);
                setCurrentStatusUser({ ...currentStatusUser, statuses: updatedStatuses });
                if (currentStatusIndex >= updatedStatuses.length) {
                  setCurrentStatusIndex(updatedStatuses.length - 1);
                }
                fetchStatuses(); // Background refresh
              }
            } else {
              const errText = await res.text();
              console.log("Delete failed:", res.status, errText);
              Alert.alert("Error", `Failed to delete (Status ${res.status}): ${errText}`);
            }
          } catch (e) { Alert.alert("Error", "Network error"); }
        }
      }
    ]);
  };

  const [showStatusOptions, setShowStatusOptions] = useState(false);

  const renderStatusViewer = () => {
    if (!currentStatusUser) return null;
    const status = currentStatusUser.statuses[currentStatusIndex];
    const isOwner = currentStatusUser.user._id === currentUserId;

    return (
      <Modal visible={viewStatusModalVisible} animationType="fade" onRequestClose={() => setViewStatusModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'black' }}>

          {/* Content */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {status.type === 'text' ? (
              <View style={{ flex: 1, backgroundColor: status.color || '#000', justifyContent: 'center', alignItems: 'center', padding: 30 }}>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>{status.content}</Text>
              </View>
            ) : status.type === 'video' ? (
              <Video
                source={{ uri: status.content.startsWith('http') ? status.content : `${SERVER_URL}${status.content}` }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
                shouldPlay
                isLooping={false}
                onPlaybackStatusUpdate={status => {
                  if (status.didJustFinish) handleNextStatus();
                }}
              />
            ) : (
              <Image
                source={{ uri: status.content.startsWith('http') ? status.content : `${SERVER_URL}${status.content}` }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Header */}
          <View style={{ position: 'absolute', top: 40, left: 10, right: 10 }}>
            {/* Progress Bars */}
            <View style={{ flexDirection: 'row', marginBottom: 10 }}>
              {currentStatusUser.statuses.map((_, idx) => (
                <View key={idx} style={{ flex: 1, height: 3, backgroundColor: idx === currentStatusIndex ? 'white' : 'rgba(255,255,255,0.3)', marginHorizontal: 2, borderRadius: 1.5 }} />
              ))}
            </View>

            {/* Info Row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setViewStatusModalVisible(false)} style={{ marginRight: 10 }}>
                  <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Image source={{ uri: `http://192.168.29.129:5000${currentStatusUser.user.profilePic}` }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: 'white' }} />
                <View>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>
                    {isOwner ? 'You' : currentStatusUser.user.name}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{new Date(status.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>

              {/* Menu Button */}
              <TouchableOpacity onPress={() => setShowStatusOptions(true)}>
                <Ionicons name="ellipsis-vertical" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Controls */}
          <View style={{ position: 'absolute', top: 100, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={handlePrevStatus} />
            <TouchableOpacity style={{ flex: 1 }} onPress={handleNextStatus} />
          </View>

          {/* Options Modal */}
          <Modal visible={showStatusOptions} transparent animationType="fade" onRequestClose={() => setShowStatusOptions(false)}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowStatusOptions(false)}>
              <View style={{ backgroundColor: 'white', width: 250, borderRadius: 10, padding: 10 }}>

                {!isOwner && (
                  <TouchableOpacity style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }} onPress={() => {
                    setShowStatusOptions(false);
                    setViewStatusModalVisible(false);
                    router.push({ pathname: `/chat/${currentStatusUser.user._id}`, params: { name: currentStatusUser.user.name } });
                  }}>
                    <Text style={{ fontSize: 16 }}>Message</Text>
                  </TouchableOpacity>
                )}

                {isOwner && (
                  <TouchableOpacity style={{ padding: 15 }} onPress={() => {
                    setShowStatusOptions(false);
                    handleDeleteStatus();
                  }}>
                    <Text style={{ fontSize: 16, color: 'red' }}>Delete</Text>
                  </TouchableOpacity>
                )}

                {!isOwner && (
                  <TouchableOpacity style={{ padding: 15 }} onPress={() => setShowStatusOptions(false)}>
                    <Text style={{ fontSize: 16, color: 'gray' }}>Cancel</Text>
                  </TouchableOpacity>
                )}

              </View>
            </TouchableOpacity>
          </Modal>

        </View >
      </Modal >
    );
  };

  const handleSendTextStatus = async () => {
    console.log("Send Text Status Pressed. Text:", statusText);
    if (!statusText.trim()) {
      Alert.alert("Empty Status", "Please type something.");
      return;
    }
    try {
      const userId = await AsyncStorage.getItem('userId');
      const res = await fetch(`${SERVER_URL}/api/auth/status/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'text', content: statusText, color: statusColor })
      });
      if (res.ok) {
        setTextStatusVisible(false);
        setStatusText('');
        fetchStatuses();
        Alert.alert("Success", "Status Shared");
      }
    } catch (e) {
      console.error("Text Status Error:", e);
      Alert.alert("Error", "Failed to share status: " + e.message);
    }
  };

  const toggleUserSelection = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedUsers(prev => [...prev, userId]);
    }
  };

  const toggleMenu = () => {
    if (showProfileMenu) {
      closeMenu();
    } else {
      setShowProfileMenu(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    }
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -50, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setShowProfileMenu(false));
  };

  const pickImage = async () => {
    closeMenu();
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadAvatar(result.assets[0]);
    }
  };

  const uploadAvatar = async (asset) => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('image', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: 'profile.jpg',
      });

      const res = await fetch(`${SERVER_URL}/api/auth/upload-avatar`, {
        method: 'POST',
        // headers: { 'Content-Type': 'multipart/form-data' },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setProfilePic(data.profilePic);
        await AsyncStorage.setItem('profilePic', data.profilePic);
        Alert.alert("Success", "Profile updated!");
      } else {
        Alert.alert("Error", data.error || "Upload failed");
      }
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Upload failed");
    }
  };

  const toggleNumberPrivacy = async () => {
    closeMenu();
    try {
      const userId = await AsyncStorage.getItem('userId');
      const newStatus = !isNumberHidden;
      const res = await fetch(`${API_BASE}/privacy/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isHidden: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        setIsNumberHidden(data.isNumberHidden);
        Alert.alert("Privacy Updated", data.isNumberHidden ? "Number Hidden" : "Number Visible");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to update privacy");
    }
  };

  const handleLogout = () => {
    closeMenu();
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove(['token', 'userId', 'userName', 'userRole', 'profilePic']);
          router.replace('/(auth)/login');
        }
      }
    ]);
  };

  const renderContent = () => {
    // --- Personal Views ---
    if (activeMode === 'personal') {
      if (activeTab === 'chats') {
        return (
          <PersonalChats users={users} onChatSelect={handleChatSelect} theme={theme} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
        );
      }
      if (activeTab === 'status') {
        return (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
              {/* My Status */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ position: 'relative' }}>
                  {profilePic ? (
                    <Image source={{ uri: `http://192.168.29.129:5000${profilePic}` }} style={{ width: 55, height: 55, borderRadius: 27.5 }} />
                  ) : (
                    <View style={{ width: 55, height: 55, borderRadius: 27.5, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="person" size={30} color={theme.textSecondary} />
                    </View>
                  )}
                  <TouchableOpacity onPress={handleCreateStatus} style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.secondary, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: theme.surface }}>
                    <Ionicons name="add" size={14} color="white" />
                  </TouchableOpacity>
                </View>
                <View style={{ marginLeft: 15 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.textPrimary }}>My Status</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Tap to add status update</Text>
                </View>
              </View>

              <Text style={{ color: theme.textSecondary, fontWeight: 'bold', marginBottom: 10 }}>Recent Updates</Text>

              {statuses.length === 0 ? (
                <Text style={{ color: theme.textLight, fontStyle: 'italic', marginTop: 10 }}>No recent updates</Text>
              ) : (
                statuses.map((item, index) => (
                  <TouchableOpacity key={index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }} onPress={() => handleViewStatus(item)}>
                    <View style={{ width: 55, height: 55, borderRadius: 27.5, padding: 2, borderWidth: 2, borderColor: theme.secondary }}>
                      {item.user.profilePic ? (
                        <Image source={{ uri: `http://192.168.29.129:5000${item.user.profilePic}` }} style={{ width: '100%', height: '100%', borderRadius: 27.5 }} />
                      ) : (
                        <View style={{ width: '100%', height: '100%', borderRadius: 27.5, backgroundColor: theme.inputBg }} />
                      )}
                    </View>
                    <View style={{ marginLeft: 15 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16, color: theme.textPrimary }}>
                        {item.user._id === currentUserId ? 'You' : item.user.name}
                      </Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{new Date(item.statuses[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 20, right: 20, backgroundColor: theme.secondary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 }}
              onPress={() => setTextStatusVisible(true)}
            >
              <Ionicons name="pencil" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 90, right: 28, backgroundColor: theme.surface, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 5 }}
              onPress={handleCameraStatus}
            >
              <Ionicons name="camera" size={20} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        );
      }

      if (activeTab === 'groups') {
        return (
          <View style={{ flex: 1 }}>
            {personalGroups.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="people-outline" size={50} color={theme.textLight} />
                <Text style={{ color: theme.textLight, marginTop: 10 }}>No groups yet</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>

                {/* Announcements Section */}
                {personalGroups.filter(g => g.type === 'announcement').length > 0 && (
                  <>
                    <Text style={{ paddingHorizontal: 15, paddingVertical: 10, color: theme.secondary, fontWeight: 'bold', fontSize: 13, backgroundColor: theme.background }}>Announcement</Text>
                    {personalGroups.filter(g => g.type === 'announcement').map(group => (
                      <TouchableOpacity key={group._id} style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface }} onPress={() => router.push({ pathname: `/chat/group/${group._id}`, params: { name: group.name } })} onLongPress={() => handleGroupOptions(group)}>
                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                          <Ionicons name="megaphone" size={24} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.textPrimary }}>{group.name}</Text>
                          <Text style={{ fontSize: 13, color: theme.textSecondary }}>{group.members.length} members</Text>
                        </View>
                        {group.pinnedBy && group.pinnedBy.includes(currentUserId) && (
                          <Ionicons name="pin" size={16} color={theme.textLight} style={{ marginRight: 10 }} />
                        )}
                        <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Other Communities Section */}
                {personalGroups.filter(g => g.type !== 'announcement').length > 0 && (
                  <>
                    <Text style={{ paddingHorizontal: 15, paddingVertical: 10, color: theme.secondary, fontWeight: 'bold', fontSize: 13, backgroundColor: theme.background }}>Communities</Text>

                    {personalGroups.filter(g => g.type !== 'announcement').map(group => (
                      <TouchableOpacity key={group._id} style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface }} onPress={() => router.push({ pathname: `/chat/group/${group._id}`, params: { name: group.name } })} onLongPress={() => handleGroupOptions(group)}>
                        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                          <Ionicons name="people" size={24} color="white" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.textPrimary }}>{group.name}</Text>
                          <Text style={{ fontSize: 13, color: theme.textSecondary }}>{group.members.length} members</Text>
                        </View>
                        {group.pinnedBy && group.pinnedBy.includes(currentUserId) && (
                          <Ionicons name="pin" size={16} color={theme.textLight} style={{ marginRight: 10 }} />
                        )}
                        <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            )}

            {/* FAB for Group Creation */}
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 20, right: 20, backgroundColor: theme.secondary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 }}
              onPress={() => { setCreateGroupModalVisible(true); }}
            >
              <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>
          </View>
        );
      }
      return <Placeholder text="Coming Soon" theme={theme} />;
    }

    if (activeTab === 'calls') {
      return (
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 15 }}>Recent</Text>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.inputBg, marginRight: 15, justifyContent: 'center', alignItems: 'center' }}>
                  <Image source={{ uri: `https://i.pravatar.cc/150?u=${i + 10}` }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.textPrimary }}>User {i}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="call-outline" size={14} color={i % 2 === 0 ? theme.error : theme.secondary} />
                    <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 5 }}>Today, 10:30 AM</Text>
                  </View>
                </View>
                <TouchableOpacity>
                  <Ionicons name="call" size={24} color={theme.secondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {/* FAB for New Call */}
          <TouchableOpacity
            style={{ position: 'absolute', bottom: 20, right: 20, backgroundColor: theme.secondary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 }}
            onPress={() => Alert.alert("New Call", "Select contact")}
          >
            <Ionicons name="add-outline" size={30} color="white" />
          </TouchableOpacity>
        </ScrollView>
      );
    }


    if (activeMode === 'work') {
      if (activeTab === 'gd') return <View style={{ flex: 1 }}><GroupDiscussionScreen showBack={false} /></View>;
      if (activeTab === 'announcement') return <View style={{ flex: 1 }}><AnnouncementGroupsScreen /></View>;
      if (activeTab === 'admin') return <WorkAdmin role={userRole} adminId={adminId} router={router} theme={theme} />;
      if (activeTab === 'video') return <WorkVideo router={router} theme={theme} styles={styles} />;
      return <Placeholder text="Work View" theme={theme} />;
    }

    // --- Social Views ---
    if (activeMode === 'social') {
      return <Placeholder text={`Social Media - ${activeTab.toUpperCase()}`} theme={theme} />;
      // Will Integrate Social Feed later
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* 0. Header with Hike Finance Branding */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {/* Profile */}
          <TouchableOpacity onPress={() => setProfileZoomVisible(true)}>
            {profilePic ? (
              <Image source={{ uri: `http://192.168.29.129:5000${profilePic}` }} style={styles.profilePic} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>{userName ? userName[0].toUpperCase() : '?'}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Logo Text */}
          <Text style={[styles.logoText, { color: Colors.white }]}>Hike Finance</Text>

          {/* Menu */}
          <TouchableOpacity onPress={toggleMenu}>
            <Ionicons name="ellipsis-vertical" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu Dropdown */}
      {showProfileMenu && (
        <Animated.View style={[styles.profileMenu, { transform: [{ translateY: slideAnim }], opacity: opacityAnim, backgroundColor: theme.surface }]}>
          <View style={{ padding: 15, borderBottomWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontWeight: 'bold', color: theme.textPrimary }}>{userName}</Text>
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); setShowProfileDetail(true); }}>
            <Ionicons name="person-circle-outline" size={20} color={theme.textPrimary} />
            <Text style={[styles.menuText, { color: theme.textPrimary }]}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={pickImage}>
            <Ionicons name="camera-outline" size={20} color={theme.textPrimary} />
            <Text style={[styles.menuText, { color: theme.textPrimary }]}>Change Profile Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={toggleNumberPrivacy}>
            <Ionicons name={isNumberHidden ? "eye-outline" : "eye-off-outline"} size={20} color={theme.textPrimary} />
            <Text style={[styles.menuText, { color: theme.textPrimary }]}>{isNumberHidden ? "Disclose Number" : "Hide Number"}</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={theme.error} />
            <Text style={[styles.menuText, { color: theme.error }]}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* 1. Top Header Mode Switcher */}
      <ModeSwitcher currentMode={activeMode} onSwitch={handleModeSwitch} theme={theme} />

      {/* 2. Content Area */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* 3. Bottom Nav Bar */}
      <BottomNavBar mode={activeMode} activeTab={activeTab} onTabPress={setActiveTab} theme={theme} />


      {/* Modals */}
      <Modal animationType="slide" transparent={true} visible={verifyModalVisible} onRequestClose={() => setVerifyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalView, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Company Verification</Text>
            <Text style={{ color: theme.textSecondary, marginBottom: 20, textAlign: 'center' }}>Enter Company ID</Text>
            <TextInput
              placeholder="Enter Company ID"
              placeholderTextColor={theme.textLight}
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]}
              value={companyIdInput}
              onChangeText={setCompanyIdInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.fullWidthBtn, { backgroundColor: theme.secondary }]} onPress={handleVerifyCompany}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Verify</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 15 }} onPress={() => setVerifyModalVisible(false)}>
              <Text style={{ color: theme.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile Zoom Modal */}
      <Modal visible={profileZoomVisible} transparent={true} animationType="fade" onRequestClose={() => setProfileZoomVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }} onPress={() => setProfileZoomVisible(false)}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          {profilePic ? (
            <Image
              source={{ uri: `http://192.168.29.129:5000${profilePic}` }}
              style={{ width: '100%', height: 400, resizeMode: 'contain' }}
            />
          ) : (
            <View style={{ width: 200, height: 200, backgroundColor: Colors.secondary, borderRadius: 100, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 80, fontWeight: 'bold' }}>{userName ? userName[0].toUpperCase() : '?'}</Text>
            </View>
          )}
        </View>
      </Modal>


      {/* Profile Detail Modal */}
      <Modal visible={showProfileDetail} transparent={true} animationType="slide" onRequestClose={() => setShowProfileDetail(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalView, { backgroundColor: theme.surface, alignItems: 'center' }]}>
            <TouchableOpacity style={{ position: 'absolute', top: 15, right: 15 }} onPress={() => setShowProfileDetail(false)}>
              <Ionicons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>

            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 20 }}>My Profile</Text>

            {profilePic ? (
              <Image source={{ uri: `http://192.168.29.129:5000${profilePic}` }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 15 }} />
            ) : (
              <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ color: 'white', fontSize: 40, fontWeight: 'bold' }}>{userName ? userName[0].toUpperCase() : '?'}</Text>
              </View>
            )}

            <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 5 }}>{userName}</Text>
            <Text style={{ fontSize: 16, color: theme.textSecondary, marginBottom: 20 }}>User</Text>

            {/* Phone Display Logic */}
            {!isNumberHidden && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, padding: 15, borderRadius: 12, width: '100%' }}>
                <Ionicons name="call-outline" size={20} color={theme.secondary} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16, color: theme.textPrimary }}>{phoneNumber || 'No Number'}</Text>
              </View>
            )}
            {isNumberHidden && (
              <Text style={{ color: theme.textLight, fontStyle: 'italic' }}>Number is hidden</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={createGroupModalVisible} transparent={true} animationType="slide" onRequestClose={() => setCreateGroupModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalView, { height: '80%', padding: 0, backgroundColor: theme.surface, borderRadius: 20 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <TouchableOpacity onPress={() => setCreateGroupModalVisible(false)} style={{ marginRight: 15 }}>
                <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary }}>Create New Group</Text>
            </View>

            {/* Group Name Input */}
            <View style={{ padding: 20 }}>
              <Text style={{ color: theme.textSecondary, marginBottom: 8, marginLeft: 5 }}>Group Name</Text>
              <TextInput
                placeholder="Enter group name..."
                placeholderTextColor={theme.textLight}
                style={{ backgroundColor: theme.inputBg, padding: 12, borderRadius: 10, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border }}
                value={newGroupName}
                onChangeText={setNewGroupName}
              />
            </View>

            {/* Group Type Selector */}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 }} onPress={() => setIsAnnouncementGroup(!isAnnouncementGroup)}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isAnnouncementGroup ? theme.secondary : theme.textLight, justifyContent: 'center', alignItems: 'center', backgroundColor: isAnnouncementGroup ? theme.secondary : 'transparent', marginRight: 10 }}>
                {isAnnouncementGroup && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <View>
                <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>Announcement Group (Community)</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Only admins can send messages</Text>
              </View>
            </TouchableOpacity>

            <Text style={{ paddingHorizontal: 20, paddingBottom: 10, color: theme.textSecondary, fontWeight: 'bold' }}>Select Members</Text>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }}>
              {users.map(user => (
                <TouchableOpacity
                  key={user._id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}
                  onPress={() => toggleUserSelection(user._id)}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.inputBg, marginRight: 15, justifyContent: 'center', alignItems: 'center' }}>
                    {user.profilePic ? (
                      <Image source={{ uri: `http://192.168.29.129:5000${user.profilePic}` }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    ) : (
                      <Text style={{ color: theme.textSecondary, fontSize: 18 }}>{user.name?.[0]}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textPrimary, fontWeight: 'bold', fontSize: 15 }}>{user.name}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{user.role || 'User'}</Text>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selectedUsers.includes(user._id) ? theme.secondary : theme.textLight, justifyContent: 'center', alignItems: 'center', backgroundColor: selectedUsers.includes(user._id) ? theme.secondary : 'transparent' }}>
                    {selectedUsers.includes(user._id) && <Ionicons name="checkmark" size={16} color="white" />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: theme.border, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={handleCreateGroup}
                style={{ backgroundColor: theme.secondary, borderRadius: 25, width: '100%', paddingVertical: 15, alignItems: 'center', opacity: selectedUsers.length > 0 && newGroupName.length > 0 ? 1 : 0.6 }}
                disabled={selectedUsers.length === 0 || newGroupName.length === 0}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Create Group ({selectedUsers.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Text Status Modal */}
      <Modal visible={textStatusVisible} animationType="slide" onRequestClose={() => setTextStatusVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: statusColor, justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }} onPress={() => setTextStatusVisible(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>

            <TextInput
              style={{ fontSize: 30, color: 'white', textAlign: 'center', fontWeight: 'bold', width: '80%', maxHeight: 200 }}
              placeholder="Type a status..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              multiline
              value={statusText}
              onChangeText={setStatusText}
              autoFocus
            />

            <View style={{ position: 'absolute', bottom: 100, flexDirection: 'row', alignItems: 'center' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {STATUS_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, marginHorizontal: 5, borderWidth: 2, borderColor: statusColor === c ? 'white' : 'transparent' }}
                    onPress={() => setStatusColor(c)}
                  />
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={{ position: 'absolute', bottom: 30, right: 30, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 }}
              onPress={handleSendTextStatus}
            >
              <Ionicons name="paper-plane" size={24} color={statusColor} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {renderStatusViewer()}

    </SafeAreaView >
  );
}

// Utility Placeholder
const Placeholder = ({ text, action, theme }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: theme.textSecondary, marginBottom: 20 }}>{text}</Text>
    {action && (
      <TouchableOpacity onPress={action} style={{ padding: 10, backgroundColor: theme.secondary, borderRadius: 8 }}>
        <Text style={{ color: 'white' }}>Open</Text>
      </TouchableOpacity>
    )}
  </View>
);

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalView: { width: '85%', padding: 25, borderRadius: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { padding: 15, borderRadius: 12, borderWidth: 1, width: '100%', marginBottom: 15 },
  fullWidthBtn: { padding: 15, borderRadius: 12, alignItems: 'center', width: '100%' },

  // Header Styles
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profilePic: { width: 35, height: 35, borderRadius: 17.5, borderWidth: 1, borderColor: Colors.accent },
  profilePlaceholder: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 22, fontWeight: 'bold', letterSpacing: 0.5 },

  // Menu
  profileMenu: { position: 'absolute', top: 60, right: 20, borderRadius: 12, elevation: 10, zIndex: 100, minWidth: 200, paddingVertical: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 0 },
  menuText: { marginLeft: 10, fontSize: 14, fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: '#eee', marginVertical: 5 }
});

const WorkAdmin = ({ role, adminId, router, theme }) => {
  if (role === 'admin') {
    return <View style={{ flex: 1 }}><AdminDashboard /></View>;
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Ionicons name="shield-checkmark-outline" size={80} color={theme.textLight} style={{ marginBottom: 20 }} />
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 10 }}>Administrator Support</Text>
      <Text style={{ textAlign: 'center', color: theme.textSecondary, marginBottom: 30 }}>
        Need help? Contact the administrator directly.
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: theme.secondary, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, flexDirection: 'row', alignItems: 'center' }}
        onPress={() => {
          if (adminId) router.push({ pathname: `/chat/${adminId}`, params: { name: 'Admin' } });
          else Alert.alert("Error", "Admin not found");
        }}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={20} color="white" style={{ marginRight: 10 }} />
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Chat with Admin</Text>
      </TouchableOpacity>
    </View>
  );
};

const WorkVideo = ({ router, theme, styles }) => {
  const [code, setCode] = useState('');
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
      <View style={{ width: '100%', alignItems: 'center', marginBottom: 40 }}>
        <Ionicons name="videocam" size={60} color={theme.secondary} style={{ marginBottom: 10 }} />
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.textPrimary }}>Video Meetings</Text>
        <Text style={{ color: theme.textSecondary }}>Secure, high-quality video conferencing</Text>
      </View>

      <View style={{ width: '100%', marginBottom: 30 }}>
        <TextInput
          placeholder="Enter Meeting Code"
          placeholderTextColor={theme.textLight}
          value={code}
          onChangeText={setCode}
          style={[styles.input, { textAlign: 'center', fontSize: 18, letterSpacing: 2 }]}
        />
        <TouchableOpacity
          onPress={() => {
            if (code.trim()) router.push(`/meet/${code}`);
            else Alert.alert("Error", "Enter a code");
          }}
          style={[styles.fullWidthBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Join Meeting</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 30 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        <Text style={{ marginHorizontal: 15, color: theme.textSecondary, fontWeight: 'bold' }}>OR</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      </View>

      <TouchableOpacity
        onPress={() => router.push('/meet/schedule')}
        style={[styles.fullWidthBtn, { backgroundColor: theme.secondary }]}
      >
        <Ionicons name="calendar-outline" size={20} color="white" style={{ marginRight: 10 }} />
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Schedule New Meeting</Text>
      </TouchableOpacity>
    </View>
  )
};