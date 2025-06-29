// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Link, NavLink, useLocation } from 'react-router-dom';
import HomePage from './HomePage';
import MoviePage from './MoviePage';
import SeatMap from './SeatMap';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ProtectedRoute from './ProtectedRoute';
import AdminPage from './AdminPage';
import OrderConfirmationPage from './OrderConfirmationPage';
import PaymentPage from './Paymentpage';
import './App.css';

const AppLayout = () => {
    const navigate = useNavigate();
    const location = useLocation(); // <-- Get current location
    const token = localStorage.getItem('token');
    let isAdmin = false;

    // Define which paths should have the minimal header
    const authPaths = ['/login', '/register'];
    const isAuthPage = authPaths.includes(location.pathname);

    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            isAdmin = payload.isAdmin === 1;
        } catch (e) { console.error("Error decoding token:", e); }
    }

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="App">
            {/* Conditionally render the header based on the page */}
            <header className={`App-header ${isAuthPage ? 'minimal-header' : 'full-header'}`}>
                <div className="header-content">
                    <Link to="/" className="header-logo"><h1>CineBook</h1></Link>
                    
                    {/* Only show full navigation on non-auth pages */}
                    {!isAuthPage && (
                        <>
                            <nav className="header-nav">
                                <NavLink to="/" className="nav-link" end>Movies</NavLink>
                                {isAdmin && <NavLink to="/admin" className="nav-link">Admin</NavLink>}
                            </nav>
                            <div className="user-actions">
                                {token ? (
                                    <button onClick={handleLogout} className="logout-button">Logout</button>
                                ) : (
                                    <Link to="/login" className="cta-button auth-button">Login</Link>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </header>
            
            {/* Add a wrapper class for auth pages to handle layout */}
            <main className={isAuthPage ? 'auth-main' : ''}>
                <div className={isAuthPage ? '' : 'main-container'}>
                  <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
                      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                      <Route path="/show/:id" element={<ProtectedRoute><SeatMap /></ProtectedRoute>} />
                      <Route path="/movie/:id" element={<ProtectedRoute><MoviePage /></ProtectedRoute>} />
                      <Route path="/confirm-booking" element={<ProtectedRoute><OrderConfirmationPage /></ProtectedRoute>} />
                      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                  </Routes>
                </div>
            </main>
        </div>
    );
};

function App() {
    return (
        <Router>
            <AppLayout />
        </Router>
    );
}

export default App;