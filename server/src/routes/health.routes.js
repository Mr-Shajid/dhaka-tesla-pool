const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req,res) => {
    const dbConnected = mongoose.connection.readyState === 1;
    res.json({
        status: "ok",
        db: dbConnected ? "connected" : "disconnected",
        uptime: Math.round(process.uptime()),
    });
});

module.exports = router;