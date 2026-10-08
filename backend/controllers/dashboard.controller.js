const { getDashboardSnapshot } = require('../services/performance.service');

async function getDashboard(req, res, next) {
  try {
    const data = await getDashboardSnapshot();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
};
