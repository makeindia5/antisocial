import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { startSignup } from "../src/controllers/authController";
import { Colors } from "../src/styles/theme";
import { useTheme } from '../src/context/ThemeContext';

const { width } = Dimensions.get('window');

export default function RegisterScreen() {
    const { colors: theme } = useTheme();

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const [validations, setValidations] = useState({
        hasUpper: false,
        hasLower: false,
        hasNumber: false,
        hasSpecial: false
    });

    const checkValidation = (text) => {
        setUsername(text);
        setValidations({
            hasUpper: /[A-Z]/.test(text),
            hasLower: /[a-z]/.test(text),
            hasNumber: /[0-9]/.test(text),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(text)
        });
    };

    const isFormValid = Object.values(validations).every(Boolean) && email && password;

    const handleSignup = async () => {
        if (!Object.values(validations).every(Boolean)) {
            alert("Please ensure username meets all requirements.");
            return;
        }
        setLoading(true);
        try {
            await startSignup(email);
            router.push({
                pathname: "/(auth)/otp",
                params: { email, username, password, phoneNumber }
            });
        } catch (err) {
            alert(err.message || "Signup failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={{ paddingHorizontal: 25, paddingTop: 10, flex: 1 }}>
                    {/* Header Row */}
                    <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.surface }]}>
                        <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                            {/* Title Section */}
                            <View style={{ marginTop: 30, marginBottom: 40 }}>
                                <Text style={[styles.title, { color: theme.textPrimary }]}>Create account</Text>
                                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Join our community today.</Text>
                            </View>

                            {/* Form */}
                            <View style={styles.form}>

                                {/* Username */}
                                <View>
                                    <Text style={[styles.label, { color: theme.textPrimary }]}>Username</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                        <Ionicons name="person-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
                                        <TextInput
                                            placeholder="Ex: Neo_99"
                                            placeholderTextColor={theme.textLight}
                                            style={[styles.input, { color: theme.textPrimary }]}
                                            onChangeText={checkValidation}
                                            value={username}
                                            autoCapitalize="none"
                                        />
                                        {Object.values(validations).every(Boolean) && username.length > 0 &&
                                            <Ionicons name="checkmark-circle" size={20} color={'#4CD964'} />
                                        }
                                    </View>

                                    {/* Validation Chips */}
                                    <View style={styles.chipContainer}>
                                        <Chip label="a-z" isValid={validations.hasLower} theme={theme} />
                                        <Chip label="A-Z" isValid={validations.hasUpper} theme={theme} />
                                        <Chip label="0-9" isValid={validations.hasNumber} theme={theme} />
                                        <Chip label="#!?" isValid={validations.hasSpecial} theme={theme} />
                                    </View>
                                </View>

                                {/* Email */}
                                <View>
                                    <Text style={[styles.label, { color: theme.textPrimary }]}>Email</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                        <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
                                        <TextInput
                                            placeholder="name@example.com"
                                            placeholderTextColor={theme.textLight}
                                            style={[styles.input, { color: theme.textPrimary }]}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            value={email}
                                        />
                                    </View>
                                </View>

                                {/* Password */}
                                <View>
                                    <Text style={[styles.label, { color: theme.textPrimary }]}>Password</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                        <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
                                        <TextInput
                                            placeholder="Strong password"
                                            placeholderTextColor={theme.textLight}
                                            style={[styles.input, { color: theme.textPrimary }]}
                                            secureTextEntry
                                            onChangeText={setPassword}
                                            value={password}
                                        />
                                    </View>
                                </View>

                                {/* Phone Number (Optional) */}
                                <View>
                                    <Text style={[styles.label, { color: theme.textPrimary }]}>Phone (Optional)</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                        <Ionicons name="call-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
                                        <TextInput
                                            placeholder="Mobile Number"
                                            placeholderTextColor={theme.textLight}
                                            style={[styles.input, { color: theme.textPrimary }]}
                                            onChangeText={setPhoneNumber}
                                            keyboardType="phone-pad"
                                            value={phoneNumber}
                                        />
                                    </View>
                                </View>

                                {/* Button */}
                                <TouchableOpacity
                                    style={[styles.mainBtn, { backgroundColor: theme.primary, opacity: isFormValid ? 1 : 0.6 }]}
                                    onPress={handleSignup}
                                    disabled={loading || !isFormValid}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text style={styles.btnText}>Sign Up</Text>
                                            <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 10 }} />
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Footer */}
                                <View style={styles.footer}>
                                    <Text style={{ color: theme.textSecondary }}>Already have an account? </Text>
                                    <TouchableOpacity onPress={() => router.back()}>
                                        <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>Sign In</Text>
                                    </TouchableOpacity>
                                </View>

                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </SafeAreaView>
        </View>
    );
}

function Chip({ label, isValid, theme }) {
    return (
        <View style={[
            styles.chip,
            {
                backgroundColor: isValid ? '#4CD964' : theme.surface,
                borderColor: isValid ? 'transparent' : theme.border
            }
        ]}>
            <Text style={[styles.chipText, { color: isValid ? 'white' : theme.textSecondary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    backBtn: {
        width: 44, height: 44,
        borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -1,
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500'
    },
    form: {
        gap: 20
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        opacity: 0.7
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: Platform.OS === 'ios' ? 16 : 4,
        borderRadius: 18,
        borderWidth: 1,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        fontWeight: '600'
    },
    chipContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
        marginLeft: 4
    },
    chip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '700'
    },
    mainBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 18,
        borderRadius: 20,
        marginTop: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 8
    },
    btnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 20
    }
});
