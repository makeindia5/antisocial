import React, { useState, useEffect } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { loginUser } from "../../src/controllers/authController";
import { Colors, GlobalStyles } from "../../src/styles/theme";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/context/ThemeContext";

export default function LoginScreen() {
  const { colors } = useTheme();
  const theme = colors || Colors;
  const styles = getStyles(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState('user'); // 'user' or 'admin'
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const hasCreds = await AsyncStorage.getItem('biometric_email');
      setIsBiometricSupported(compatible && enrolled && hasCreds);
    })();
  }, []);

  const redirectUser = (user) => {
    if (user.role === 'admin') router.replace("/admin");
    else router.replace("/(tabs)/communityScreen");
  };

  const handleLoginPress = async () => {
    try {
      const user = await loginUser(email, password);

      // Enforce Role Check (Manual Only)
      if (user.role !== selectedRole) {
        Alert.alert("Access Denied", `You are not an ${selectedRole === 'admin' ? 'Admin' : 'User'}`);
        return;
      }

      // Check if already enrolled
      const savedEmail = await AsyncStorage.getItem('biometric_email');
      if (savedEmail === email) {
        redirectUser(user);
        return;
      }

      // Ask for Biometrics if supported
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (compatible) {
        Alert.alert("Enable Biometric Login?", "Would you like to use FaceID/Fingerprint next time?", [
          { text: "No", style: "cancel", onPress: () => redirectUser(user) },
          {
            text: "Yes",
            onPress: async () => {
              await AsyncStorage.setItem('biometric_email', email);
              await AsyncStorage.setItem('biometric_password', password);
              redirectUser(user);
            }
          }
        ]);
      } else {
        redirectUser(user);
      }

    } catch (err) {
      Alert.alert("Login Failed", err.message);
    }
  };

  const handleBiometricAuth = async () => {
    const savedEmail = await AsyncStorage.getItem('biometric_email');
    const savedPassword = await AsyncStorage.getItem('biometric_password');

    if (!savedEmail || !savedPassword) {
      Alert.alert("Biometrics not setup", "Please login manually once to enable it.");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Login to Hike Finance',
      fallbackLabel: 'Use Password',
    });

    if (result.success) {
      try {
        const user = await loginUser(savedEmail, savedPassword);
        redirectUser(user);
      } catch (err) {
        Alert.alert("Biometric Login Failed", "Credentials might have changed. Please login manually.");
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Curved Header */}
      <View style={styles.header}>
        <SafeAreaView>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/hike_logo.jpg")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.headerText}>Hike Finance</Text>
            <Text style={styles.headerSubText}>Secure & Professional</Text>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.welcomeText}>Welcome Back</Text>

          {/* Role Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, selectedRole === 'user' && styles.toggleBtnActive]}
              onPress={() => setSelectedRole('user')}
            >
              <Text style={[styles.toggleText, selectedRole === 'user' && styles.toggleTextActive]}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, selectedRole === 'admin' && styles.toggleBtnActive]}
              onPress={() => setSelectedRole('admin')}
            >
              <Text style={[styles.toggleText, selectedRole === 'admin' && styles.toggleTextActive]}>Admin</Text>
            </TouchableOpacity>
          </View>

          <View style={{ width: '100%' }}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              placeholder="name@example.com"
              placeholderTextColor={theme.textLight}
              style={styles.input}
              onChangeText={setEmail}
              autoCapitalize="none"
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={theme.textLight}
              secureTextEntry
              style={styles.input}
              onChangeText={setPassword}
              value={password}
            />

            <TouchableOpacity style={[styles.button, { marginTop: 10 }]} onPress={handleLoginPress}>
              <Text style={GlobalStyles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            {/* Biometric Button */}
            {isBiometricSupported && (
              <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricAuth}>
                <Ionicons name="finger-print" size={32} color={theme.primary} />
                <Text style={styles.biometricText}>Login with Biometrics</Text>
              </TouchableOpacity>
            )}

          </View>

          <TouchableOpacity onPress={() => router.push("/(auth)/signUpScreen")} style={{ marginTop: 20 }}>
            <Text style={{ color: theme.textSecondary }}>Don't have an account? <Text style={{ color: theme.secondary, fontWeight: 'bold' }}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function getStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      backgroundColor: theme.primary,
      height: 300,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      alignItems: 'center',
      width: '100%',
      position: 'absolute',
      top: 0,
    },
    logoContainer: {
      width: 100,
      height: 100,
      backgroundColor: 'white',
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 8
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 20
    },
    headerText: {
      color: theme.white,
      fontSize: 28,
      fontWeight: 'bold',
      letterSpacing: 1,
      lineHeight: 40,
      marginBottom: 5
    },
    headerSubText: {
      color: theme.textLight,
      fontSize: 14,
      marginTop: 8
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      marginTop: 130
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      padding: 25,
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 10,
    },
    welcomeText: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.textPrimary,
      marginBottom: 20
    },
    toggleContainer: {
      flexDirection: 'row',
      marginBottom: 20,
      backgroundColor: theme.inputBg,
      borderRadius: 15,
      padding: 4,
      width: '100%',
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 12
    },
    toggleBtnActive: {
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    toggleText: { fontSize: 14, color: theme.textSecondary, fontWeight: '600' },
    toggleTextActive: { color: theme.textPrimary, fontWeight: 'bold' },
    label: {
      alignSelf: 'flex-start',
      color: theme.textPrimary,
      fontWeight: '500',
      marginLeft: 4,
      marginBottom: 6
    },
    input: {
      backgroundColor: theme.inputBg,
      padding: 15,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.textPrimary,
      fontSize: 16,
      marginBottom: 10,
      width: '100%'
    },
    button: {
      backgroundColor: theme.primary,
      padding: 16,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 15,
      width: '100%',
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5
    },
    biometricBtn: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
      backgroundColor: theme.inputBg,
      borderRadius: 12,
      width: '100%'
    },
    biometricText: {
      marginLeft: 10,
      fontSize: 16,
      color: theme.primary,
      fontWeight: '600'
    }
  });
}