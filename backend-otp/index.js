const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "aayushmali224@gmail.com",
    pass: process.env.EMAIL_PASS || "xeszqokklrqkppdq",
  },
});

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = otp;
  console.log(`OTP for ${email}: ${otp}`);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Finance App",
      text: `Your OTP is ${otp}`,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ success: false, error: "Failed to send OTP", details: error.message });
  }
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  console.log(`Verifying OTP for ${email}. Received: ${otp}`);
  console.log(`Stored OTP: ${otpStore[email]}`);
  console.log(`Type check - Received: ${typeof otp}, Stored: ${typeof otpStore[email]}`);

  // Use string comparison to be safe
  if (otpStore[email] && String(otpStore[email]) === String(otp)) {
    delete otpStore[email];
    console.log("OTP Verified Successfully");
    return res.json({ success: true });
  }

  console.log("OTP Verification Failed");
  res.status(400).json({ success: false, error: "Invalid OTP" });
});

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.listen(5001, '0.0.0.0', () => console.log("OTP Server on 5001"));
