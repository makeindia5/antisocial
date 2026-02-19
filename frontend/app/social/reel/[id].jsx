import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// import ReelsView from '../../../src/components/social/ReelsView';
import ReelsView from '../../../src/components/social/ReelsView';
import { API_BASE } from '../../../src/services/apiService';
import { useTheme } from '../../../src/styles/theme';

const { height } = Dimensions.get('window');

const ReelScreen = () => {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { theme } = useTheme();
    const [reel, setReel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (id) fetchReel();
    }, [id]);

    const fetchReel = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/reels/details/${id}`);
            if (!res.ok) throw new Error("Reel not found");
            const data = await res.json();
            // Wrap in array for ReelsView
            setReel([data]);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="white" />
        </View>
    );

    if (error) return (
        <View style={styles.center}>
            <Text style={{ color: 'white', marginBottom: 20 }}>{error}</Text>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/communityScreen')} style={styles.btn}>
                <Text style={{ color: 'black' }}>Go Home</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <StatusBar barStyle="light-content" backgroundColor="black" />

            {/* Back Button Overlay */}
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.canGoBack() ? router.back() : router.replace('/social')}
            >
                <Ionicons name="chevron-back" size={30} color="white" />
            </TouchableOpacity>

            <ReelsView
                theme={theme}
                reels={reel}
                onRefresh={fetchReel}
                refreshing={loading}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center'
    },
    btn: {
        backgroundColor: 'white',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 100,
        shadowColor: 'black',
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 5
    }
});

export default ReelScreen;
