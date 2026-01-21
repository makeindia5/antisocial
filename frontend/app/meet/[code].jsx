import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

// Adjust this to your local IP
const BACKEND_URL = "http://192.168.29.129:5000";

export default function MeetScreen() {
    const router = useRouter();
    const { code } = useLocalSearchParams();

    return (
        <View style={{ flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', top: 40, left: 20, zIndex: 100, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <WebView
                source={{ uri: `${BACKEND_URL}/meet.html?room=${code}` }}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                originWhitelist={['*']}
                onPermissionRequest={(req) => {
                    req.grant(req.resources);
                }}
                onMessage={(event) => {
                    if (event.nativeEvent.data === 'END_CALL') {
                        router.back();
                    }
                }}
            />
        </View>
    );
}
