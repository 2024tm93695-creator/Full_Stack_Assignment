import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import PrivateRoute from './routes/PrivateRoute';
import Header from './components/Header/Header';
import TrafficTicker from './components/TrafficTicker/TrafficTicker';
import ToastContainer from './components/Notifications/ToastContainer';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ParkingMap from './pages/ParkingMap';
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

const WithHeader = ({ children }) => (
  <>
    <Header />
    <TrafficTicker />
    <main style={{ paddingTop: '98px', minHeight: 'calc(100vh - 98px)' }}>
      {children}
    </main>
  </>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppProvider>
          <div className="app">
            <Routes>
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              <Route path="/" element={
                <PrivateRoute>
                  <WithHeader><Dashboard /></WithHeader>
                </PrivateRoute>
              } />
              <Route path="/map" element={
                <PrivateRoute>
                  <WithHeader><ParkingMap /></WithHeader>
                </PrivateRoute>
              } />
              <Route path="/bookings" element={
                <PrivateRoute>
                  <WithHeader><MyBookings /></WithHeader>
                </PrivateRoute>
              } />
              <Route path="/admin" element={
                <PrivateRoute adminOnly>
                  <WithHeader><AdminDashboard /></WithHeader>
                </PrivateRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ToastContainer />
          </div>
        </AppProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
