import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { router } from "expo-router";
import { startSignup } from "../../src/controllers/authController";
import { Colors, GlobalStyles } from "../../src/styles/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SignUpScreen() {
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
    <View style={GlobalStyles.container}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <View style={styles.iconContainer}>
              <Ionicons name="person-add-outline" size={35} color={Colors.accent} />
            </View>
            <Text style={styles.headerText}>Join FinanceChat</Text>
            <Text style={styles.headerSubText}>Create your professional profile</Text>
          </View>
        </SafeAreaView>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Details</Text>

          <Text style={styles.label}>Nickname</Text>
          <TextInput
            placeholder="Unique Username (e.g. Neo_99)"
            placeholderTextColor={Colors.textLight}
            style={GlobalStyles.input}
            onChangeText={checkValidation}
            value={username}
          />

          <View style={styles.validationContainer}>
            <ValidationItem label="a-z" isValid={validations.hasLower} />
            <ValidationItem label="A-Z" isValid={validations.hasUpper} />
            <ValidationItem label="0-9" isValid={validations.hasNumber} />
            <ValidationItem label="#!?" isValid={validations.hasSpecial} />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            placeholder="name@company.com"
            placeholderTextColor={Colors.textLight}
            style={GlobalStyles.input}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            placeholder="Create a strong password"
            placeholderTextColor={Colors.textLight}
            style={GlobalStyles.input}
            secureTextEntry
            onChangeText={setPassword}
            value={password}
          />

          <TouchableOpacity
            style={[GlobalStyles.button, (!isFormValid || loading) && styles.disabledBtn]}
            onPress={handleSignup}
            disabled={loading || !isFormValid}
          >
            <Text style={GlobalStyles.buttonText}>{loading ? "Creating Account..." : "Create Account"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, alignSelf: 'center' }}>
            <Text style={{ color: Colors.textSecondary }}>Already have an account? <Text style={{ color: Colors.secondary, fontWeight: 'bold' }}>Sign In</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function ValidationItem({ label, isValid }) {
  return (
    <View style={[styles.validationItem, isValid ? styles.validItem : styles.invalidItem]}>
      <Ionicons
        name={isValid ? "checkmark" : "ellipse-outline"}
        size={12}
        color={isValid ? Colors.white : Colors.textSecondary}
      />
      <Text style={[styles.validationText, { color: isValid ? Colors.white : Colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    height: 250,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    top: 0,
    zIndex: 1
  },
  iconContainer: {
    width: 70,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  headerText: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubText: {
    color: Colors.textLight,
    fontSize: 13,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 5
  },
  contentContainer: {
    paddingTop: 180, // Push down to reveal header
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 20
  },
  label: {
    color: Colors.textPrimary,
    marginBottom: 6,
    fontWeight: '500',
    marginLeft: 4,
    marginTop: 5
  },
  disabledBtn: {
    backgroundColor: Colors.textLight,
    shadowOpacity: 0,
    elevation: 0
  },
  validationContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15, justifyContent: 'space-between' },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: '22%',
    justifyContent: 'center'
  },
  validItem: {
    backgroundColor: Colors.success,
    borderColor: Colors.success
  },
  invalidItem: {
    backgroundColor: Colors.inputBg,
    borderColor: Colors.border
  },
  validationText: { marginLeft: 4, fontSize: 11, fontWeight: '600' }
});