const express = require('express');
const {
  getNotifications, createNotification,
  markAsRead, markAllRead, deleteNotification
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/',               getNotifications);
router.post('/',              createNotification);
router.put('/read-all',       markAllRead);
router.put('/:id/read',       markAsRead);
router.delete('/:id',         deleteNotification);

module.exports = router;
