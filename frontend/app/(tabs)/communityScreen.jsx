import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ActivityIndicator, Animated, Image, Easing, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { API_BASE } from '../../src/services/apiService';
import { Colors, GlobalStyles } from '../../src/styles/theme';

export default function CommunityScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [meetCode, setMeetCode] = useState('');
  const [userName, setUserName] = useState('');
  const [profilePic, setProfilePic] = useState(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-50)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  const [counts, setCounts] = useState({ chat: 0, gd: 0, announcement: 0 });

  useFocusEffect(
    useCallback(() => {
      fetchCounts();
    }, [])
  );

  const fetchCounts = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const name = await AsyncStorage.getItem('userName');
      if (name) setUserName(name);

      const pic = await AsyncStorage.getItem('profilePic');
      if (pic) setProfilePic(pic);

      const lastReadGD = await AsyncStorage.getItem('lastReadGD');
      const lastReadAnnounce = await AsyncStorage.getItem('lastReadAnnounce');

      const query = new URLSearchParams({
        userId,
        lastReadGD: lastReadGD || '',
        lastReadAnnounce: lastReadAnnounce || ''
      }).toString();

      const res = await fetch(`${API_BASE}/counts?${query}`);
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch (e) {
      console.log("Error fetching counts", e);
    }
  };

  const toggleMenu = () => {
    if (showProfileMenu) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -50, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start(() => setShowProfileMenu(false));
    } else {
      setShowProfileMenu(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
    }
  };

  const pickImage = async () => {
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
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const data = await res.json();
      if (res.ok) {
        setProfilePic(data.profilePic);
        await AsyncStorage.setItem('profilePic', data.profilePic);
        Alert.alert("Success", "Profile updated!");
        toggleMenu();
      } else {
        Alert.alert("Error", data.error || "Upload failed");
      }
    } catch (e) {
      Alert.alert("Error", "Upload failed");
    }
  };

  const handleJoinMeet = () => {
    if (!meetCode) {
      Alert.alert("Error", "Please enter a code");
      return;
    }
    setModalVisible(false);
    router.push(`/meet/${meetCode}`);
  };

  const goToChat = async () => {
    try {
      const res = await fetch(`http://192.168.29.129:5000/api/auth/admin-id`);
      const data = await res.json();
      if (data.adminId) {
        router.push(`/chat/${data.adminId}`);
      } else {
        Alert.alert("Error", "Admin not found");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to connect to server");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Profile",
      `Logged in as ${userName || 'User'}\nDo you want to logout?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const handlePressAnnouncement = async () => {
    await AsyncStorage.setItem('lastReadAnnounce', new Date().toISOString());
    router.push('/announcement');
  };

  const handlePressGD = async () => {
    await AsyncStorage.setItem('lastReadGD', new Date().toISOString());
    router.push('/gd');
  };

  const Badge = ({ count }) => {
    if (!count || count <= 0) return null;
    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count}</Text>
      </View>
    );
  };

  return (
    <View style={GlobalStyles.container}>
      {/* Header with Dashboard feel */}
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.welcomeText}>Welcome Back,</Text>
              <Text style={styles.headerText}>{userName || 'User'}</Text>
            </View>
            <TouchableOpacity onPress={toggleMenu}>
              {profilePic ? (
                <Image source={{ uri: `http://192.168.29.129:5000${profilePic}` }} style={styles.profileImage} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Ionicons name="person" size={24} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Dropdown Menu */}
      {showProfileMenu && (
        <TouchableWithoutFeedback onPress={toggleMenu}>
          <View style={styles.menuBackdrop} />
        </TouchableWithoutFeedback>
      )}
      {showProfileMenu && (
        <Animated.View style={[styles.profileMenu, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
          <TouchableOpacity style={styles.menuItem} onPress={pickImage}>
            <Ionicons name="camera-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.menuText}>Change Profile</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={[styles.menuText, { color: Colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.grid}>
        {/* Dashboard Title */}
        <Text style={styles.dashboardTitle}>Dashboard</Text>

        <View style={styles.row}>
          <TouchableOpacity style={styles.card} onPress={handlePressAnnouncement}>
            <View style={[styles.iconBox, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="megaphone" size={32} color={Colors.secondary} />
            </View>
            <Text style={styles.cardText}>Announcements</Text>
            <Text style={styles.cardSubText}>Latest updates</Text>
            <Badge count={counts.announcement} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={goToChat}>
            <View style={[styles.iconBox, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="chatbubbles" size={32} color={Colors.success} />
            </View>
            <Text style={styles.cardText}>Admin Chat</Text>
            <Text style={styles.cardSubText}>Direct support</Text>
            <Badge count={counts.chat} />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.card} onPress={handlePressGD}>
            <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="people" size={32} color={Colors.accent} />
            </View>
            <Text style={styles.cardText}>Group Discussion</Text>
            <Text style={styles.cardSubText}>Community chat</Text>
            <Badge count={counts.gd} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/social')}>
            <View style={[styles.iconBox, { backgroundColor: '#fae8ff' }]}>
              <Ionicons name="share-social" size={32} color="#a855f7" />
            </View>
            <Text style={styles.cardText}>Social Media</Text>
            <Text style={styles.cardSubText}>Connect & Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.card, { width: '100%' }]} onPress={() => setModalVisible(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.iconBox, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="videocam" size={32} color="#ef4444" />
              </View>
              <View style={{ marginLeft: 15 }}>
                <Text style={styles.cardText}>Video Meet</Text>
                <Text style={styles.cardSubText}>Join live sessions</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={Colors.textLight} style={{ marginLeft: 'auto' }} />
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Video Meet</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Join a Meeting</Text>
            <View style={styles.joinContainer}>
              <TextInput
                style={GlobalStyles.input}
                placeholder="Enter Code (e.g., ABC123)"
                value={meetCode}
                onChangeText={setMeetCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity onPress={handleJoinMeet} style={[GlobalStyles.button, { marginLeft: 10, paddingVertical: 12, paddingHorizontal: 20 }]}>
                <Text style={GlobalStyles.buttonText}>Join</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Upcoming Meetings</Text>

            <MeetingsList onSelect={(meeting) => {
              const meetDate = new Date(meeting.scheduledTime);
              const now = new Date();
              const timeDiff = meetDate - now;
              const tenMinutes = 10 * 60 * 1000;
              if (timeDiff > tenMinutes) {
                Alert.alert("Upcoming Meeting", `This meeting is scheduled for \n${meetDate.toDateString()} at ${meetDate.toLocaleTimeString()}.\n\nYou can join 10 minutes before the start time.`);
                return;
              }
              setMeetCode(meeting.code);
            }} />

          </View>
        </View>
      </Modal>

    </View>
  );
}

// Sub-component for list
const MeetingsList = ({ onSelect }) => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchMeetings();
    }, [])
  );

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`${API_BASE}/meet/list`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator size="small" color={Colors.secondary} />;

  if (meetings.length === 0) return <Text style={{ color: Colors.textLight, fontStyle: 'italic', marginTop: 10 }}>No upcoming meetings.</Text>;

  return (
    <View style={{ maxHeight: 200, width: '100%' }}>
      {meetings.slice(0, 3).map((m, i) => (
        <TouchableOpacity key={i} style={styles.meetingItem} onPress={() => onSelect(m)}>
          <View>
            <Text style={styles.meetingTitle}>{m.title}</Text>
            <Text style={styles.meetingTime}>
              {new Date(m.scheduledTime).toLocaleDateString()} • {new Date(m.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{m.code}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 10
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10
  },
  welcomeText: { color: Colors.textLight, fontSize: 14 },
  headerText: { color: Colors.white, fontSize: 24, fontWeight: 'bold' },
  profileImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: Colors.accent },
  profilePlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },

  grid: { padding: 20 },
  dashboardTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },

  card: {
    width: '48%',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },
  cardText: { fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary },
  cardSubText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalView: { margin: 20, backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 10 },

  joinContainer: { flexDirection: 'row', marginBottom: 5, alignItems: 'center' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },

  meetingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: Colors.inputBg, borderRadius: 12, marginBottom: 8 },
  meetingTitle: { fontWeight: 'bold', color: Colors.textPrimary, fontSize: 14 },
  meetingTime: { fontSize: 12, color: Colors.textSecondary },
  codeBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  codeText: { fontSize: 12, fontWeight: 'bold', color: Colors.secondary },

  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.error,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },

  // Menu Styles
  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 },
  profileMenu: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 10,
    zIndex: 20,
    width: 180,
    paddingVertical: 5
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  menuText: { marginLeft: 10, fontSize: 16, color: Colors.textPrimary, fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 15 }
});