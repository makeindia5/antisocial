module.exports = {
    apps: [
        {
            name: "antisocial-main",
            script: "./backend-main/server.js",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 5002
            }
        },
        {
            name: "antisocial-otp",
            script: "./backend-otp/index.js",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 5001
            }
        }
    ]
};
