const { getPerformanceDashboard } = require('../services/performance.service');

async function getPerformance(req, res, next) {
  try {
    const data = await getPerformanceDashboard();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getPerformanceKpi(req, res, next) {
  try {
    const data = await getPerformanceDashboard();
    res.json({ success: true, data: data.kpis || data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPerformance,
  getPerformanceKpi,
};
