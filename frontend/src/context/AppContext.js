import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from './AuthContext';

export const AppContext = createContext();

const TRAFFIC_URL = process.env.REACT_APP_TRAFFIC_WS  || 'http://localhost:5003';
const NOTIF_URL   = process.env.REACT_APP_NOTIF_WS    || 'http://localhost:5004';

export const AppProvider = ({ children }) => {
  const { user } = useAuth();
  const [trafficData,    setTrafficData]    = useState([]);
  const [notifications,  setNotifications]  = useState([]);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [toasts,         setToasts]         = useState([]);

  // Traffic WebSocket — only when logged in
  useEffect(() => {
    if (!user) return;
    const sock = io(TRAFFIC_URL, { transports: ['websocket', 'polling'] });
    sock.on('traffic:update', (data) => {
      setTrafficData(prev => {
        const filtered = prev.filter(t => t.roadName !== data.roadName);
        return [...filtered, data].slice(-50);
      });
    });
    api.get('/api/traffic').then(r => setTrafficData(r.data)).catch(() => {});
    return () => sock.disconnect();
  }, [user]);

  // Notifications WebSocket — only when logged in
  useEffect(() => {
    if (!user) return;
    const sock = io(NOTIF_URL, { transports: ['websocket', 'polling'] });
    sock.emit('join', user.id);
    sock.on('notification:new', (n) => {
      setNotifications(prev => [n, ...prev]);
      setUnreadCount(c => c + 1);
      addToast(n.title, n.message, n.type === 'congestion_alert' ? 'warning' : 'success');
    });
    api.get('/api/notifications').then(r => {
      setNotifications(r.data.notifications || []);
      setUnreadCount(r.data.unreadCount || 0);
    }).catch(() => {});
    return () => sock.disconnect();
  }, [user]);

  const markRead = useCallback(async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put('/api/notifications/read-all', { userId: user?.id });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }, [user]);

  const addToast = useCallback((title, message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{
      trafficData, notifications, unreadCount, toasts,
      markRead, markAllRead, addToast, removeToast
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
