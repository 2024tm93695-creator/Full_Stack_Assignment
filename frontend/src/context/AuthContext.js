import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/api/auth/profile')
        .then(res => setUser(res.data))
        .catch(()  => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const { token, user: u } = res.data;
    _persist(token, u);
    setUser(u);
    return u;
  };

  const register = async (data) => {
    const res = await api.post('/api/auth/register', data);
    const { token, user: u } = res.data;
    _persist(token, u);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['x-user-id'];
    setUser(null);
  };

  const _persist = (token, u) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['x-user-id']     = u.id;
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
