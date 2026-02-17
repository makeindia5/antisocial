import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { API_BASE } from '../../../services/apiService';

const CreatePostModal = ({ visible, onClose, media, type, userId, onSuccess }) => {
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);

    const handlePost = async () => {
        if (!media || !media.uri) return;

        setUploading(true);
        try {
            // 1. Upload Media
            const formData = new FormData();
            const filename = media.fileName || media.uri.split('/').pop();
            const mimeType = type === 'video' ? 'video/mp4' : 'image/jpeg';

            formData.append('file', {
                uri: media.uri,
                name: filename,
                type: mimeType
            });

            const uploadRes = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const uploadData = await uploadRes.json();

            if (!uploadRes.ok) {
                throw new Error(uploadData.error || "Upload failed");
            }

            // 2. Create Post
            const postPayload = {
                userId,
                mediaUrl: uploadData.url,
                type: type,
                caption: caption
            };

            const postRes = await fetch(`${API_BASE}/posts/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postPayload)
            });

            const postData = await postRes.json();

            if (postRes.ok) {
                Alert.alert("Success", "Post created!");
                onSuccess();
                onClose();
                setCaption('');
            } else {
                throw new Error(postData.error || "Failed to create post");
            }

        } catch (e) {
            Alert.alert("Error", e.message);
        } finally {
            setUploading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={30} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Post</Text>
                    <TouchableOpacity onPress={handlePost} disabled={uploading}>
                        {uploading ? <ActivityIndicator color="#007AFF" /> : <Text style={styles.postBtn}>Share</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.mediaContainer}>
                        {type === 'video' ? (
                            <Video
                                source={{ uri: media.uri }}
                                style={styles.media}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping
                            />
                        ) : (
                            <Image source={{ uri: media.uri }} style={styles.media} resizeMode="contain" />
                        )}
                    </View>

                    <TextInput
                        style={styles.captionInput}
                        placeholder="Write a caption..."
                        placeholderTextColor="#aaa"
                        multiline
                        value={caption}
                        onChangeText={setCaption}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: '#333',
    },
    headerTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    postBtn: {
        color: '#007AFF',
        fontWeight: 'bold',
        fontSize: 18,
    },
    content: {
        padding: 20,
    },
    mediaContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#1c1c1e',
        marginBottom: 20,
        borderRadius: 10,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    captionInput: {
        color: 'white',
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },
});

export default CreatePostModal;
