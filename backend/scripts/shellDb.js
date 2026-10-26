require('dotenv').config();
const { spawn } = require('child_process');

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lostlink';
console.log(`\nConnecting to MongoDB Shell (mongosh)...`);
console.log(`Target: ${uri.replace(/:([^:@]+)@/, ':****@')}\n`);

const child = spawn('npx', ['mongosh', uri], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
