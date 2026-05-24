// Exposes the canonical item list to the client as a contract endpoint
'use strict';

const express = require('express');
const { ALL_ITEMS } = require('../model/canonical-items');

const router = express.Router();

// GET /items - returns the canonical item list
router.get('/items', (req, res) => {
  res.json({ items: ALL_ITEMS });
});

module.exports = router;
