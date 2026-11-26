const express = require('express');
const { listZones } = require('../config/zones');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ zones: listZones() });
});

module.exports = router;