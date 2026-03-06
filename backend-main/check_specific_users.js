const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String }
}, { strict: false });

const User = mongoose.model("User", userSchema);

async function check() {
    const mongoUri = "mongodb://127.0.0.1:27017/antisocial";
    try {
        await mongoose.connect(mongoUri);
        const emails = ["boneswolf18@gmail.com", "rajeshsabareenadh@gmail.com", "sabareep22comp@student.mes.ac.in"];
        const found = await User.find({ email: { $in: emails } }).select("email name");
        console.log(JSON.stringify(found, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
