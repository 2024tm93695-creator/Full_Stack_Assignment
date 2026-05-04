const express = require('express');
const {
  getAllSlots, getNearbySlots, getSlotById,
  createSlot, updateSlot, deleteSlot, getStats
} = require('../controllers/parkingController');

const router = express.Router();

router.get('/stats',   getStats);
router.get('/nearby',  getNearbySlots);
router.get('/',        getAllSlots);
router.get('/:id',     getSlotById);
router.post('/',       createSlot);
router.put('/:id',     updateSlot);
router.delete('/:id',  deleteSlot);

module.exports = router;
