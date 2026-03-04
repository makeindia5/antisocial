import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, SafeAreaView, Dimensions, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE } from '../../../services/apiService';

const SERVER_ROOT = API_BASE.replace('/api/auth', '');
const { width, height } = Dimensions.get('window');

export default function EditProfileModal({ visible, onClose, userProfile, onProfileUpdate, theme, currentUserId }) {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [pronouns, setPronouns] = useState('');
    const [bio, setBio] = useState('');
    const [gender, setGender] = useState('Male');
    const [website, setWebsite] = useState('');

    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    useEffect(() => {
        if (visible && userProfile) {
            setName(userProfile.name || '');
            setUsername(userProfile.username || '');
            setPronouns(userProfile.pronouns || '');
            setBio(userProfile.bio || userProfile.about || '');
            setGender(userProfile.gender || 'Male');
            setWebsite(userProfile.website || '');
        }
    }, [visible, userProfile]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const body = {
                userId: currentUserId,
                name: name.trim(),
                username: username.trim(),
                pronouns: pronouns.trim(),
                bio: bio.trim(),
                gender,
                website: website.trim()
            };

            const res = await fetch(`${API_BASE}/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                if (onProfileUpdate) onProfileUpdate(data.user);
                onClose();
            } else {
                Alert.alert("Error", data.error || "Failed to update profile");
            }
        } catch (e) {
            Alert.alert("Error", "Network error updating profile");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                uploadAvatar(result.assets[0]);
            }
        } catch (e) {
            console.log(e);
        }
    };

    const uploadAvatar = async (asset) => {
        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: asset.uri,
                name: asset.fileName || 'profile.jpg',
                type: 'image/jpeg'
            });
            formData.append('userId', currentUserId);

            const res = await fetch(`${API_BASE}/user/avatar`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const data = await res.json();
            if (res.ok) {
                // Update local state temporarily so user sees it right away
                if (onProfileUpdate) onProfileUpdate({ ...userProfile, profilePic: data.profilePic });
                Alert.alert("Success", "Profile picture updated!");
            } else {
                Alert.alert("Failed", data.error || "Upload failed");
            }
        } catch (e) {
            Alert.alert("Error", "Network error uploading image");
        } finally {
            setUploadingAvatar(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.headerAction}>
                        <Ionicons name="arrow-back" size={28} color={theme.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Edit profile</Text>
                    <TouchableOpacity onPress={handleSave} style={styles.headerAction} disabled={loading}>
                        {loading ? <ActivityIndicator size="small" color="#0095f6" /> : <Ionicons name="checkmark" size={30} color="#0095f6" />}
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 15 }}>
                    {/* Avatars */}
                    <View style={styles.avatarSection}>
                        <View style={styles.avatarContainer}>
                            {userProfile?.profilePic ? (
                                <Image source={{ uri: `${SERVER_ROOT}${userProfile.profilePic}` }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="person" size={40} color="#aaa" />
                                </View>
                            )}
                        </View>
                        <View style={styles.avatarContainer}>
                            <View style={[styles.avatar, { backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="person-outline" size={30} color="#333" />
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity onPress={pickImage} style={{ alignItems: 'center', marginTop: 10, marginBottom: 20 }}>
                        {uploadingAvatar ? (
                            <ActivityIndicator size="small" color="#0095f6" />
                        ) : (
                            <Text style={{ color: '#0095f6', fontWeight: '500', fontSize: 16 }}>Edit picture or avatar</Text>
                        )}
                    </TouchableOpacity>

                    {/* Form Fields */}
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
                        <TextInput
                            style={[styles.input, { color: theme.textPrimary }]}
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor={theme.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
                        <TextInput
                            style={[styles.input, { color: theme.textPrimary }]}
                            value={username}
                            onChangeText={setUsername}
                            placeholderTextColor={theme.textSecondary}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Pronouns</Text>
                        <TextInput
                            style={[styles.input, { color: theme.textPrimary }]}
                            value={pronouns}
                            onChangeText={setPronouns}
                            placeholderTextColor={theme.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Bio</Text>
                        <TextInput
                            style={[styles.input, { color: theme.textPrimary, minHeight: 60 }]}
                            value={bio}
                            onChangeText={setBio}
                            multiline
                            placeholderTextColor={theme.textSecondary}
                        />
                    </View>


                </ScrollView>
            </SafeAreaView>
        </Modal >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        height: 60,
        borderBottomWidth: 0.5,
        borderBottomColor: '#333'
    },
    headerAction: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold'
    },
    avatarSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    avatarContainer: {
        marginHorizontal: -5,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: '#000',
    },
    inputGroup: {
        marginBottom: 15,
        borderWidth: 0.5,
        borderColor: '#333',
        borderRadius: 12,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.03)'
    },
    label: {
        fontSize: 12,
        marginBottom: 4,
    },
    input: {
        fontSize: 16,
        padding: 0,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#333'
    },
    actionText: {
        fontSize: 16,
    }
});
