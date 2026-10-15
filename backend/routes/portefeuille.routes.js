const express = require('express');
const {
  getPortefeuille,
  getPortefeuilleKpisHandler,
  getPortefeuilleStatuts,
  getPortefeuilleTypesLot,
  getResponsablesRanking,
  getClientsRanking,
} = require('../controllers/portefeuille.controller');

const router = express.Router();

router.get('/', getPortefeuille);
router.get('/kpi', getPortefeuilleKpisHandler);
router.get('/statuts', getPortefeuilleStatuts);
router.get('/types-lot', getPortefeuilleTypesLot);
router.get('/classements/responsables', getResponsablesRanking);
router.get('/classements/clients', getClientsRanking);

module.exports = router;
