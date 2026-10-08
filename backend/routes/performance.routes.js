const express = require('express');
const { getPerformance, getPerformanceKpi } = require('../controllers/performance.controller');

const router = express.Router();

router.get('/', getPerformance);
router.get('/kpi', getPerformanceKpi);

module.exports = router;
