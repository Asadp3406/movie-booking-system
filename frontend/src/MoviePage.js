// frontend/src/MoviePage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const MoviePage = () => {
    const [movie, setMovie] = useState(null);
    const [shows, setShows] = useState([]);
    const [error, setError] = useState('');
    const { id } = useParams();

    useEffect(() => {
        const fetchMovieAndShows = async () => {
            try {
                const response = await fetch(`http://localhost:8080/api/movies/${id}`);
                if (!response.ok) throw new Error('Could not fetch movie details.');
                const data = await response.json();
                setMovie(data.movie);
                setShows(data.shows);
            } catch (err) {
                setError(err.message);
            }
        };
        fetchMovieAndShows();
    }, [id]);

    if (error) return <div className="error-message">Error: {error}</div>;
    if (!movie) return <div>Loading...</div>;

    return (
        <div className="movie-page">
            <div className="movie-details-header">
                <img src={movie.posterUrl} alt={`${movie.title} poster`} className="movie-details-poster" />
                <div className="movie-details-info">
                    <h1>{movie.title}</h1>
                    <h3>Select a Show Time:</h3>
                    <div className="show-times">
                        {shows.map(show => (
                            <Link to={`/show/${show.id}`} key={show.id} className="cta-button show-time-button">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                                </svg>
                                {new Date(show.showTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoviePage;