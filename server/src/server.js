require('dotenv').config();

const app = require('./app');
const connectDB = require('./db/connect');

const PORT = process.env.PORT || 5000;

async function start() {
    try {
        await connectDB(process.env.MONGODB_URI);
        app.listen(PORT, () => { console.log(`API running on port ${PORT}`)});
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}