import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../pages/RegisterPage';
import { AuthContext } from '../context/AuthContext';

const mockRegister = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

const renderRegister = () =>
  render(
    <AuthContext.Provider value={{ register: mockRegister, user: null, loading: false }}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

beforeEach(() => {
  mockRegister.mockReset();
  mockNavigate.mockReset();
});

describe('RegisterPage', () => {
  test('renders all registration form fields', () => {
    renderRegister();
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/choose a password/i)).toBeInTheDocument();
  });

  test('renders vehicle type dropdown with options', () => {
    renderRegister();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/car/i)).toBeInTheDocument();
  });

  test('shows link to login page', () => {
    renderRegister();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  test('calls register and navigates to / on success', async () => {
    mockRegister.mockResolvedValue({ role: 'user' });
    renderRegister();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'priya@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/choose a password/i), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('shows error on register failure', async () => {
    mockRegister.mockRejectedValue({ response: { data: { error: 'Email already registered' } } });
    renderRegister();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Priya' } });
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'exists@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/choose a password/i), { target: { value: 'pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(screen.getByText(/email already registered/i)).toBeInTheDocument());
  });
});
