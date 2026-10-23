const express = require('express');
const { getClassement, getEncaissementsClassement } = require('../controllers/classement.controller');

const router = express.Router();

router.get('/', getClassement);
router.get('/encaissements', getEncaissementsClassement);

module.exports = router;
