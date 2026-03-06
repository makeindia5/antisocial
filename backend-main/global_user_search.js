const { execSync } = require('child_process');

function runMongo(db, cmd) {
    try {
        // Use a temporary file for the script to avoid shell escaping issues
        const script = `printjson(${cmd}.toArray())`;
        const output = execSync(`mongosh ${db} --quiet --eval '${script}'`).toString();
        return output;
    } catch (e) {
        return null;
    }
}

try {
    const mongoOutput = execSync('mongosh --quiet --eval "db.getMongo().getDBNames()"').toString();
    const dbs = mongoOutput.replace(/[\[\]\s"]/g, '').split(',').filter(d => d);

    const emails = ['boneswolf18@gmail.com', 'rajeshsabareenadh@gmail.com', 'sabareep22comp@student.mes.ac.in'];

    console.log("Searching for:", emails);

    dbs.forEach(db => {
        if (['admin', 'config', 'local'].includes(db)) return;

        // Check 'users' collection
        const queryUsers = `db.users.find({ email: { $in: ${JSON.stringify(emails)} } }, { email: 1, name: 1 })`;
        const resUsers = runMongo(db, queryUsers);
        if (resUsers && resUsers.trim() !== '' && resUsers.trim() !== '[]') {
            console.log(`\nDatabase: ${db} (Collection: users)`);
            console.log(resUsers);
        }

        // Check 'user' collection
        const queryUser = `db.user.find({ email: { $in: ${JSON.stringify(emails)} } }, { email: 1, name: 1 })`;
        const resUser = runMongo(db, queryUser);
        if (resUser && resUser.trim() !== '' && resUser.trim() !== '[]') {
            console.log(`\nDatabase: ${db} (Collection: user)`);
            console.log(resUser);
        }
    });
} catch (err) {
    console.error("Error:", err.message);
}
