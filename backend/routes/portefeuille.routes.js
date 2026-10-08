const express = require('express');
const { getPortefeuille, getPortefeuilleKpisHandler, getPortefeuilleStatuts, getPortefeuilleTypesLot } = require('../controllers/portefeuille.controller');

const router = express.Router();

router.get('/', getPortefeuille);
router.get('/kpi', getPortefeuilleKpisHandler);
router.get('/statuts', getPortefeuilleStatuts);
router.get('/types-lot', getPortefeuilleTypesLot);

module.exports = router;
