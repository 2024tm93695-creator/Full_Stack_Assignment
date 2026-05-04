import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import './AdminDashboard.css';

const COLORS = ['#4caf50', '#2196f3', '#9c27b0', '#f44336', '#ff9800'];

const AdminDashboard = () => {
  const { trafficData } = useApp();
  const [parkingStats,  setParkingStats]  = useState(null);
  const [bookingStats,  setBookingStats]  = useState(null);
  const [slots,         setSlots]         = useState([]);
  const [allBookings,   setAllBookings]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState('overview');

  useEffect(() => {
    Promise.all([
      api.get('/api/parking/slots/stats'),
      api.get('/api/parking/bookings/stats'),
      api.get('/api/parking/slots?limit=50'),
      api.get('/api/parking/bookings/all?limit=10')
    ]).then(([pStats, bStats, slotsRes, bookingsRes]) => {
      setParkingStats(pStats.data);
      setBookingStats(bStats.data);
      setSlots(slotsRes.data.slots || []);
      setAllBookings(bookingsRes.data.bookings || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleSlotStatus = async (slotId, current) => {
    try {
      await api.put(`/api/parking/slots/${slotId}`, {
        isOperational: !current
      });
      setSlots(prev => prev.map(s =>
        s._id === slotId ? { ...s, isOperational: !current } : s
      ));
    } catch (err) {
      alert('Update failed');
    }
  };

  const trafficByLevel = (() => {
    const counts = {};
    trafficData.forEach(t => {
      counts[t.congestionLevel] = (counts[t.congestionLevel] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const utilizationData = slots.map(s => ({
    name: s.area,
    utilized: s.totalSlots - s.availableSlots,
    available: s.availableSlots
  })).slice(0, 8);

  const bookingByStatus = bookingStats?.byStatus?.map(b => ({
    name: b._id,
    value: b.count
  })) || [];

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

  return (
    <div className="page-container">
      <div className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>System overview and management</p>
        </div>
        <div className="admin-tabs">
          {['overview', 'slots', 'bookings', 'traffic'].map(tab => (
            <button key={tab} className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <div className="admin-stat">
              <span className="admin-stat-icon" style={{ background: '#e8f5e9' }}>🅿</span>
              <div>
                <div className="admin-stat-val">{parkingStats?.totalLocations ?? 0}</div>
                <div className="admin-stat-lbl">Total Locations</div>
              </div>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-icon" style={{ background: '#e3f2fd' }}>🚗</span>
              <div>
                <div className="admin-stat-val">{parkingStats?.totalSlots ?? 0}</div>
                <div className="admin-stat-lbl">Total Parking Slots</div>
              </div>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-icon" style={{ background: '#f3e5f5' }}>📋</span>
              <div>
                <div className="admin-stat-val">{bookingStats?.revenue?.count ?? 0}</div>
                <div className="admin-stat-lbl">Total Bookings</div>
              </div>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-icon" style={{ background: '#fff8e1' }}>💰</span>
              <div>
                <div className="admin-stat-val">₹{bookingStats?.revenue?.total?.toLocaleString() ?? 0}</div>
                <div className="admin-stat-lbl">Total Revenue</div>
              </div>
            </div>
          </div>

          <div className="admin-charts">
            <div className="card">
              <h3>Parking Utilization by Area</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={utilizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="utilized"  name="Occupied"  fill="#f44336" radius={[4,4,0,0]} />
                  <Bar dataKey="available" name="Available" fill="#4caf50" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>Booking Status Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={bookingByStatus} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={90} label={({name, percent}) =>
                      `${name} ${(percent*100).toFixed(0)}%`}>
                    {bookingByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>Live Traffic Congestion</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trafficData.slice(0, 10).map(t => ({
                  road: t.roadName.split(' ').slice(-2).join(' '),
                  score: t.congestionScore,
                  speed: t.averageSpeed
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="road" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" name="Congestion %" radius={[4,4,0,0]}>
                    {trafficData.slice(0,10).map((t, i) => (
                      <Cell key={i} fill={
                        t.congestionLevel === 'free'     ? '#4caf50' :
                        t.congestionLevel === 'moderate' ? '#ff9800' :
                        t.congestionLevel === 'heavy'    ? '#f44336' : '#9c27b0'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>Traffic Level Summary</h3>
              <div className="traffic-level-list">
                {trafficByLevel.map(({ name, value }) => (
                  <div key={name} className="traffic-level-row">
                    <span className="tl-dot" style={{
                      background: name === 'free' ? '#4caf50' : name === 'moderate' ? '#ff9800' :
                        name === 'heavy' ? '#f44336' : '#9c27b0'
                    }} />
                    <span className="tl-name">{name}</span>
                    <div className="tl-bar-wrap">
                      <div className="tl-bar" style={{
                        width: `${(value / Math.max(trafficData.length, 1)) * 100}%`,
                        background: name === 'free' ? '#4caf50' : name === 'moderate' ? '#ff9800' :
                          name === 'heavy' ? '#f44336' : '#9c27b0'
                      }} />
                    </div>
                    <span className="tl-count">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'slots' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Parking Slot Management</h3>
          <div className="slots-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Area</th><th>Total</th><th>Available</th>
                  <th>Price/hr</th><th>Status</th><th>Rating</th><th>Operational</th>
                </tr>
              </thead>
              <tbody>
                {slots.map(s => (
                  <tr key={s._id}>
                    <td><strong>{s.name}</strong><br /><small>{s.slotCode}</small></td>
                    <td>{s.area}</td>
                    <td>{s.totalSlots}</td>
                    <td>
                      <span style={{ color: s.availableSlots === 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                        {s.availableSlots}
                      </span>
                    </td>
                    <td>₹{s.pricePerHour}</td>
                    <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                    <td>⭐ {s.rating}</td>
                    <td>
                      <button
                        className={`toggle-btn ${s.isOperational ? 'on' : 'off'}`}
                        onClick={() => toggleSlotStatus(s._id, s.isOperational)}
                      >
                        {s.isOperational ? '✅ Active' : '⛔ Disabled'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Recent Bookings</h3>
          <div className="slots-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Booking ID</th><th>User</th><th>Location</th>
                  <th>Vehicle</th><th>Duration</th><th>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allBookings.map(b => (
                  <tr key={b._id}>
                    <td><strong>#{b.bookingId}</strong></td>
                    <td>{b.userName}<br /><small>{b.userId?.slice(-8)}</small></td>
                    <td>{b.slotName}<br /><small>{b.slotCode}</small></td>
                    <td>{b.vehicleNumber}<br /><small>{b.vehicleType}</small></td>
                    <td>{b.duration} hr</td>
                    <td><strong>₹{b.totalAmount}</strong></td>
                    <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'traffic' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Live Traffic Data</h3>
          <div className="slots-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Road</th><th>Area</th><th>Congestion</th>
                  <th>Score</th><th>Speed</th><th>Vehicles</th><th>Incident</th>
                </tr>
              </thead>
              <tbody>
                {trafficData.map((t, i) => (
                  <tr key={i}>
                    <td><strong>{t.roadName}</strong></td>
                    <td>{t.area}</td>
                    <td><span className={`badge badge-${t.congestionLevel}`}>{t.congestionLevel}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${t.congestionScore}%`,
                            background: t.congestionLevel === 'free' ? '#4caf50' :
                              t.congestionLevel === 'moderate' ? '#ff9800' : '#f44336',
                            borderRadius: 4
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, width: 28 }}>{t.congestionScore}%</span>
                      </div>
                    </td>
                    <td>{t.averageSpeed} km/h</td>
                    <td>{t.vehicleCount}</td>
                    <td>
                      {t.incidentType !== 'none'
                        ? <span className="incident-tag">{t.incidentType}</span>
                        : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
