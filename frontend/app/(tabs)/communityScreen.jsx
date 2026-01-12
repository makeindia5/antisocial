import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Alert, Animated, Image, TouchableOpacity, ScrollView, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
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

  // Data State
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ chat: 0, gd: 0, announcement: 0 });
  const [hasCompanyAccess, setHasCompanyAccess] = useState(false);

  // Verification Modal State
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [companyIdInput, setCompanyIdInput] = useState('');

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

      const res = await fetch(`${API_BASE}/community/users`);

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
        const currentUserId = await AsyncStorage.getItem('userId');
        setUsers(data.filter(u => u._id !== currentUserId));
      }
    } catch (e) {
      console.log(e);
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

      const res = await fetch(`${API_BASE}/upload-avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
      if (activeTab === 'chats') return <PersonalChats users={users} onChatSelect={handleChatSelect} theme={theme} />;
      if (activeTab === 'status') return <Placeholder text="Status Updates - Coming Soon" theme={theme} />;
      if (activeTab === 'groups') return <Placeholder text="Personal Groups - Coming Soon" theme={theme} />;
      return <Placeholder text="Coming Soon" theme={theme} />;
    }

    // --- Work Views ---
    if (activeMode === 'work') {
      if (activeTab === 'gd') return <View style={{ flex: 1 }}><GroupDiscussionScreen /></View>;
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