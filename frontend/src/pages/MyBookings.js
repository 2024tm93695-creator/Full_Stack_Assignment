import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';
import './MyBookings.css';

const STATUS_FILTERS = ['all', 'confirmed', 'active', 'completed', 'cancelled'];

const MyBookings = () => {
  const [bookings,    setBookings]   = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [filter,      setFilter]     = useState('all');
  const [qrBooking,   setQrBooking]  = useState(null);
  const [checkinId,   setCheckinId]  = useState(null);
  const [otp,         setOtp]        = useState('');
  const [otpError,    setOtpError]   = useState('');
  const [cancelLoading, setCancelLoading] = useState(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await api.get(`/api/parking/bookings${params}`);
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [filter]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancelLoading(id);
    try {
      await api.put(`/api/parking/bookings/${id}/cancel`);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.error || 'Cancel failed');
    } finally {
      setCancelLoading(null);
    }
  };

  const handleCheckIn = async (bookingId) => {
    setOtpError('');
    try {
      await api.post(`/api/parking/bookings/${bookingId}/checkin`, { otp });
      setCheckinId(null);
      setOtp('');
      fetchBookings();
      alert('✅ Checked in successfully!');
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Invalid OTP');
    }
  };

  return (
    <div className="page-container">
      <div className="bookings-header">
        <h1>My Bookings</h1>
        <div className="filter-tabs">
          {STATUS_FILTERS.map(s => (
            <button key={s} className={`filter-tab ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : bookings.length === 0 ? (
        <div className="empty-state card">
          <span>📋</span>
          <p>No {filter !== 'all' ? filter : ''} bookings found</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {bookings.map(b => (
            <div key={b._id} className={`booking-card card status-${b.status}`}>
              <div className="bcard-header">
                <div>
                  <h3>{b.slotName}</h3>
                  <p>📍 {b.slotAddress}</p>
                </div>
                <span className={`badge badge-${b.status}`}>{b.status}</span>
              </div>

              <div className="bcard-details">
                <div className="detail-grid">
                  <div><label>Booking ID</label><span>#{b.bookingId}</span></div>
                  <div><label>Vehicle</label><span>🚗 {b.vehicleNumber}</span></div>
                  <div><label>Check-in</label><span>{new Date(b.startTime).toLocaleString()}</span></div>
                  <div><label>Check-out</label><span>{new Date(b.endTime).toLocaleString()}</span></div>
                  <div><label>Duration</label><span>{b.duration} hr</span></div>
                  <div><label>Amount</label><span className="amount">₹{b.totalAmount}</span></div>
                </div>
              </div>

              <div className="bcard-actions">
                {(b.status === 'confirmed' || b.status === 'active') && (
                  <button className="btn btn-primary btn-sm"
                    onClick={() => setQrBooking(b)}>
                    📱 QR / OTP
                  </button>
                )}
                {b.status === 'confirmed' && !b.checkedIn && (
                  <button className="btn btn-success btn-sm"
                    onClick={() => { setCheckinId(b._id); setOtp(''); setOtpError(''); }}>
                    ✅ Check In
                  </button>
                )}
                {['confirmed', 'active'].includes(b.status) && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleCancel(b._id)}
                    disabled={cancelLoading === b._id}
                  >
                    {cancelLoading === b._id ? '⏳' : '❌ Cancel'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrBooking && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setQrBooking(null)}>
          <div className="modal-box qr-modal">
            <div className="modal-header">
              <h2>📱 Entry Pass</h2>
              <button className="modal-close" onClick={() => setQrBooking(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div className="qr-section">
                <QRCodeSVG
                  value={JSON.stringify({
                    bookingId: qrBooking.bookingId,
                    otp: qrBooking.otp,
                    slot: qrBooking.slotCode
                  })}
                  size={180}
                  level="H"
                  includeMargin
                />
                <p className="qr-hint">Scan at the parking gate</p>
              </div>
              <div className="otp-box">
                <span>Entry OTP</span>
                <div className="otp-digits">
                  {qrBooking.otp?.split('').map((d, i) => <span key={i}>{d}</span>)}
                </div>
              </div>
              <div className="success-details" style={{ textAlign: 'left' }}>
                <div className="detail-row"><span>Location</span><strong>{qrBooking.slotName}</strong></div>
                <div className="detail-row"><span>Booking ID</span><strong>#{qrBooking.bookingId}</strong></div>
                <div className="detail-row"><span>Vehicle</span><strong>{qrBooking.vehicleNumber}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in OTP modal */}
      {checkinId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCheckinId(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2>✅ Check In</h2>
              <button className="modal-close" onClick={() => setCheckinId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-light)' }}>
                Enter your 6-digit OTP to check in.
              </p>
              {otpError && <div className="error-msg">{otpError}</div>}
              <div className="form-group">
                <label>OTP</label>
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setCheckinId(null)}>Cancel</button>
                <button
                  className="btn btn-success"
                  disabled={otp.length !== 6}
                  onClick={() => handleCheckIn(checkinId)}
                >
                  Verify & Check In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
