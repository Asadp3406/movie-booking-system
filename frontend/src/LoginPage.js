// frontend/src/LoginPage.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!response.ok) {
                throw new Error('Login failed');
            }
            const data = await response.json();
            localStorage.setItem('token', data.accessToken);
            navigate('/');
        } catch (err) {
            setError('Invalid email or password.');
        }
    };

    return (
        <div className="auth-page-container">
            <div className="auth-art-section"></div>
            <div className="auth-form-section">
                <div className="form-container">
                    <form onSubmit={handleLogin}>
                        <h2>Welcome Back!</h2>
                        <p className="form-subtitle">Login to book your next cinematic adventure.</p>
                        
                        <div className="input-group">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z"/></svg>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" required />
                        </div>

                        <div className="input-group">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 9h6v5H5V9z"/></svg>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
                        </div>
                        
                        <div className="form-options">
                            <a href="#" className="forgot-password-link">Forgot Password?</a>
                        </div>
                        
                        {error && <p className="error-message auth-error">{error}</p>}
                        
                        <button type="submit" className="cta-button form-submit-button">Login</button>
                        
                        <div className="separator">or</div>

                        <button type="button" className="social-button google">Continue with Google</button>

                        <p className="form-footer-text">
                            Don't have an account? <Link to="/register">Sign Up</Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;