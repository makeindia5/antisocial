export const APP_CONFIG = {
    API_DOMAIN: "https://gurudipaksalviprivatelimited.com",
    get AUTH_BASE() { return `${this.API_DOMAIN}/api/auth`; },
    get OTP_BASE() { return `${this.API_DOMAIN}/otp`; },
    get SOCKET_URL() { return this.API_DOMAIN; }
};
