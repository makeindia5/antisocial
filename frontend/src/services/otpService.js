import { APP_CONFIG } from "../config";
const OTP_BASE = APP_CONFIG.OTP_BASE;

export const requestOTP = async (email) => {
    const res = await fetch(`${OTP_BASE}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return await res.json();
};

export const verifyOTPCode = async (email, otp) => {
    const res = await fetch(`${OTP_BASE}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) throw new Error("Invalid OTP");
    return await res.json();
};