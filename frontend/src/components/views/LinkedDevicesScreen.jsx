import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Modal, Image, ActivityIndicator } from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { API_BASE } from '../../services/apiService';
import { useTheme } from '../../context/ThemeContext';
import { Colors } from '../../styles/theme';

export default function LinkedDevicesScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const theme = colors || Colors;
    const styles = getStyles(theme);

    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [loading, setLoading] = useState(false);

    // Socket
    const [socket, setSocket] = useState(null);

    const [devices, setDevices] = useState([]);

    useEffect(() => {
        // Connect to socket (Strip /api/auth from API_BASE)
        const socketUrl = API_BASE.replace('/api/auth', '');
        console.log("Mobile Socket connecting to:", socketUrl);
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        fetchDevices();

        return () => newSocket.disconnect();
    }, []);

    const fetchDevices = async () => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (!userId) return;
            const res = await fetch(`${API_BASE}/devices/${userId}`);
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if (Array.isArray(data)) setDevices(data);
                else console.log("Devices fetch unexpected data:", data);
            } catch (e) {
                console.error("Devices JSON Parse Error. Response:", text.substring(0, 100)); // Log first 100 chars
            }
        } catch (e) {
            console.error("Fetch Devices Network Error:", e);
        }
    };

    const confirmLogout = (device) => {
        Alert.alert("Log Out Device", `Are you sure you want to log out ${device.name}?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Log Out", style: "destructive", onPress: () => logoutDevice(device.deviceId) }
        ]);
    };

    const logoutDevice = async (deviceId) => {
        try {
            const userId = await AsyncStorage.getItem('userId');
            await fetch(`${API_BASE}/devices/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, deviceId })
            });
            fetchDevices();
        } catch (e) {
            Alert.alert("Error", "Failed to remove device");
        }
    };

    const handleBarCodeScanned = async ({ type, data }) => {
        setScanned(true);
        console.log(`Bar code with type ${type} and data ${data} has been scanned!`);

        // Expecting data to be the qrCodeId (UUID)
        if (data && socket) {
            setLoading(true);
            try {
                // Ensure we get the token (check 'token' first, fallbacks if needed)
                const token = await AsyncStorage.getItem('token');
                // We now save 'userData' in login, but if it's missing, construct minimal user
                let user;
                const userData = await AsyncStorage.getItem('userData');
                if (userData) {
                    user = JSON.parse(userData);
                } else {
                    // Fallback: Construct from individual keys
                    const userId = await AsyncStorage.getItem('userId');
                    if (userId) user = { _id: userId };
                }

                if (!token || !user) {
                    Alert.alert("Error", "Authentication missing. Please Log Out and Log In again.");
                    setLoading(false);
                    return;
                }

                // Emit to backend
                socket.emit('mobile:scan_qr', {
                    qrCodeId: data,
                    token: token,
                    userId: user._id
                });

                setLoading(false);
                setShowScanner(false);
                // Alert.alert("Success", "Device linked successfully!"); // Removed as requested
                fetchDevices(); // Refresh list
            } catch (error) {
                console.error(error);
                setLoading(false);
                Alert.alert("Error", "Failed to link device");
            }
        }
    };

    if (!permission) {
        // Camera permissions are still loading.
        return <View />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', color: theme.textPrimary, margin: 20 }}>We need your permission to show the camera</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.btn}>
                    <Text style={styles.btnText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Linked Devices</Text>
            </View>

            {/* Info Section */}
            <View style={styles.content}>
                <View style={styles.illustration}>
                    <Ionicons name="desktop-outline" size={100} color={theme.textLight} />
                    <Text style={[styles.infoText, { marginTop: 20 }]}>Use Intraa on other devices</Text>
                </View>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={async () => {
                        const token = await AsyncStorage.getItem('token');
                        if (!token) {
                            Alert.alert("Authentication Required", "Please Log Out and Log In again to refresh your session.");
                            return;
                        }
                        setScanned(false);
                        setShowScanner(true);
                    }}
                >
                    <Text style={styles.linkButtonText}>Link a Device</Text>
                </TouchableOpacity>

                <View style={[styles.deviceList, { flex: 1 }]}>
                    <Text style={{ color: theme.textSecondary, marginBottom: 10, fontWeight: 'bold' }}>DEVICE STATUS</Text>
                    {devices.length === 0 ? (
                        <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>No devices linked. Tap below to link one.</Text>
                    ) : (
                        <FlatList
                            data={devices}
                            keyExtractor={(item) => item.deviceId}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.deviceItem} onPress={() => confirmLogout(item)}>
                                    <View style={styles.deviceIcon}>
                                        <Ionicons name="laptop-outline" size={24} color={theme.textPrimary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.deviceName}>{item.name}</Text>
                                        <Text style={styles.deviceInfo}>Active: {new Date(item.lastActive).toLocaleDateString()}</Text>
                                    </View>
                                    <View>
                                        <Text style={{ color: 'red', fontSize: 12 }}>Log Out</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>

            {/* Scanner Modal */}
            <Modal visible={showScanner} animationType="slide">
                <View style={styles.scannerContainer}>
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr"],
                        }}
                    >
                        <View style={styles.layerTop}>
                            <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={30} color="white" />
                            </TouchableOpacity>
                            <Text style={styles.scanText}>Scan QR code to log in</Text>
                        </View>
                        <View style={styles.layerCenter}>
                            <View style={styles.layerLeft} />
                            <View style={styles.focused} />
                            <View style={styles.layerRight} />
                        </View>
                        <View style={styles.layerBottom}>
                            {loading && <ActivityIndicator size="large" color="white" />}
                        </View>
                    </CameraView>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.surface
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.textPrimary,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 50,
    },
    illustration: {
        alignItems: 'center',
        marginBottom: 40,
    },
    infoText: {
        fontSize: 18,
        color: theme.textPrimary,
        fontWeight: '500',
    },
    linkButton: {
        backgroundColor: theme.secondary,
        paddingVertical: 15,
        paddingHorizontal: 60,
        borderRadius: 30,
        marginBottom: 40,
    },
    linkButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    deviceList: {
        width: '100%',
        paddingHorizontal: 20,
    },
    btn: {
        padding: 15,
        backgroundColor: theme.secondary,
        borderRadius: 10,
    },
    btnText: { color: 'white' },

    // Scanner Styles
    scannerContainer: { flex: 1, backgroundColor: 'black' },
    layerTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 50 },
    layerCenter: { flexDirection: 'row', height: 260 },
    layerLeft: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    focused: { width: 260, height: 260, borderWidth: 2, borderColor: theme.secondary, backgroundColor: 'transparent' },
    layerRight: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    layerBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    closeBtn: { position: 'absolute', top: 40, left: 20 },
    scanText: { color: 'white', marginTop: 20, fontSize: 16 },

    // Device Item
    deviceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#ccc'
    },
    deviceIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e9edef',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    deviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#41525d'
    },
    deviceInfo: {
        fontSize: 12,
        color: '#8696a0',
        marginTop: 2
    }
});
