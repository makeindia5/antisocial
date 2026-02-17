import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const SERVER_URL = "http://192.168.29.129:5000";

export default function ProfileScreen() {
    const router = useRouter();
    const { colors: theme } = useTheme();
    const [user, setUser] = useState({ name: '', about: '', phone: '', profilePic: null });
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [editingAbout, setEditingAbout] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAbout, setNewAbout] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/user/${userId}`);
            const data = await res.json();
            if (res.ok) {
                setUser({
                    name: data.name,
                    about: data.about || 'Available',
                    phone: data.phoneNumber || '+91 98765 43210',
                    profilePic: data.profilePic
                });
                setNewName(data.name);
                setNewAbout(data.about || 'Available');
            }
        } catch (e) {
            console.error("Failed to load profile", e);
        } finally {
            setLoading(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                uploadImage(result.assets[0].uri);
            }
        } catch (e) {
            Alert.alert("Error", "Could not pick image");
        }
    };

    const uploadImage = async (uri) => {
        const formData = new FormData();
        formData.append('image', {
            uri,
            name: 'profile_pic.jpg',
            type: 'image/jpeg'
        });
        const userId = await AsyncStorage.getItem('userId');
        formData.append('userId', userId);

        try {
            setLoading(true);
            const res = await fetch(`${SERVER_URL}/api/auth/upload-avatar`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            const data = await res.json();
            if (res.ok) {
                setUser(prev => ({ ...prev, profilePic: data.profilePic }));
                await AsyncStorage.setItem('profilePic', data.profilePic);
                Alert.alert("Success", "Profile picture updated");
            } else {
                Alert.alert("Error", data.error || "Failed to upload");
            }
        } catch (e) {
            console.error("Upload failed", e);
            Alert.alert("Error", "Upload failed");
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            const res = await fetch(`${SERVER_URL}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, name: newName, about: newAbout })
            });
            if (res.ok) {
                setUser(prev => ({ ...prev, name: newName, about: newAbout }));
                setEditingName(false);
                setEditingAbout(false);
                await AsyncStorage.setItem('userName', newName); // Update local cache
                Alert.alert("Success", "Profile updated");
            } else {
                Alert.alert("Error", "Failed to update profile");
            }
        } catch (e) {
            Alert.alert("Error", "Connection failed");
        }
    };

    if (loading) {
        return <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Profile</Text>
                <View style={{ width: 34 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
                {/* Profile Pic */}
                <TouchableOpacity onPress={handlePickImage} style={{ marginBottom: 30, position: 'relative' }}>
                    <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                        {user.profilePic ? (
                            <Image source={{ uri: `${SERVER_URL}${user.profilePic}` }} style={{ width: 140, height: 140 }} />
                        ) : (
                            <Ionicons name="person" size={80} color="white" />
                        )}
                    </View>
                    <View style={{ position: 'absolute', bottom: 5, right: 5, backgroundColor: theme.primary, padding: 10, borderRadius: 20 }}>
                        <Ionicons name="camera" size={20} color="white" />
                    </View>
                </TouchableOpacity>

                {/* Name Section */}
                <View style={[styles.infoContainer, { borderBottomColor: theme.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                        <Ionicons name="person" size={20} color={theme.textSecondary} style={{ marginRight: 15 }} />
                        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Name</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 35 }}>
                        {editingName ? (
                            <TextInput
                                style={{ flex: 1, fontSize: 16, color: theme.textPrimary, borderBottomWidth: 1, borderBottomColor: theme.primary, paddingVertical: 5 }}
                                value={newName}
                                onChangeText={setNewName}
                                autoFocus
                            />
                        ) : (
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>{user.name}</Text>
                        )}
                        <TouchableOpacity onPress={() => {
                            if (editingName) saveProfile();
                            else setEditingName(true);
                        }}>
                            <Ionicons name={editingName ? "checkmark" : "pencil"} size={24} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                    <Text style={{ paddingLeft: 35, fontSize: 12, color: theme.textSecondary, marginTop: 5 }}>
                        This is not your username or pin. This name will be visible to your contacts.
                    </Text>
                </View>

                {/* About Section */}
                <View style={[styles.infoContainer, { borderBottomColor: theme.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                        <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} style={{ marginRight: 15 }} />
                        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>About</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 35 }}>
                        {editingAbout ? (
                            <TextInput
                                style={{ flex: 1, fontSize: 16, color: theme.textPrimary, borderBottomWidth: 1, borderBottomColor: theme.primary, paddingVertical: 5 }}
                                value={newAbout}
                                onChangeText={setNewAbout}
                                autoFocus
                            />
                        ) : (
                            <Text style={{ fontSize: 16, color: theme.textPrimary }}>{user.about}</Text>
                        )}
                        <TouchableOpacity onPress={() => {
                            if (editingAbout) saveProfile();
                            else setEditingAbout(true);
                        }}>
                            <Ionicons name={editingAbout ? "checkmark" : "pencil"} size={24} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Phone Section */}
                <View style={[styles.infoContainer, { borderBottomColor: theme.border, borderBottomWidth: 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                        <Ionicons name="call" size={20} color={theme.textSecondary} style={{ marginRight: 15 }} />
                        <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Phone</Text>
                    </View>
                    <View style={{ paddingLeft: 35 }}>
                        <Text style={{ fontSize: 16, color: theme.textPrimary }}>{user.phone}</Text>
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        elevation: 2
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold'
    },
    infoContainer: {
        width: '100%',
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        marginBottom: 10
    }
});
