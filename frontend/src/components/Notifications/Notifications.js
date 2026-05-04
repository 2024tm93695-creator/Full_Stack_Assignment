import React from 'react';
import { useApp } from '../../context/AppContext';
import './Notifications.css';

const TYPE_ICONS = {
  booking_confirmed: '✅',
  booking_cancelled: '❌',
  slot_available:    '🅿',
  congestion_alert:  '🚦',
  reminder:          '⏰',
  info:              'ℹ️'
};

const Notifications = ({ onClose }) => {
  const { notifications, unreadCount, markRead, markAllRead } = useApp();

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span>🔔 Notifications</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button className="mark-all-btn" onClick={markAllRead}>Mark all read</button>
          )}
          <button className="notif-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="notif-scroll">
        {notifications.length === 0 ? (
          <div className="notif-empty">
            <span>🔕</span>
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n._id}
              className={`notif-row ${!n.isRead ? 'unread' : ''}`}
              onClick={() => !n.isRead && markRead(n._id)}
            >
              <span className="notif-type-icon">{TYPE_ICONS[n.type] || 'ℹ️'}</span>
              <div className="notif-content">
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{new Date(n.createdAt).toLocaleString()}</small>
              </div>
              {!n.isRead && <div className="unread-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
