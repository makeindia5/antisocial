import { APP_CONFIG } from "../config";
export const API_BASE = APP_CONFIG.AUTH_BASE;

export const authRequest = async (endpoint, body) => {
    console.log(`[API] Sending request to ${API_BASE}${endpoint}`, body);
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        console.log(`[API] Response from ${endpoint}:`, res.status, data);
        if (!res.ok) throw new Error(data.message || "Failed");
        return data;
    } catch (e) {
        console.error(`[API] Error in ${endpoint}:`, e);
        throw new Error(`Connection Error: ${e.message} (URL: ${API_BASE}${endpoint})`);
    }
};