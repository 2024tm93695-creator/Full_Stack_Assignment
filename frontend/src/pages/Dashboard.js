import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp  } from '../context/AppContext';
import api from '../services/api';
import './Dashboard.css';

const StatCard = ({ icon, label, value, sub, color }) => (
  <div className="stat-card" style={{ borderTopColor: color }}>
    <div className="stat-icon" style={{ background: color + '22', color }}>{icon}</div>
    <div className="stat-body">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
);

const CongestionDot = ({ level }) => {
  const colors = { free: '#4caf50', moderate: '#ff9800', heavy: '#f44336', severe: '#9c27b0' };
  return <span className="congestion-dot" style={{ background: colors[level] || '#ccc' }} />;
};

const Dashboard = () => {
  const { user } = useAuth();
  const { trafficData, notifications } = useApp();
  const [parkingStats, setParkingStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/parking/slots/stats'),
      api.get('/api/parking/bookings?limit=3')
    ]).then(([statsRes, bookingsRes]) => {
      setParkingStats(statsRes.data);
      setRecentBookings(bookingsRes.data.bookings || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const congestionSummary = (() => {
    const counts = { free: 0, moderate: 0, heavy: 0, severe: 0 };
    trafficData.forEach(t => { if (counts[t.congestionLevel] !== undefined) counts[t.congestionLevel]++; });
    return counts;
  })();

  const avgCongestion = trafficData.length
    ? Math.round(trafficData.reduce((s, t) => s + t.congestionScore, 0) / trafficData.length)
    : 0;

  const alerts = trafficData.filter(t => t.congestionLevel === 'heavy' || t.congestionLevel === 'severe');

  return (
    <div className="page-container">
      <div className="dashboard-welcome">
        <div>
          <h1>Good {getGreeting()}, {user?.name?.split(' ')[0]}! 👋</h1>
          <p>Here's the real-time traffic & parking overview for Hyderabad</p>
        </div>
        <div className="quick-actions">
          <Link to="/map"      className="btn btn-primary">🗺 Find Parking</Link>
          <Link to="/bookings" className="btn btn-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}>📋 My Bookings</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard icon="🅿" label="Available Slots"
          value={loading ? '...' : (parkingStats?.availableSlots ?? '–')}
          sub={`of ${parkingStats?.totalSlots ?? '–'} total`}
          color="#4caf50" />
        <StatCard icon="📍" label="Parking Locations"
          value={loading ? '...' : (parkingStats?.totalLocations ?? '–')}
          sub="across Hyderabad" color="#2196f3" />
        <StatCard icon="🚦" label="Avg Congestion"
          value={`${avgCongestion}%`}
          sub={avgCongestion < 40 ? 'Roads are clear' : avgCongestion < 70 ? 'Moderate traffic' : 'Heavy traffic'}
          color={avgCongestion < 40 ? '#4caf50' : avgCongestion < 70 ? '#ff9800' : '#f44336'} />
        <StatCard icon="📋" label="My Bookings"
          value={recentBookings.length}
          sub="recent bookings" color="#9c27b0" />
      </div>

      <div className="dashboard-grid">
        {/* Traffic status */}
        <div className="card">
          <div className="card-header">
            <h3>🚦 Live Traffic Status</h3>
            <span className="live-badge">LIVE</span>
          </div>
          <div className="congestion-summary">
            {Object.entries(congestionSummary).map(([level, count]) => (
              <div key={level} className="congestion-row">
                <CongestionDot level={level} />
                <span className="congestion-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                <div className="congestion-bar-wrap">
                  <div className="congestion-bar" style={{
                    width: `${(count / Math.max(trafficData.length, 1)) * 100}%`,
                    background: level === 'free' ? '#4caf50' : level === 'moderate' ? '#ff9800' : level === 'heavy' ? '#f44336' : '#9c27b0'
                  }} />
                </div>
                <span className="congestion-count">{count} roads</span>
              </div>
            ))}
          </div>

          {alerts.length > 0 && (
            <div className="alerts-section">
              <h4>⚠️ Active Alerts</h4>
              {alerts.slice(0, 3).map((a, i) => (
                <div key={i} className="alert-item">
                  <strong>{a.area}</strong> – {a.roadName}
                  <span className={`badge badge-${a.congestionLevel}`}>{a.congestionLevel}</span>
                  {a.incidentType !== 'none' && <span className="incident-tag">{a.incidentType}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent bookings */}
        <div className="card">
          <div className="card-header">
            <h3>📋 Recent Bookings</h3>
            <Link to="/bookings" className="view-all">View all →</Link>
          </div>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : recentBookings.length === 0 ? (
            <div className="empty-state">
              <span>🅿</span>
              <p>No bookings yet</p>
              <Link to="/map" className="btn btn-primary btn-sm">Find Parking</Link>
            </div>
          ) : (
            <div className="booking-list">
              {recentBookings.map(b => (
                <div key={b._id} className="booking-item">
                  <div className="booking-left">
                    <strong>{b.slotName}</strong>
                    <small>{b.slotAddress}</small>
                    <small>🚗 {b.vehicleNumber} • ₹{b.totalAmount}</small>
                  </div>
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="card-header">
            <h3>🔔 Recent Alerts</h3>
          </div>
          {notifications.length === 0 ? (
            <div className="empty-state">
              <span>🔕</span>
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.slice(0, 4).map(n => (
                <div key={n._id} className={`notif-item ${!n.isRead ? 'unread' : ''}`}>
                  <div className="notif-dot" />
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Parking availability by area */}
        <div className="card">
          <div className="card-header">
            <h3>🅿 Parking by Area</h3>
            <Link to="/map" className="view-all">Open map →</Link>
          </div>
          <div className="area-stats">
            {[
              { area: 'HITEC City', available: 45, total: 120 },
              { area: 'Madhapur',   available: 80, total: 150 },
              { area: 'Gachibowli',available: 0,  total: 200 },
              { area: 'Banjara Hills', available: 12, total: 80 },
              { area: 'Jubilee Hills', available: 35, total: 60 }
            ].map(a => (
              <div key={a.area} className="area-row">
                <span className="area-name">{a.area}</span>
                <div className="area-bar-wrap">
                  <div className="area-bar" style={{
                    width: `${(a.available / a.total) * 100}%`,
                    background: a.available === 0 ? '#f44336' : a.available < a.total * 0.2 ? '#ff9800' : '#4caf50'
                  }} />
                </div>
                <span className="area-count" style={{ color: a.available === 0 ? '#f44336' : '#4caf50' }}>
                  {a.available}/{a.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

export default Dashboard;
