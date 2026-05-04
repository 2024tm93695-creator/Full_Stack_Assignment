import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthContext } from '../context/AuthContext';

const mockLogin = jest.fn();
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

const renderLogin = (loginFn = mockLogin) =>
  render(
    <AuthContext.Provider value={{ login: loginFn, user: null, loading: false }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );

beforeEach(() => {
  mockLogin.mockReset();
  mockNavigate.mockReset();
});

describe('LoginPage', () => {
  test('renders email, password fields and sign-in button', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('renders demo account buttons', () => {
    renderLogin();
    expect(screen.getByText(/User/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin/i)).toBeInTheDocument();
  });

  test('fills demo user credentials on demo button click', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /👤 User/i }));
    expect(screen.getByPlaceholderText(/you@example\.com/i).value).toBe('user@demo.com');
  });

  test('fills demo admin credentials on admin button click', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /⚙️ Admin/i }));
    expect(screen.getByPlaceholderText(/you@example\.com/i).value).toBe('admin@demo.com');
  });

  test('calls login and navigates to / for regular user', async () => {
    mockLogin.mockResolvedValue({ role: 'user', email: 'user@demo.com' });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'user@demo.com' } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: 'demo123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@demo.com', 'demo123');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('calls login and navigates to /admin for admin user', async () => {
    mockLogin.mockResolvedValue({ role: 'admin', email: 'admin@demo.com' });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'admin@demo.com' } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: 'admin123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });

  test('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue({ response: { data: { error: 'Invalid email or password' } } });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'bad@email.com' } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
  });

  test('disables submit button while loading', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {})); // never resolves
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'user@demo.com' } });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: 'demo123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled());
  });
});
