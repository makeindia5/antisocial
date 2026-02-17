import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ScrollView, StyleSheet, Animated, Modal, TextInput, KeyboardAvoidingView, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../src/services/apiService';
import { Colors } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
    const { colors: theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [users, setUsers] = useState([]);
    const [meetings, setMeetings] = useState([]); // New State
    const [meetModalVisible, setMeetModalVisible] = useState(false);
    const [companyModalVisible, setCompanyModalVisible] = useState(false);

    // Meeting & Company State
    const [meetTitle, setMeetTitle] = useState('');
    const [meetDate, setMeetDate] = useState(new Date());
    const [meetTab, setMeetTab] = useState('instant');
    const [createdCode, setCreatedCode] = useState(null);
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [mode, setMode] = useState('date');

    const [companyName, setCompanyName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [generatedId, setGeneratedId] = useState('');
    const [companyHistory, setCompanyHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            fetchUsers();
            fetchMeetings(); // Fetch meetings on focus
        }, [])
    );

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/users`);
            const data = await res.json();
            setUsers(data);
        } catch (err) { }
    };

    const fetchMeetings = async () => {
        try {
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/meet/list`);
            const data = await res.json();
            if (res.ok) setMeetings(data);
        } catch (err) { }
    };

    const handleCreateCompanyId = async () => {
        if (!companyName.trim()) { Alert.alert("Error", "Enter Name"); return; }
        try {
            const adminId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/company/create`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, contactNumber, adminId })
            });
            const data = await res.json();
            if (res.ok) { setGeneratedId(data.companyId); fetchCompanyHistory(); }
        } catch (e) { }
    };

    const fetchCompanyHistory = async () => {
        try {
            const adminId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/company/history/${adminId}`);
            if (res.ok) setCompanyHistory(await res.json());
        } catch (e) { }
    };

    const scheduleMeet = async () => {
        if (!meetTitle.trim()) { Alert.alert("Error", "Enter Title"); return; }
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/meet/schedule`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: meetTitle, scheduledTime: meetDate.toISOString(), hostId: userId })
            });
            const data = await res.json();
            if (res.ok) {
                setCreatedCode(data.meeting.code);
                setSuccessModalVisible(true);
                setMeetModalVisible(false);
                fetchMeetings(); // Refresh list
            }
        } catch (e) { }
    };

    const cancelMeeting = async (id) => {
        Alert.alert(
            "Cancel Meeting",
            "Are you sure you want to cancel this meeting?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/meet/${id}`, {
                                method: 'DELETE'
                            });
                            if (res.ok) {
                                Alert.alert("Success", "Meeting cancelled");
                                fetchMeetings();
                            }
                        } catch (e) { }
                    }
                }
            ]
        );
    };

    const startScheduledMeeting = async (code) => {
        try {
            await fetch(`${API_BASE}/meet/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            fetchMeetings(); // Refresh to show Live status
            router.push(`/meet/${code}`);
        } catch (e) { router.push(`/meet/${code}`); }
    };

    const endScheduledMeeting = async (code) => {
        Alert.alert(
            "End Meeting",
            "Are you sure you want to end this live meeting?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "End Meeting",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await fetch(`${API_BASE}/meet/end`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code })
                            });
                            if (res.ok) {
                                Alert.alert("Success", "Meeting ended");
                                fetchMeetings();
                            }
                        } catch (e) { }
                    }
                }
            ]
        );
    };

    const createInstantMeet = async () => {
        try {
            const adminId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${API_BASE.replace('/auth', '/admin')}/meet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: adminId })
            });
            const data = await res.json();
            setCreatedCode(data.roomCode);
            setSuccessModalVisible(true);
            setMeetModalVisible(false);
        } catch (e) { }
    };

    // Actions
    const ACTIONS = [
        { icon: 'megaphone', label: 'Announcements', color: '#FF3B30', onPress: () => router.push('/announcement') },
        { icon: 'videocam', label: 'Meetings', color: '#5856D6', onPress: () => setMeetModalVisible(true) },
        { icon: 'people', label: 'Discussions', color: '#FF9500', onPress: () => router.push('/gd') },
        {
            icon: 'id-card', label: 'Create ID', color: '#007AFF', onPress: () => {
                setGeneratedId(''); setCompanyName(''); setShowHistory(false); fetchCompanyHistory(); setCompanyModalVisible(true);
            }
        },
    ];

    const styles = getStyles(theme);

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 10 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Details</Text>
                <Text style={{ fontSize: 32, fontWeight: '800', color: theme.textPrimary, letterSpacing: -1 }}>Admin Dashboard</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Grid */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Quick Actions</Text>
                <View style={styles.grid}>
                    {ACTIONS.map((a, i) => (
                        <TouchableOpacity key={i} style={[styles.card, { backgroundColor: theme.surface }]} onPress={a.onPress}>
                            <View style={[styles.iconCircle, { backgroundColor: a.color + '20' }]}>
                                <Ionicons name={a.icon} size={28} color={a.color} />
                            </View>
                            <Text style={[styles.cardLabel, { color: theme.textPrimary }]}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Scheduled Meetings */}
                {meetings.length > 0 && (
                    <View style={{ marginTop: 20 }}>
                        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Upcoming Meetings</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                            {meetings.map((m, i) => (
                                <View key={i} style={{ width: 280, padding: 15, backgroundColor: theme.surface, borderRadius: 20, marginRight: 15 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.textPrimary, flex: 1 }} numberOfLines={1}>{m.title}</Text>
                                                {m.isStarted && (
                                                    <View style={{ backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 5 }}>
                                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>LIVE</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>
                                                {new Date(m.scheduledTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(m.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>

                                            {/* Code Display */}
                                            <TouchableOpacity
                                                onPress={() => { Clipboard.setStringAsync(m.code); Alert.alert("Copied Code"); }}
                                                style={{ marginBottom: 10 }}
                                            >
                                                <Text style={{ fontSize: 13, color: theme.primary, fontWeight: '600' }}>
                                                    Code: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 15 }}>{m.code}</Text>
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={{ alignItems: 'flex-end' }}>
                                            <TouchableOpacity
                                                style={{ backgroundColor: m.isStarted ? '#FF3B30' : theme.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, marginBottom: 10 }}
                                                onPress={() => m.isStarted ? endScheduledMeeting(m.code) : startScheduledMeeting(m.code)}
                                            >
                                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{m.isStarted ? 'End' : 'Start'}</Text>
                                            </TouchableOpacity>

                                            {!m.isStarted && (
                                                <TouchableOpacity
                                                    onPress={() => cancelMeeting(m._id)}
                                                    style={{ padding: 5 }}
                                                >
                                                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>

                                    <Text style={{ fontSize: 11, color: theme.textSecondary, alignSelf: 'flex-start' }}>By: {m.hostId?.name || 'Admin'}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* User Table (Excel-like) */}
                <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 30 }]}>User Directory</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginBottom: 20 }}>
                    <View>
                        {/* Header Row */}
                        <View style={[styles.tableRow, { backgroundColor: theme.inputBg, borderTopLeftRadius: 10, borderTopRightRadius: 10 }]}>
                            <Text style={[styles.tableHeader, { color: theme.textPrimary, width: 250, paddingLeft: 10 }]}>User</Text>
                            <Text style={[styles.tableHeader, { color: theme.textPrimary, width: 200 }]}>Email</Text>
                            <Text style={[styles.tableHeader, { color: theme.textPrimary, width: 100 }]}>Role</Text>
                            <Text style={[styles.tableHeader, { color: theme.textPrimary, width: 100 }]}>Status</Text>
                            <Text style={[styles.tableHeader, { color: theme.textPrimary, width: 150 }]}>Last Seen</Text>
                        </View>

                        {/* Data Rows */}
                        {users.map((u, i) => (
                            <View key={i} style={[styles.tableRow, { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                                {/* User Column */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', width: 250, paddingLeft: 10 }}>
                                    <View style={[styles.avatarSmall, { backgroundColor: theme.inputBg }]}>
                                        {u.profilePic ? (
                                            <Image source={{ uri: u.profilePic.startsWith('http') ? u.profilePic : `${API_BASE.replace('/api/auth', '')}${u.profilePic}` }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                        ) : (
                                            <Text style={{ fontWeight: 'bold', color: theme.textSecondary, fontSize: 12 }}>{u.name?.[0]?.toUpperCase()}</Text>
                                        )}
                                    </View>
                                    <Text style={{ fontWeight: '600', color: theme.textPrimary, marginLeft: 10 }}>{u.name}</Text>
                                </View>

                                {/* Email Column */}
                                <Text style={{ width: 200, color: theme.textSecondary, fontSize: 13 }}>{u.email}</Text>

                                {/* Role Column */}
                                <View style={{ width: 100 }}>
                                    <View style={{ backgroundColor: u.role === 'admin' ? '#FF3B3015' : '#007AFF15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' }}>
                                        <Text style={{ color: u.role === 'admin' ? '#FF3B30' : '#007AFF', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>{u.role || 'User'}</Text>
                                    </View>
                                </View>

                                {/* Status Column */}
                                <View style={{ width: 100, flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: u.status === 'online' ? '#4CD964' : '#8E8E93', marginRight: 6 }} />
                                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{u.status === 'online' ? 'Online' : 'Offline'}</Text>
                                </View>

                                {/* Last Seen Column */}
                                <Text style={{ width: 150, color: theme.textSecondary, fontSize: 13 }}>
                                    {u.lastSeen ? new Date(u.lastSeen).toLocaleDateString() + ' ' + new Date(u.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                </Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </ScrollView>

            {/* Modals (Simplified UI, logic retained) */}
            <Modal animationType="slide" transparent visible={meetModalVisible} onRequestClose={() => setMeetModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setMeetModalVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.bottomSheet, { backgroundColor: theme.surface }]}>
                        <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>Manage Meetings</Text>
                        <View style={styles.tabRow}>
                            <TouchableOpacity onPress={() => setMeetTab('instant')} style={[styles.tab, meetTab === 'instant' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}>
                                <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Instant</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setMeetTab('schedule')} style={[styles.tab, meetTab === 'schedule' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}>
                                <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>Schedule</Text>
                            </TouchableOpacity>
                        </View>

                        {meetTab === 'instant' ? (
                            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.secondary }]} onPress={createInstantMeet}>
                                <Ionicons name="flash" size={20} color="white" style={{ marginRight: 10 }} />
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Start Now</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={{ gap: 10, marginTop: 10 }}>
                                <TextInput
                                    placeholder="Meeting Title"
                                    placeholderTextColor={theme.textLight}
                                    style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
                                    onChangeText={setMeetTitle}
                                />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <TouchableOpacity
                                        onPress={() => { setMode('date'); setShowPicker(true); }}
                                        style={[styles.input, { flex: 1, marginRight: 5, justifyContent: 'center', borderColor: theme.border }]}
                                    >
                                        <Text style={{ color: theme.textPrimary }}>{meetDate.toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => { setMode('time'); setShowPicker(true); }}
                                        style={[styles.input, { flex: 1, marginLeft: 5, justifyContent: 'center', borderColor: theme.border }]}
                                    >
                                        <Text style={{ color: theme.textPrimary }}>{meetDate.toLocaleTimeString()}</Text>
                                    </TouchableOpacity>
                                </View>
                                {showPicker && (
                                    <DateTimePicker
                                        value={meetDate}
                                        mode={mode}
                                        is24Hour={true}
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            const currentDate = selectedDate || meetDate;
                                            setShowPicker(Platform.OS === 'ios');
                                            setMeetDate(currentDate);
                                        }}
                                    />
                                )}
                                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.primary }]} onPress={scheduleMeet}>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Schedule</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </TouchableOpacity>
            </Modal>

            <Modal animationType="slide" transparent visible={companyModalVisible} onRequestClose={() => setCompanyModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setCompanyModalVisible(false)}>
                    <KeyboardAvoidingView behavior='padding' style={[styles.bottomSheet, { backgroundColor: theme.surface }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>{generatedId ? 'ID Created' : 'Create Company ID'}</Text>
                            <TouchableOpacity onPress={() => setShowHistory(!showHistory)}><Ionicons name="time" size={24} color={theme.textSecondary} /></TouchableOpacity>
                        </View>

                        {showHistory ? (
                            <FlatList data={companyHistory} renderItem={({ item }) => (
                                <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                    <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>{item.companyName}</Text>
                                    <Text style={{ color: theme.textSecondary }}>{item.companyId}</Text>
                                </View>
                            )} />
                        ) : !generatedId ? (
                            <View style={{ gap: 10 }}>
                                <TextInput placeholder="Company Name" placeholderTextColor={theme.textLight} style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]} onChangeText={setCompanyName} />
                                <TextInput placeholder="Contact (Optional)" placeholderTextColor={theme.textLight} style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]} onChangeText={setContactNumber} />
                                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.primary }]} onPress={handleCreateCompanyId}>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Generate ID</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center', gap: 10 }}>
                                <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.primary, letterSpacing: 2 }}>{generatedId}</Text>
                                <TouchableOpacity onPress={() => { Clipboard.setStringAsync(generatedId); Alert.alert("Copied"); }}>
                                    <Text style={{ color: theme.secondary }}>Tap to Copy</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </TouchableOpacity>
            </Modal>

            <Modal transparent visible={successModalVisible} onRequestClose={() => setSuccessModalVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setSuccessModalVisible(false)}>
                    <View style={{ backgroundColor: theme.surface, padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center', width: '100%', height: '50%', justifyContent: 'center' }}>
                        <Ionicons name="checkmark-circle" size={80} color="#4CD964" />
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.textPrimary, marginVertical: 10 }}>Success!</Text>

                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginVertical: 15 }}
                            onPress={() => { Clipboard.setStringAsync(createdCode); Alert.alert("Copied to clipboard"); }}
                        >
                            <Text style={{ fontSize: 32, fontWeight: 'bold', color: theme.textPrimary, marginRight: 15, letterSpacing: 2 }}>{createdCode}</Text>
                            <Ionicons name="copy-outline" size={24} color={theme.primary} />
                        </TouchableOpacity>

                        <Text style={{ color: theme.textSecondary, marginBottom: 20 }}>Share this code with others to join.</Text>

                        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.primary, width: '100%' }]} onPress={() => { setSuccessModalVisible(false); router.push(`/meet/${createdCode}`); }}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Join Now</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function getStyles(theme) {
    return StyleSheet.create({
        container: { flex: 1 },
        header: { paddingHorizontal: 20, paddingBottom: 10 },
        headerTitle: { fontSize: 16, fontWeight: '600', textTransform: 'uppercase', marginBottom: 5, opacity: 0.6 },
        sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
        grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
        card: { width: (width - 50) / 2, padding: 15, borderRadius: 20, marginBottom: 15, alignItems: 'center', justifyContent: 'center', height: 130 },
        iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
        cardLabel: { fontWeight: '600', fontSize: 14 },
        row: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 10 },
        avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        rowTitle: { fontWeight: 'bold', fontSize: 16 },
        badge: { backgroundColor: '#4CD964', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 10 },

        // Modals
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        bottomSheet: { padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
        sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
        mainBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 10 },
        input: { borderWidth: 1, padding: 15, borderRadius: 12, fontSize: 16 },
        tabRow: { flexDirection: 'row', marginBottom: 20 },
        tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },

        // Table Styles
        tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 5 },
        tableHeader: { fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
        avatarSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }
    });
}
