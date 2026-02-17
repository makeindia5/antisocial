import React, { useState, useEffect } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Alert, Dimensions, KeyboardAvoidingView, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { loginUser } from "../../src/controllers/authController";
import { Colors } from "../../src/styles/theme";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/context/ThemeContext";
import { useSocket } from "../../src/context/SocketContext";

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const { colors: theme } = useTheme();
  const { setUserId, setUserProfile } = useSocket();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState('user');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const hasCreds = await AsyncStorage.getItem('biometric_email');
      setIsBiometricSupported(compatible && enrolled && hasCreds);
    })();
  }, []);

  const redirectUser = (user) => {
    // Sync context
    setUserId(user.userId);
    setUserProfile({ name: user.name, profilePic: user.profilePic });

    router.replace("/(tabs)/communityScreen");
  };

  const handleLoginPress = async () => {
    if (!email || !password) return Alert.alert("Error", "Please fill in all fields");
    setLoading(true);
    try {
      const user = await loginUser(email, password);

      if (user.role !== selectedRole) {
        Alert.alert("Access Denied", `You are not an ${selectedRole === 'admin' ? 'Admin' : 'User'}`);
        return;
      }

      const savedEmail = await AsyncStorage.getItem('biometric_email');
      if (savedEmail === email) {
        redirectUser(user);
        return;
      }

      const bioPromptShown = await AsyncStorage.getItem(`bio_prompt_shown_${email}`);
      const compatible = await LocalAuthentication.hasHardwareAsync();

      if (compatible && !bioPromptShown) {
        Alert.alert("Enable Biometric Login?", "Would you like to use FaceID/Fingerprint next time?", [
          {
            text: "No",
            style: "cancel",
            onPress: async () => {
              await AsyncStorage.setItem(`bio_prompt_shown_${email}`, 'true');
              redirectUser(user);
            }
          },
          {
            text: "Yes",
            onPress: async () => {
              await AsyncStorage.setItem(`bio_prompt_shown_${email}`, 'true');
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
    } finally {
      setLoading(false);
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
      promptMessage: 'Login to Intraa',
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center' }}>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>

          {/* Header / Intro */}
          <View style={{ marginBottom: 40 }}>
            {/* <View style={styles.logoPlaceholder}>
                     <Ionicons name="chatbubbles" size={40} color={theme.textPrimary} />
                </View> */}
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: theme.textPrimary }]}>Welcome back.</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Sign in to continue.
            </Text>
          </View>

          {/* Role Pills */}
          <View style={[styles.roleContainer, { backgroundColor: theme.inputBg }]}>
            <TouchableOpacity
              style={[styles.roleBtn, selectedRole === 'user' && { backgroundColor: theme.surface, shadowColor: theme.shadow, elevation: 2 }]}
              onPress={() => setSelectedRole('user')}
            >
              <Text style={[styles.roleText, selectedRole === 'user' && { fontWeight: 'bold', color: theme.textPrimary }]}>User</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, selectedRole === 'admin' && { backgroundColor: theme.surface, shadowColor: theme.shadow, elevation: 2 }]}
              onPress={() => setSelectedRole('admin')}
            >
              <Text style={[styles.roleText, selectedRole === 'admin' && { fontWeight: 'bold', color: theme.textPrimary }]}>Admin</Text>
            </TouchableOpacity>
          </View>

          {/* Inputs */}
          <View style={styles.form}>
            <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="mail-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Email or Phone"
                placeholderTextColor={theme.textLight}
                style={[styles.input, { color: theme.textPrimary }]}
                onChangeText={setEmail}
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Password"
                placeholderTextColor={theme.textLight}
                style={[styles.input, { color: theme.textPrimary }]}
                onChangeText={setPassword}
                value={password}
                secureTextEntry
              />
            </View>

            {/* Main Action */}
            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.primary }]} onPress={handleLoginPress} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Signing in..." : "Sign In"}</Text>
              {!loading && <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 10 }} />}
            </TouchableOpacity>

            {/* Biometric */}
            {isBiometricSupported && (
              <TouchableOpacity style={styles.bioBtn} onPress={handleBiometricAuth}>
                <Ionicons name="finger-print" size={32} color={theme.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Footer Link */}
            <View style={styles.footer}>
              <Text style={{ color: theme.textSecondary }}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text style={{ color: theme.textPrimary, fontWeight: 'bold' }}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoPlaceholder: {
    width: 60, height: 60,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 15,
    marginBottom: 20
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 5
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500'
  },
  roleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 16,
    marginBottom: 30
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12
  },
  roleText: {
    color: '#999',
  },
  form: {
    gap: 15
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 15 : 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '500'
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
    elevation: 10
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  bioBtn: {
    alignSelf: 'center',
    marginTop: 20,
    padding: 10
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30
  }
});