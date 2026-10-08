const { getPerformanceDashboard } = require('../services/performance.service');

async function getClassement(req, res, next) {
  try {
    const { ranking } = await getPerformanceDashboard();
    const rows = ranking.map((row) => ({
      ...row,
      id: row.gestionnaire_id,
      score: row.taux,
    }));

    res.json({
      success: true,
      data: {
        enabled: rows.length > 0,
        rows,
        topManagers: rows.slice(0, 3),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getClassement,
};
