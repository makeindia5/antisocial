import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { loginUser } from "../../src/controllers/authController";
import { Colors, GlobalStyles } from "../../src/styles/theme";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState('user'); // 'user' or 'admin'

  const handleLoginPress = async () => {
    try {
      const user = await loginUser(email, password);

      // Enforce Role Check
      if (user.role !== selectedRole) {
        alert(`Access Denied: You are not an ${selectedRole === 'admin' ? 'Admin' : 'User'}`);
        return;
      }

      if (user.role === 'admin') {
        router.replace("/admin");
      } else {
        router.replace("/(tabs)/communityScreen");
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <View style={GlobalStyles.container}>
      {/* Curved Header */}
      <View style={styles.header}>
        <SafeAreaView>
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <View style={styles.iconContainer}>
              <Ionicons name="wallet-outline" size={40} color={Colors.accent} />
            </View>
            <Text style={styles.headerText}>FinanceChat</Text>
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
              placeholderTextColor={Colors.textLight}
              style={GlobalStyles.input}
              onChangeText={setEmail}
              autoCapitalize="none"
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              placeholder="••••••••"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
              style={GlobalStyles.input}
              onChangeText={setPassword}
              value={password}
            />

            <TouchableOpacity style={[GlobalStyles.button, { marginTop: 10 }]} onPress={handleLoginPress}>
              <Text style={GlobalStyles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push("/(auth)/signUpScreen")} style={{ marginTop: 20 }}>
            <Text style={{ color: Colors.textSecondary }}>Don't have an account? <Text style={{ color: Colors.secondary, fontWeight: 'bold' }}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    height: 300,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    width: '100%',
    position: 'absolute',
    top: 0,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  headerText: {
    color: Colors.white,
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  headerSubText: {
    color: Colors.textLight,
    fontSize: 14,
    marginTop: 5
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 100 // Overlap header
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 20
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: Colors.inputBg,
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
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: Colors.textPrimary, fontWeight: 'bold' },
  label: {
    alignSelf: 'flex-start',
    color: Colors.textPrimary,
    marginBottom: 6,
    fontWeight: '500',
    marginLeft: 4
  }
});