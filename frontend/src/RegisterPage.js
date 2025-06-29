// frontend/src/RegisterPage.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const response = await fetch('http://localhost:8080/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
             if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Registration failed');
            }
            setSuccess('Registration successful! Redirecting to login...');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="auth-page-container">
            <div className="auth-art-section"></div>
            <div className="auth-form-section">
                <div className="form-container">
                    <form onSubmit={handleRegister}>
                        <h2>Create Your Account</h2>
                        <p className="form-subtitle">Join CineBook to book tickets for the latest movies</p>

                        <div className="input-group">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757zm3.436-.586L16 11.801V4.697l-5.803 3.546z"/></svg>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" required />
                        </div>

                        <div className="input-group">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 9h6v5H5V9z"/></svg>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
                        </div>
                        
                        {error && <p className="error-message auth-error">{error}</p>}
                        {success && <p className="status-message auth-success">{success}</p>}

                        <button type="submit" className="cta-button form-submit-button">Create Account</button>
                        
                        <p className="form-footer-text">
                            Already have an account? <Link to="/login">Login</Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;