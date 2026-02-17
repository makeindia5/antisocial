import { authRequest } from "../services/apiService";
import { requestOTP, verifyOTPCode } from "../services/otpService";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const loginUser = async (email, password) => {
  const data = await authRequest("/login", { email, password });
  if (data.token) await AsyncStorage.setItem("token", data.token);
  await AsyncStorage.setItem("userData", JSON.stringify(data)); // Save full object for easy access
  await AsyncStorage.setItem("userId", data.userId);
  await AsyncStorage.setItem("userRole", data.role);
  if (data.name) await AsyncStorage.setItem("userName", data.name);
  if (data.profilePic) await AsyncStorage.setItem("profilePic", data.profilePic);
  if (data.phoneNumber) await AsyncStorage.setItem("phoneNumber", data.phoneNumber);
  await AsyncStorage.setItem("isNumberHidden", data.isNumberHidden ? 'true' : 'false');
  if (data.hasCompanyAccess) {
    await AsyncStorage.setItem("hasCompanyAccess", "true");
  } else {
    await AsyncStorage.removeItem("hasCompanyAccess");
  }
  return data;
};

export const startSignup = async (email) => {
  return await requestOTP(email);
};

export const completeSignup = async (username, email, password, otp, phoneNumber) => {
  await verifyOTPCode(email, otp);
  return await authRequest("/signup", { name: username, email, password, phoneNumber });
};