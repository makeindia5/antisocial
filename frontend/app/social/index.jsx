import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, GlobalStyles } from '../../src/styles/theme';

export default function SocialScreen() {
    const router = useRouter();

    return (
        <View style={GlobalStyles.containerCenter}>
            <View style={styles.iconCircle}>
                <Ionicons name="share-social" size={60} color={Colors.secondary} />
            </View>
            <Text style={styles.text}>Social Media</Text>
            <Text style={styles.subText}>Connect with your network shortly.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 10,
        shadowColor: Colors.shadow,
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    text: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary, textAlign: 'center' },
    subText: { fontSize: 16, color: Colors.textSecondary, marginTop: 10 }
});
