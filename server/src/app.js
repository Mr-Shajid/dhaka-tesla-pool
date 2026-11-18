const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.use(cors( { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" } ));
app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);

// 404 handler
app.use((req,res) => {
    res.status(404).json({ message: "Router not found" });
});

// Error handler
app.use((err,req,res,next)=> {
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

module.exports = app;