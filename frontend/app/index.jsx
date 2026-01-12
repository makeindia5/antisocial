import { router } from "expo-router";
import { StyleSheet, Text, View, Image, Dimensions } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, runOnJS } from "react-native-reanimated";
import { useEffect } from "react";
import { Colors } from "../src/styles/theme";

const { width } = Dimensions.get("window");

export default function Index() {
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  useEffect(() => {
    // 1. Logo Animation
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, { damping: 10, stiffness: 100 });

    // 2. Text Animation (Delayed)
    textOpacity.value = withDelay(500, withTiming(1, { duration: 800 }));
    textTranslateY.value = withDelay(500, withSpring(0));

    // 3. Navigate to Login
    const timer = setTimeout(() => {
      router.replace("/(auth)/login");
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }]
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }]
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image
          source={require("../assets/hike_logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={textStyle}>
        <Text style={styles.appName}>Hike Finance</Text>
        <Text style={styles.tagline}>Secure • Fast • Professional</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background, // Neo-Finance BG
    justifyContent: "center",
    alignItems: "center"
  },
  logoContainer: {
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 30,
    backgroundColor: 'white',
    borderRadius: 40,
    padding: 2
  },
  logo: {
    width: 150,
    height: 150,
    borderRadius: 38
  },
  appName: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.primary,
    textAlign: "center",
    letterSpacing: 1,
    lineHeight: 45,
    marginBottom: 5
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 10,
    letterSpacing: 0.5
  }
});