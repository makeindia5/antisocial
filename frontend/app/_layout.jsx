import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../src/context/ThemeContext';
import { SocketProvider } from '../src/context/SocketContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="mode-switch"
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              headerShown: false
            }}
          />
          <Stack.Screen name="register" />
        </Stack>
      </SocketProvider>
    </ThemeProvider>
  );
}