const express = require('express');
const { getAllTraffic, getNearbyTraffic, getETA, getHeatmap, getStats } = require('../controllers/trafficController');

const router = express.Router();

router.get('/stats',   getStats);
router.get('/heatmap', getHeatmap);
router.get('/eta',     getETA);
router.get('/nearby',  getNearbyTraffic);
router.get('/',        getAllTraffic);

module.exports = router;
