import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import BookingModal from '../components/BookingModal/BookingModal';
import 'leaflet/dist/leaflet.css';
import './ParkingMap.css';

// Fix Leaflet default icon path issue in CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl:       require('leaflet/dist/images/marker-icon.png'),
  shadowUrl:     require('leaflet/dist/images/marker-shadow.png'),
});

const makeIcon = (color, emoji) => L.divIcon({
  className: '',
  html: `<div style="
    background:${color};color:#fff;width:36px;height:36px;
    border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid #fff;font-size:14px;">
    <span style="transform:rotate(45deg)">${emoji}</span>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -38]
});

const ICONS = {
  available: makeIcon('#4caf50', '🅿'),
  occupied:  makeIcon('#f44336', '🚫'),
  reserved:  makeIcon('#ff9800', '⏳'),
  closed:    makeIcon('#9e9e9e', '🔒')
};

const TRAFFIC_COLORS = { free: '#4caf5040', moderate: '#ff980050', heavy: '#ff572250', severe: '#d32f2f60' };

const CENTER = [17.4435, 78.3733]; // Hyderabad HITEC City

const FlyToSlot = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 16, { duration: 1 });
  }, [coords, map]);
  return null;
};

const ParkingMap = () => {
  const { trafficData } = useApp();
  const [slots,          setSlots]         = useState([]);
  const [filtered,       setFiltered]      = useState([]);
  const [selectedSlot,   setSelectedSlot]  = useState(null);
  const [bookingSlot,    setBookingSlot]   = useState(null);
  const [flyTo,          setFlyTo]         = useState(null);
  const [showTraffic,    setShowTraffic]   = useState(true);
  const [loading,        setLoading]       = useState(true);
  const [filters, setFilters] = useState({
    vehicleType: '', status: '', maxPrice: '', area: ''
  });

  const fetchSlots = useCallback(async () => {
    try {
      const res = await api.get('/api/parking/slots?limit=50');
      setSlots(res.data.slots || []);
      setFiltered(res.data.slots || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  useEffect(() => {
    let result = [...slots];
    if (filters.vehicleType) result = result.filter(s => s.vehicleTypes.includes(filters.vehicleType));
    if (filters.status)      result = result.filter(s => s.status === filters.status);
    if (filters.area)        result = result.filter(s => s.area.toLowerCase().includes(filters.area.toLowerCase()));
    if (filters.maxPrice)    result = result.filter(s => s.pricePerHour <= Number(filters.maxPrice));
    setFiltered(result);
  }, [filters, slots]);

  const handleBookingSuccess = (booking) => {
    setBookingSlot(null);
    fetchSlots();
    setSelectedSlot(null);
  };

  const getStatusColor = (status) => ({
    available: '#4caf50', occupied: '#f44336', reserved: '#ff9800', closed: '#9e9e9e'
  }[status] || '#9e9e9e');

  return (
    <div className="map-page">
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <input
            className="filter-input"
            placeholder="🔍 Search area…"
            value={filters.area}
            onChange={e => setFilters(f => ({ ...f, area: e.target.value }))}
          />
        </div>
        <select className="filter-select" value={filters.vehicleType}
          onChange={e => setFilters(f => ({ ...f, vehicleType: e.target.value }))}>
          <option value="">All Vehicles</option>
          <option value="car">🚗 Car</option>
          <option value="bike">🏍 Bike</option>
          <option value="truck">🚛 Truck</option>
        </select>
        <select className="filter-select" value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="available">🟢 Available</option>
          <option value="occupied">🔴 Occupied</option>
          <option value="reserved">🟡 Reserved</option>
        </select>
        <select className="filter-select" value={filters.maxPrice}
          onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}>
          <option value="">Any Price</option>
          <option value="20">Up to ₹20/hr</option>
          <option value="40">Up to ₹40/hr</option>
          <option value="60">Up to ₹60/hr</option>
        </select>
        <label className="toggle-label">
          <input type="checkbox" checked={showTraffic}
            onChange={e => setShowTraffic(e.target.checked)} />
          <span>Traffic Overlay</span>
        </label>
        <span className="filter-count">{filtered.length} locations</span>
      </div>

      <div className="map-layout">
        {/* Map */}
        <div className="map-wrap">
          <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
            />

            {flyTo && <FlyToSlot coords={flyTo} />}

            {/* Traffic overlay circles */}
            {showTraffic && trafficData.map((t, i) => (
              <Circle
                key={i}
                center={[t.location?.coordinates?.[1], t.location?.coordinates?.[0]]}
                radius={600}
                pathOptions={{
                  fillColor: TRAFFIC_COLORS[t.congestionLevel] || '#ccc',
                  fillOpacity: 0.5,
                  color: 'transparent'
                }}
              />
            ))}

            {/* Parking slot markers */}
            {filtered.map(slot => {
              const [lng, lat] = slot.location.coordinates;
              return (
                <Marker
                  key={slot._id}
                  position={[lat, lng]}
                  icon={ICONS[slot.status] || ICONS.available}
                  eventHandlers={{ click: () => setSelectedSlot(slot) }}
                >
                  <Popup maxWidth={280}>
                    <div className="map-popup">
                      <h4>{slot.name}</h4>
                      <p className="popup-addr">📍 {slot.address}</p>
                      <div className="popup-row">
                        <span className={`badge badge-${slot.status}`}>{slot.status}</span>
                        <span className="popup-price">₹{slot.pricePerHour}/hr</span>
                        <span className="popup-rating">⭐ {slot.rating}</span>
                      </div>
                      <div className="popup-slots">
                        <span>{slot.availableSlots} / {slot.totalSlots} slots free</span>
                      </div>
                      <div className="popup-tags">
                        {slot.facilities?.slice(0, 3).map(f => (
                          <span key={f} className="tag">{f}</span>
                        ))}
                      </div>
                      {slot.status !== 'occupied' && slot.status !== 'closed' && (
                        <button
                          className="btn btn-primary btn-sm popup-book"
                          onClick={() => setBookingSlot(slot)}
                        >
                          Book Now
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map legend */}
          <div className="map-legend">
            <div className="legend-item"><span style={{ background: '#4caf50' }} />Available</div>
            <div className="legend-item"><span style={{ background: '#ff9800' }} />Reserved</div>
            <div className="legend-item"><span style={{ background: '#f44336' }} />Occupied</div>
            {showTraffic && <div className="legend-item"><span style={{ background: '#ff5722' }} />Traffic</div>}
          </div>
        </div>

        {/* Slot list panel */}
        <div className="slot-panel">
          <div className="slot-panel-header">
            <h3>Nearby Parking</h3>
            <small>{filtered.length} found</small>
          </div>
          <div className="slot-list">
            {loading ? (
              <div className="loading-spinner"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><span>🔍</span><p>No parking spots match your filters</p></div>
            ) : filtered.map(slot => (
              <div
                key={slot._id}
                className={`slot-card ${selectedSlot?._id === slot._id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedSlot(slot);
                  const [lng, lat] = slot.location.coordinates;
                  setFlyTo([lat, lng]);
                }}
              >
                <div className="slot-card-top">
                  <div>
                    <strong>{slot.name}</strong>
                    <small>📍 {slot.area}</small>
                  </div>
                  <span className={`badge badge-${slot.status}`}>{slot.status}</span>
                </div>
                <div className="slot-card-mid">
                  <span className="slot-avail" style={{ color: getStatusColor(slot.status) }}>
                    {slot.availableSlots}/{slot.totalSlots} free
                  </span>
                  <span className="slot-price">₹{slot.pricePerHour}/hr</span>
                  <span className="slot-rating">⭐ {slot.rating}</span>
                </div>
                <div className="slot-tags">
                  {slot.vehicleTypes.map(v => <span key={v} className="vehicle-tag">{v}</span>)}
                  {slot.facilities?.slice(0, 2).map(f => <span key={f} className="tag">{f}</span>)}
                </div>
                {slot.status !== 'occupied' && slot.status !== 'closed' && (
                  <button
                    className="btn btn-primary btn-sm slot-book-btn"
                    onClick={e => { e.stopPropagation(); setBookingSlot(slot); }}
                  >
                    Book Slot
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {bookingSlot && (
        <BookingModal
          slot={bookingSlot}
          onClose={() => setBookingSlot(null)}
          onSuccess={handleBookingSuccess}
        />
      )}
    </div>
  );
};

export default ParkingMap;
