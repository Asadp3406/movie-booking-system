// frontend/src/HomePage.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
    const [movies, setMovies] = useState([]);
    const [featuredMovie, setFeaturedMovie] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchMovies = async () => {
            try {
                const response = await fetch('http://localhost:8080/api/movies');
                if (!response.ok) throw new Error('Could not fetch movies.');
                const data = await response.json();
                
                // Feature the first movie in the list
                setFeaturedMovie(data.movies[0] || null);
                setMovies(data.movies);
            } catch (err) {
                setError(err.message);
            }
        };
        fetchMovies();
    }, []);

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    return (
        <div className="homepage">
            {featuredMovie && (
                <div className="hero-section" style={{ backgroundImage: `url(${featuredMovie.posterUrl})` }}>
                    <div className="hero-overlay"></div>
                    <div className="hero-content">
                        <h1 className="hero-title">{featuredMovie.title}</h1>
                        <p className="hero-subtitle">Now available for booking. Get your tickets now!</p>
                        <Link to={`/movie/${featuredMovie.id}`} className="cta-button hero-button">
                            Book Tickets
                        </Link>
                    </div>
                    <a href="#recommended" className="scroll-indicator">
                        <span></span>
                    </a>
                </div>
            )}

            <div id="recommended" className="recommended-section">
                <h2>Now Showing</h2>
                <div className="movie-grid">
                    {movies.map((movie, index) => (
                        <Link to={`/movie/${movie.id}`} key={movie.id} className="movie-card" style={{animationDelay: `${index * 100}ms`}}>
                            <img src={movie.posterUrl} alt={`${movie.title} poster`} />
                            <div className="movie-card-overlay">
                                <h3>{movie.title}</h3>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomePage;