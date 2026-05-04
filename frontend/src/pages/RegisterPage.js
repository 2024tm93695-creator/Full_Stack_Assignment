import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    vehicleNumber: '', vehicleType: 'car'
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const f = (field) => ({
    value: form[field],
    onChange: (e) => setForm(p => ({ ...p, [field]: e.target.value }))
  });

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card auth-card-lg">
        <div className="auth-logo">
          <span>🅿</span>
          <h1>SmartPark</h1>
        </div>

        <h2>Create Account</h2>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label>Full Name *</label>
              <input type="text" placeholder="Your name" {...f('name')} required />
            </div>
            <div className="form-group">
              <label>Email Address *</label>
              <input type="email" placeholder="you@example.com" {...f('email')} required />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" placeholder="Choose a password" {...f('password')} required />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" placeholder="+91 98765 43210" {...f('phone')} />
            </div>
            <div className="form-group">
              <label>Vehicle Number</label>
              <input type="text" placeholder="TS09AB1234" {...f('vehicleNumber')} />
            </div>
            <div className="form-group">
              <label>Vehicle Type</label>
              <select {...f('vehicleType')}>
                <option value="car">🚗 Car</option>
                <option value="bike">🏍 Bike</option>
                <option value="truck">🚛 Truck</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
            {loading ? <><span className="spinner-sm" /> Creating account...</> : 'Create Account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
