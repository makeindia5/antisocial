const API_URL = process.env.API_URL || "https://gurudipaksalviprivatelimited.com/api/auth";
const OTP_URL = process.env.OTP_URL || "https://gurudipaksalviprivatelimited.com/otp";

async function check() {
    console.log(`Checking Main API health at: ${API_URL}/health`);
    try {
        const res = await fetch(`${API_URL}/health`);
        const data = await res.json();

        if (res.status === 200 && data.status === 'ok' && data.database === 'connected') {
            console.log("✅ Main API is healthy and database is connected.");
        } else {
            throw new Error(`Main API failure: ${JSON.stringify(data)}`);
        }

        console.log(`Checking OTP API health at: ${OTP_URL}/health`);
        const otpRes = await fetch(`${OTP_URL}/health`);
        const otpData = await otpRes.json();

        if (otpRes.status === 200 && otpData.status === 'ok') {
            console.log("✅ OTP API is healthy.");
        } else {
            throw new Error(`OTP API failure: ${JSON.stringify(otpData)}`);
        }

        console.log("🚀 All systems connected and healthy!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Connection check failed!");
        console.error(err.message);
        process.exit(1);
    }
}

check();
