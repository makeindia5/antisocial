import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Dimensions } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { router } from "expo-router";
import { startSignup } from "../../src/controllers/authController";
import { Colors } from "../../src/styles/theme";
import { useTheme } from '../../src/context/ThemeContext';

const { width } = Dimensions.get('window');

export default function SignUpScreen() {
  // Force refresh
  const { colors: theme } = useTheme();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
        params: { email, username, password }
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {/* Back Button */}
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: theme.border }]}>
            <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

              {/* Header */}
              <View style={{ marginTop: 20, marginBottom: 30 }}>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Create account</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Join us to get started.</Text>
              </View>

              {/* Form */}
              <View style={styles.form}>

                {/* Username */}
                <Text style={[styles.label, { color: theme.textPrimary }]}>Choose a username</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    placeholder="e.g. Neo_99"
                    placeholderTextColor={theme.textLight}
                    style={[styles.input, { color: theme.textPrimary }]}
                    onChangeText={checkValidation}
                    value={username}
                  />
                  {Object.values(validations).every(Boolean) && username.length > 0 &&
                    <Ionicons name="checkmark-circle" size={20} color={theme.success || '#4CD964'} />
                  }
                </View>

                {/* Validation Chips */}
                <View style={styles.chipContainer}>
                  <Chip label="a-z" isValid={validations.hasLower} theme={theme} />
                  <Chip label="A-Z" isValid={validations.hasUpper} theme={theme} />
                  <Chip label="0-9" isValid={validations.hasNumber} theme={theme} />
                  <Chip label="#!?" isValid={validations.hasSpecial} theme={theme} />
                </View>

                <Text style={[styles.label, { color: theme.textPrimary }]}>Email Address</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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

                <Text style={[styles.label, { color: theme.textPrimary }]}>Password</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    placeholder="Strong password"
                    placeholderTextColor={theme.textLight}
                    style={[styles.input, { color: theme.textPrimary }]}
                    secureTextEntry
                    onChangeText={setPassword}
                    value={password}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.mainBtn, { backgroundColor: theme.primary, opacity: isFormValid ? 1 : 0.6 }]}
                  onPress={handleSignup}
                  disabled={loading || !isFormValid}
                >
                  <Text style={styles.btnText}>{loading ? "Creating..." : "Sign Up"}</Text>
                  {!loading && <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 10 }} />}
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={{ color: theme.textSecondary }}>Already a member? </Text>
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
        backgroundColor: isValid ? (theme.success || '#4CD964') : theme.inputBg,
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
    width: 40, height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 5
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500'
  },
  form: {
    gap: 15
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    marginBottom: -5,
    marginTop: 5
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
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: -5,
    marginBottom: 5
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  mainBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 20,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20
  }
});