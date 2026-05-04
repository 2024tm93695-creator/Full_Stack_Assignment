import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { AuthContext } from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import api from '../services/api';

jest.mock('../services/api');

const mockUser = { id: 'u1', name: 'Priya Sharma', role: 'user' };

const mockTrafficData = [
  { roadName: 'Cyber Towers Road', area: 'HITEC City', congestionLevel: 'heavy',    congestionScore: 78 },
  { roadName: 'Madhapur Road',     area: 'Madhapur',   congestionLevel: 'moderate', congestionScore: 52 },
  { roadName: 'Gachibowli',        area: 'Gachibowli', congestionLevel: 'free',     congestionScore: 21 },
];

const mockNotifications = [
  { _id: 'n1', title: 'Booking Confirmed', message: 'Slot reserved', isRead: false }
];

const renderDashboard = () =>
  render(
    <AuthContext.Provider value={{ user: mockUser, loading: false }}>
      <AppContext.Provider value={{ trafficData: mockTrafficData, notifications: mockNotifications }}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </AppContext.Provider>
    </AuthContext.Provider>
  );

beforeEach(() => {
  api.get.mockImplementation((url) => {
    if (url.includes('stats')) return Promise.resolve({ data: { totalSlots: 610, availableSlots: 172, totalLocations: 12 } });
    if (url.includes('bookings')) return Promise.resolve({ data: { bookings: [] } });
    return Promise.resolve({ data: {} });
  });
});

describe('Dashboard', () => {
  test('renders greeting with user first name', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/Priya/i)).toBeInTheDocument());
  });

  test('renders stat cards', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/available slots/i)).toBeInTheDocument();
      expect(screen.getByText(/parking locations/i)).toBeInTheDocument();
      expect(screen.getByText(/avg congestion/i)).toBeInTheDocument();
      expect(screen.getByText(/my bookings/i)).toBeInTheDocument();
    });
  });

  test('renders live traffic status section', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/live traffic status/i)).toBeInTheDocument());
  });

  test('renders congestion levels from traffic data', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/heavy/i)).toBeInTheDocument();
      expect(screen.getByText(/moderate/i)).toBeInTheDocument();
      expect(screen.getByText(/free/i)).toBeInTheDocument();
    });
  });

  test('renders find parking and my bookings buttons', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/find parking/i)).toBeInTheDocument();
      expect(screen.getByText(/my bookings/i)).toBeInTheDocument();
    });
  });

  test('renders notifications section', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/recent alerts/i)).toBeInTheDocument());
  });

  test('shows empty bookings state when no bookings', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument());
  });

  test('shows active alert for heavy congestion road', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/cyber towers road/i)).toBeInTheDocument());
  });
});
