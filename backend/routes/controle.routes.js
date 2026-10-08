const express = require('express');
const { getControle } = require('../controllers/controle.controller');

const router = express.Router();

router.get('/', getControle);

module.exports = router;
