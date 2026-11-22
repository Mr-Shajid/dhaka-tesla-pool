const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors( { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" } ));
app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req,res) => {
    res.status(404).json({ message: "Router not found" });
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    message: status === 500 ? 'Server error' : err.message,
    ...(err.errors && { errors: err.errors }),
  });
});

module.exports = app;