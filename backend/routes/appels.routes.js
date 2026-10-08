const express = require('express');
const { get3cx, get3cxKpi, get3cxGestionnaires, get3cxNonRattaches, sync3cx } = require('../controllers/appels.controller');

const router = express.Router();

router.get('/', get3cx);
router.get('/kpi', get3cxKpi);
router.get('/gestionnaires', get3cxGestionnaires);
router.get('/non-rattaches', get3cxNonRattaches);
router.post('/sync', sync3cx);

module.exports = router;
