const mongoose = require('mongoose');
const Message = require('./models/message');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

const start = new Date('2025-12-01T00:00:00Z');
const end = new Date('2025-12-08T23:59:59Z');

async function extract() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB');

        const messages = await Message.find({
            createdAt: { $gte: start, $lte: end }
        }).populate('sender', 'name');

        console.log(`Found ${messages.length} messages.`);

        const tasks = [];
        const skills = [];
        const roadblocks = [];
        const participants = new Set();

        const taskKeywords = ['todo', 'task', 'done', 'finished', 'working on', 'assigned', 'complete'];
        const skillKeywords = ['learned', 'skill', 'discovered', 'figured out', 'understanding', 'new'];
        const roadblockKeywords = ['stuck', 'block', 'problem', 'issue', 'error', 'failed', 'roadblock', 'delay'];

        messages.forEach(m => {
            const content = m.content.toLowerCase();
            const senderName = m.sender ? m.sender.name : 'Unknown';
            participants.add(senderName);

            if (taskKeywords.some(k => content.includes(k))) {
                tasks.push({ date: m.createdAt, owner: senderName, task: m.content });
            }
            if (skillKeywords.some(k => content.includes(k))) {
                skills.push({ owner: senderName, skill: m.content });
            }
            if (roadblockKeywords.some(k => content.includes(k))) {
                roadblocks.push({ owner: senderName, issue: m.content });
            }
        });

        console.log('\n--- Daily Tasks ---');
        tasks.slice(0, 10).forEach(t => {
            console.log(`[${t.date.toISOString().split('T')[0]}] ${t.owner}: ${t.task}`);
        });

        console.log('\n--- Weekly Summary ---');
        console.log(`Participants: ${Array.from(participants).join(', ')}`);
        console.log(`Total Messages: ${messages.length}`);

        console.log('\n--- Weekly Skills Learned ---');
        skills.slice(0, 5).forEach(s => {
            console.log(`- ${s.owner}: ${s.skill}`);
        });

        console.log('\n--- Weekly Risks & Roadblocks ---');
        roadblocks.slice(0, 5).forEach(r => {
            console.log(`- ${r.owner}: ${r.issue}`);
        });

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

extract();
