const { getPerformanceDashboard } = require('../services/performance.service');
const { getEncaissementRanking, getCurrentMonthRanking } = require('../services/classement.service');

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

async function getEncaissementsClassement(req, res, next) {
  try {
    const period = String(req.query.period || 'current');
    const group = String(req.query.group || 'gestionnaires');
    const data = period === 'current'
      ? await getCurrentMonthRanking(group)
      : await getEncaissementRanking(period, group);
    res.json({ success: true, data: { period, group, ...data } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getClassement,
  getEncaissementsClassement,
};
