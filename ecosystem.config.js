module.exports = {
    apps: [
        {
            name: "antisocial-main",
            script: "./server.js",
            cwd: "./backend-main",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 5002
            }
        },
        {
            name: "antisocial-otp",
            script: "./index.js",
            cwd: "./backend-otp",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 5001
            }
        }
    ]
};
