const express = require('express');
const multer = require('multer');
const { importPerformance, importPortefeuille, getImports } = require('../controllers/imports.controller');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const extension = require('path').extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(extension));
  },
});

router.get('/', getImports);
router.post('/performance', upload.single('file'), importPerformance);
router.post('/portefeuille', upload.single('file'), importPortefeuille);

module.exports = router;
