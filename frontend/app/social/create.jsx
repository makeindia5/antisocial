import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../src/services/apiService';
import { useTheme } from '../../src/context/ThemeContext';

export default function CreateSocialScreen() {
    const router = useRouter();
    const { colors: theme } = useTheme();
    const [media, setMedia] = useState(null);
    const [caption, setCaption] = useState('');
    const [type, setType] = useState('image'); // image, video
    const [uploadType, setUploadType] = useState('post'); // post, story, reel
    const [loading, setLoading] = useState(false);

    const pickMedia = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setMedia(result.assets[0].uri);
            setType(result.assets[0].type === 'video' ? 'video' : 'image');
        }
    };

    const handleShare = async () => {
        if (!media) return Alert.alert("Error", "Please select media first");

        setLoading(true);
        try {
            const userId = await AsyncStorage.getItem('userId');

            // 1. Upload File
            const formData = new FormData();
            formData.append('file', {
                uri: media,
                name: type === 'video' ? 'video.mp4' : 'image.jpg',
                type: type === 'video' ? 'video/mp4' : 'image/jpeg',
            });

            const uploadRes = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

            const mediaUrl = uploadData.url;

            // 2. Create Post/Story/Reel
            let endpoint = '/posts/create';
            if (uploadType === 'story') endpoint = '/status/create';
            if (uploadType === 'reel') endpoint = '/reels/create';

            const payload = {
                userId,
                mediaUrl,
                type,
                caption,
                content: mediaUrl, // For status (story)
            };

            const createRes = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
            });

            if (createRes.ok) {
                Alert.alert("Success", "Shared successfully!");
                router.back();
            } else {
                const errData = await createRes.json();
                throw new Error(errData.error || "Sharing failed");
            }

        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={30} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.textPrimary }]}>New {uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}</Text>
                <TouchableOpacity onPress={handleShare} disabled={loading}>
                    {loading ? <ActivityIndicator size="small" color={theme.primary} /> :
                        <Text style={[styles.shareText, { color: theme.primary }]}>Share</Text>}
                </TouchableOpacity>
            </View>

            <View style={styles.mediaContainer}>
                {media ? (
                    <TouchableOpacity onPress={pickMedia}>
                        <Image source={{ uri: media }} style={styles.preview} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.placeholder, { backgroundColor: theme.surface }]} onPress={pickMedia}>
                        <Ionicons name="camera-outline" size={50} color={theme.textSecondary} />
                        <Text style={{ color: theme.textSecondary, marginTop: 10 }}>Select Photo or Video</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.uploadTypeSelector}>
                {['post', 'story', 'reel'].map((item) => (
                    <TouchableOpacity
                        key={item}
                        onPress={() => setUploadType(item)}
                        style={[
                            styles.typeBtn,
                            { backgroundColor: uploadType === item ? theme.primary : theme.surface }
                        ]}
                    >
                        <Text style={{ color: uploadType === item ? 'white' : theme.textPrimary, fontWeight: 'bold' }}>
                            {item.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TextInput
                style={[styles.input, { color: theme.textPrimary, borderBottomColor: theme.border }]}
                placeholder="Write a caption..."
                placeholderTextColor={theme.textSecondary}
                multiline
                value={caption}
                onChangeText={setCaption}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        marginTop: 40,
    },
    title: { fontSize: 18, fontWeight: 'bold' },
    shareText: { fontSize: 18, fontWeight: 'bold' },
    mediaContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#f0f0f0',
    },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadTypeSelector: {
        flexDirection: 'row',
        padding: 20,
        justifyContent: 'space-around',
    },
    typeBtn: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    input: {
        padding: 15,
        fontSize: 16,
        borderBottomWidth: 0.5,
        minHeight: 100,
        textAlignVertical: 'top',
    }
});
