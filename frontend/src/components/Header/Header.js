import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp  } from '../../context/AppContext';
import Notifications from '../Notifications/Notifications';
import './Header.css';

const Header = () => {
  const { user, logout }   = useAuth();
  const { unreadCount }    = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/',         label: 'Dashboard', icon: '🏠' },
    { path: '/map',      label: 'Find Parking', icon: '🗺️' },
    { path: '/bookings', label: 'My Bookings',  icon: '📋' },
    ...(user?.role === 'admin' ? [{ path: '/admin', label: 'Admin', icon: '⚙️' }] : [])
  ];

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <span className="logo-icon">🅿</span>
          <span className="logo-text">SmartPark</span>
        </Link>

        <nav className={`nav ${menuOpen ? 'nav-open' : ''}`}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <span>{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <button
            className="notif-btn"
            onClick={() => setNotifOpen(v => !v)}
            aria-label="Notifications"
          >
            🔔
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          <div className="user-menu">
            <button className="user-btn" onClick={() => setMenuOpen(v => !v)}>
              <span className="avatar">{user?.name?.charAt(0).toUpperCase()}</span>
              <span className="user-name">{user?.name?.split(' ')[0]}</span>
              <span>▾</span>
            </button>
            {menuOpen && (
              <div className="dropdown">
                <div className="dropdown-user">
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                </div>
                <hr />
                {navItems.map(item => (
                  <Link
                    key={item.path} to={item.path}
                    className="dropdown-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.icon} {item.label}
                  </Link>
                ))}
                <hr />
                <button className="dropdown-item danger" onClick={handleLogout}>
                  🚪 Logout
                </button>
              </div>
            )}
          </div>

          <button className="hamburger" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {notifOpen && <Notifications onClose={() => setNotifOpen(false)} />}
    </header>
  );
};

export default Header;
