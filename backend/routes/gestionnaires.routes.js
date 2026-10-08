const express = require('express');
const { listGestionnaires, createGestionnaire, updateGestionnaire, deleteGestionnaire } = require('../controllers/gestionnaires.controller');

const router = express.Router();

router.get('/', listGestionnaires);
router.post('/', createGestionnaire);
router.put('/:id', updateGestionnaire);
router.delete('/:id', deleteGestionnaire);

module.exports = router;
