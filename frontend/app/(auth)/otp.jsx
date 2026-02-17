import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { completeSignup } from "../../src/controllers/authController";
import { Colors } from "../../src/styles/theme";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from '../../src/context/ThemeContext';

const { width } = Dimensions.get('window');

export default function OtpScreen() {
  const { colors: theme } = useTheme();
  const { email, username, password, phoneNumber } = useLocalSearchParams();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const verifyOtpPress = async () => {
    if (!otp) return alert("Please enter the OTP.");
    setLoading(true);
    try {
      await completeSignup(username, email, password, otp, phoneNumber);
      alert("Account verified! Please sign in.");
      router.replace("/(auth)/login");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 30 }}>
          <View style={{ marginBottom: 40 }}>
            <View style={[styles.iconContainer, { backgroundColor: theme.inputBg }]}>
              <Ionicons name="shield-checkmark" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Verification</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>We sent a code to {email}</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              placeholder="0 0 0 0 0 0"
              placeholderTextColor={theme.textLight}
              style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={setOtp}
              textAlign="center"
              autoFocus
            />

            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.primary }]} onPress={verifyOtpPress} disabled={loading}>
              <Text style={styles.btnText}>{loading ? "Verifying..." : "Verify"}</Text>
              {!loading && <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 10 }} />}
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 20, alignSelf: 'center' }} onPress={() => router.back()}>
              <Text style={{ color: theme.textSecondary }}>Wrong email? <Text style={{ color: theme.secondary, fontWeight: 'bold' }}>Go Back</Text></Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { marginLeft: 20, marginTop: 10 },
  iconContainer: {
    width: 80, height: 80, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500'
  },
  form: { gap: 20 },
  input: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 10,
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 1,
    textAlign: 'center'
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
  btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});