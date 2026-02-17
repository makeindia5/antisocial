import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import QRCode from 'react-qr-code';
import { useRouter } from 'expo-router';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../services/apiService';

// Ensure this only runs on web or doesn't break native
if (Platform.OS !== 'web') {
    // You might want a fallback or redirect for native
}

export default function WebLoginScreen() {
    const router = useRouter();
    const [qrCodeId, setQrCodeId] = useState(null);
    const [status, setStatus] = useState('Connecting to server...');
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        // Connect to socket (Strip /api/auth from API_BASE)
        const socketUrl = API_BASE.replace('/api/auth', '');
        console.log("Connecting to socket at:", socketUrl);
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Web Client Connected');
            setStatus('Generating QR Code...');
            newSocket.emit('web:request_qr');
        });

        newSocket.on('web:qr_generated', (id) => {
            console.log('QR Received:', id);
            setQrCodeId(id);
            setStatus('Scan this code with your mobile app');
        });

        newSocket.on('web:auth_success', async ({ token, userId }) => {
            console.log('Auth Success!', userId);
            setStatus('Login Successful! Redirecting...');

            await AsyncStorage.setItem('userToken', token);
            await AsyncStorage.setItem('userId', userId);
            // Fetch and set user data if needed, or rely on token

            setTimeout(() => {
                router.replace('/(tabs)/communityScreen'); // Or wherever your main app is
            }, 1000);
        });

        return () => newSocket.disconnect();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Intraa Web</Text>
                <Text style={styles.subtitle}>Use Intraa on your computer</Text>

                <View style={styles.qrContainer}>
                    {qrCodeId ? (
                        <QRCode value={qrCodeId} size={250} />
                    ) : (
                        <View style={styles.loadingBox}>
                            <Text>{status}</Text>
                        </View>
                    )}
                </View>

                <Text style={styles.instructions}>
                    1. Open Intraa on your phone{'\n'}
                    2. Go to Menu {'>'} Linked Devices{'\n'}
                    3. Tap "Link a Device" and scan this code
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dcdcdc',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh', // Web specific
    },
    card: {
        backgroundColor: 'white',
        padding: 50,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        maxWidth: 800,
        width: '90%',
        flexDirection: 'column'
    },
    title: {
        fontSize: 28,
        fontWeight: '300',
        marginBottom: 10,
        color: '#41525d'
    },
    subtitle: {
        fontSize: 18,
        color: '#8696a0',
        marginBottom: 40
    },
    qrContainer: {
        marginBottom: 40,
        padding: 10,
        backgroundColor: 'white',
    },
    loadingBox: {
        width: 250,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f2f5'
    },
    instructions: {
        fontSize: 16,
        lineHeight: 28,
        color: '#3b4a54',
        textAlign: 'center'
    }
});
