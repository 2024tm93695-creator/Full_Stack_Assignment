import React from 'react';
import { useApp } from '../../context/AppContext';
import './Toast.css';

const ICONS = {
  success: '✅', warning: '⚠️', info: 'ℹ️',
  booking_confirmed: '✅', booking_cancelled: '❌', congestion_alert: '🚦'
};

const ToastContainer = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">{ICONS[t.type] || 'ℹ️'}</span>
          <div className="toast-body">
            <strong>{t.title}</strong>
            <p>{t.message}</p>
          </div>
          <button className="toast-close" onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
