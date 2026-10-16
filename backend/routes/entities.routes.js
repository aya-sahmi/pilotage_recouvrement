const express = require('express');
const controllers = require('../controllers/entities.controller');

function buildRouter(controller) {
  const router = express.Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}

module.exports = {
  responsables: buildRouter(controllers.responsables),
  clients: buildRouter(controllers.clients),
};
