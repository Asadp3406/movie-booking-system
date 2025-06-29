// frontend/src/AdminPage.js
import React, { useState, useEffect } from 'react';

const AdminPage = () => {
    const [movies, setMovies] = useState([]);
    const [newMovieTitle, setNewMovieTitle] = useState('');
    const [newMovieImageFile, setNewMovieImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [selectedMovieForShow, setSelectedMovieForShow] = useState('');
    const [newShowTime, setNewShowTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const token = localStorage.getItem('token');

    const fetchMovies = async () => {
        try {
            const response = await fetch('http://localhost:8080/api/admin/movies', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch movies. Are you an admin?');
            const data = await response.json();
            setMovies(data.movies);
            if (data.movies.length > 0 && !selectedMovieForShow) {
                setSelectedMovieForShow(data.movies[0].id);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        fetchMovies();
    }, []);

    const handleImageChange = (e) => {
        if (e.target.files[0]) {
            setNewMovieImageFile(e.target.files[0]);
            setImagePreview(URL.createObjectURL(e.target.files[0]));
        }
    };

    // --- THIS FUNCTION IS NOW UPDATED TO USE IMGBB ---
    const handleAddMovie = async (e) => {
        e.preventDefault();
        if (!newMovieImageFile) {
            setError("Please select a poster image to upload.");
            return;
        }
        setError(''); setSuccess(''); setLoading(true);

        // Step 1: Prepare the data for ImgBB API
        const formData = new FormData();
        formData.append('image', newMovieImageFile);
        
        try {
            // Step 2: Upload the image to ImgBB
            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.REACT_APP_IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData,
            });

            if (!imgbbResponse.ok) throw new Error('Failed to upload image to ImgBB.');
            
            const imgbbData = await imgbbResponse.json();
            if (!imgbbData.success) throw new Error(`ImgBB Error: ${imgbbData.error.message}`);
            
            const posterUrl = imgbbData.data.url;

            // Step 3: Save the movie to our own backend with the new ImgBB URL
            const movieResponse = await fetch('http://localhost:8080/api/admin/movies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify({ title: newMovieTitle, posterUrl: posterUrl }),
            });

            if (!movieResponse.ok) {
                const errData = await movieResponse.json(); throw new Error(errData.error || 'Failed to add movie');
            }
            
            setNewMovieTitle('');
            setNewMovieImageFile(null);
            setImagePreview('');
            setSuccess('Movie added successfully!');
            fetchMovies();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    // (The functions for handleAddShow and handleDeleteMovie remain unchanged)
    const handleAddShow = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        try {
            const response = await fetch('http://localhost:8080/api/admin/shows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify({ movieId: selectedMovieForShow, showTime: newShowTime }),
            });
            if (!response.ok) {
                const errData = await response.json(); throw new Error(errData.error || 'Failed to add show');
            }
            setNewShowTime('');
            setSuccess('Show added successfully!');
        } catch (err) { setError(err.message); }
    };
    const handleDeleteMovie = async (movieId) => {
        if (!window.confirm('Are you sure you want to delete this movie and all of its shows?')) return;
        setError(''); setSuccess('');
        try {
            const response = await fetch(`http://localhost:8080/api/admin/movies/${movieId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}`},
            });
            if (!response.ok) {
                const errData = await response.json(); throw new Error(errData.error || 'Failed to delete movie');
            }
            setSuccess('Movie deleted successfully!');
            fetchMovies();
        } catch (err) { setError(err.message); }
    };

    return (
        <div className="admin-dashboard">
            <h2>Admin Dashboard</h2>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="status-message">{success}</p>}
            
            <div className="admin-section">
                <h3>Add New Movie</h3>
                <form onSubmit={handleAddMovie} className="admin-form">
                    <input type="text" value={newMovieTitle} onChange={e => setNewMovieTitle(e.target.value)} placeholder="Movie Title" required />
                    <label htmlFor="image-upload" className="custom-file-upload">
                        {newMovieImageFile ? 'Image Selected!' : 'Upload Poster Image'}
                    </label>
                    <input id="image-upload" type="file" onChange={handleImageChange} accept="image/*" required />
                    {imagePreview && <img src={imagePreview} alt="Poster preview" className="image-preview"/>}
                    <button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Add Movie'}</button>
                </form>
            </div>

            <div className="admin-section">
                <h3>Add New Show Time</h3>
                <form onSubmit={handleAddShow} className="admin-form">
                    <select value={selectedMovieForShow} onChange={e => setSelectedMovieForShow(e.target.value)} required>
                        <option value="" disabled>Select a Movie</option>
                        {movies.map(movie => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
                    </select>
                    <input type="datetime-local" value={newShowTime} onChange={e => setNewShowTime(e.target.value)} required />
                    <button type="submit">Add Show</button>
                </form>
            </div>
            
            <div className="admin-section">
                <h3>Manage Current Movies</h3>
                <ul className="movie-list">
                    {movies.map(movie => (
                        <li key={movie.id}>
                            <img src={movie.posterUrl} alt={movie.title} className="list-poster-img"/>
                            <span>{movie.title}</span>
                            <button onClick={() => handleDeleteMovie(movie.id)} className="delete-button">Delete</button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
export default AdminPage;