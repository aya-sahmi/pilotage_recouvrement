const express = require('express');
const { getClassement } = require('../controllers/classement.controller');

const router = express.Router();

router.get('/', getClassement);

module.exports = router;
