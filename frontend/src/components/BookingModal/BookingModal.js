import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './BookingModal.css';

const BookingModal = ({ slot, onClose, onSuccess }) => {
  const { user } = useAuth();

  const now    = new Date();
  const inOneH = new Date(now.getTime() + 3600000);
  const fmtLocal = (d) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [form, setForm] = useState({
    vehicleNumber: user?.vehicleNumber || '',
    vehicleType:   user?.vehicleType   || 'car',
    startTime:     fmtLocal(now),
    endTime:       fmtLocal(inOneH)
  });
  const [step,    setStep]    = useState('form');   // form | confirm | success
  const [booking, setBooking] = useState(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const duration = Math.max(1, Math.ceil(
    (new Date(form.endTime) - new Date(form.startTime)) / 3600000
  ));
  const totalAmount = duration * slot.pricePerHour;

  const handleBook = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/parking/bookings', {
        slotId: slot._id,
        vehicleNumber: form.vehicleNumber,
        vehicleType:   form.vehicleType,
        startTime:     form.startTime,
        endTime:       form.endTime,
        userName:      user?.name
      });
      setBooking(res.data);
      setStep('success');
      onSuccess?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed. Please try again.');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>{step === 'success' ? '🎉 Booking Confirmed!' : `Book — ${slot.name}`}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {step === 'form' && (
          <div className="modal-body">
            <div className="slot-summary">
              <div className="slot-info-row"><span>📍</span><span>{slot.address}</span></div>
              <div className="slot-info-row"><span>💰</span><span>₹{slot.pricePerHour}/hour</span></div>
              <div className="slot-info-row"><span>🅿</span>
                <span>{slot.availableSlots} / {slot.totalSlots} slots available</span>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label>Vehicle Number *</label>
                <input
                  type="text"
                  placeholder="TS09AB1234"
                  value={form.vehicleNumber}
                  onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Vehicle Type *</label>
                <select value={form.vehicleType}
                  onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}>
                  {slot.vehicleTypes.map(v => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Start Time *</label>
                <input
                  type="datetime-local"
                  value={form.startTime}
                  min={fmtLocal(now)}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>End Time *</label>
                <input
                  type="datetime-local"
                  value={form.endTime}
                  min={form.startTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="price-summary">
              <div className="price-row"><span>Duration</span><strong>{duration} hour{duration > 1 ? 's' : ''}</strong></div>
              <div className="price-row"><span>Rate</span><strong>₹{slot.pricePerHour}/hr</strong></div>
              <div className="price-row total"><span>Total</span><strong>₹{totalAmount}</strong></div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-success"
                disabled={loading || !form.vehicleNumber || duration < 1}
                onClick={() => setStep('confirm')}
              >
                Review Booking →
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="modal-body">
            <div className="confirm-box">
              <h4>Confirm Your Booking</h4>
              <table className="confirm-table">
                <tbody>
                  <tr><td>Location</td><td><strong>{slot.name}</strong></td></tr>
                  <tr><td>Vehicle</td><td><strong>{form.vehicleNumber} ({form.vehicleType})</strong></td></tr>
                  <tr><td>Check-in</td><td><strong>{new Date(form.startTime).toLocaleString()}</strong></td></tr>
                  <tr><td>Check-out</td><td><strong>{new Date(form.endTime).toLocaleString()}</strong></td></tr>
                  <tr><td>Duration</td><td><strong>{duration} hour{duration > 1 ? 's' : ''}</strong></td></tr>
                  <tr className="total-row"><td>Total</td><td><strong>₹{totalAmount}</strong></td></tr>
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setStep('form')}>← Edit</button>
              <button className="btn btn-primary" onClick={handleBook} disabled={loading}>
                {loading ? '⏳ Processing…' : '✅ Confirm & Pay ₹' + totalAmount}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && booking && (
          <div className="modal-body success-body">
            <div className="qr-section">
              <QRCodeSVG
                value={JSON.stringify({ bookingId: booking.bookingId, otp: booking.otp, slot: booking.slotCode })}
                size={160}
                level="H"
                includeMargin
              />
              <p className="qr-hint">Scan at entry gate</p>
            </div>

            <div className="otp-box">
              <span>Your OTP</span>
              <div className="otp-digits">
                {booking.otp?.split('').map((d, i) => <span key={i}>{d}</span>)}
              </div>
            </div>

            <div className="success-details">
              <div className="detail-row"><span>Booking ID</span><strong>#{booking.bookingId}</strong></div>
              <div className="detail-row"><span>Location</span><strong>{booking.slotName}</strong></div>
              <div className="detail-row"><span>Vehicle</span><strong>{booking.vehicleNumber}</strong></div>
              <div className="detail-row"><span>Duration</span><strong>{booking.duration} hr</strong></div>
              <div className="detail-row"><span>Amount Paid</span><strong>₹{booking.totalAmount}</strong></div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingModal;
