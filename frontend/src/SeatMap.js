// frontend/src/SeatMap.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './SeatMap.css';

const Seat = ({ seatData, onSelect }) => {
    return (
        <div className={`seat ${seatData.status}`} onClick={() => seatData.status === 'available' && onSelect(seatData.seatNumber)}>
            {seatData.seatNumber}
        </div>
    );
};

const SeatMap = () => {
    const [showData, setShowData] = useState({ seats: {} });
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { id: showId } = useParams();

    const fetchSeatData = useCallback(async () => {
        try {
            const response = await fetch(`http://localhost:8080/api/shows/${showId}`);
            if (!response.ok) throw new Error('Failed to fetch seat data.');
            const data = await response.json();
            const seatsMap = data.seats.reduce((acc, seat) => {
                acc[seat.seatNumber] = seat;
                return acc;
            }, {});
            setShowData({ movieTitle: data.movieTitle, showTime: data.showTime, seats: seatsMap });
        } catch (error) {
            setError(error.message);
        }
    }, [showId]);

    useEffect(() => {
        fetchSeatData();
        const socket = new WebSocket('ws://localhost:8080');
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'BOOKING_CONFIRMED') {
                fetchSeatData();
                setSelectedSeats(currentSelected =>
                    currentSelected.filter(seat => !message.payload.bookedSeats.includes(seat))
                );
            }
        };
        return () => socket.close();
    }, [fetchSeatData]);

    const handleSelectSeat = (seatNumber) => {
        setError('');
        setSelectedSeats(currentSelected => currentSelected.includes(seatNumber) ? currentSelected.filter(s => s !== seatNumber) : [...currentSelected, seatNumber]);
    };

    const handleProceedToPayment = () => {
        if (selectedSeats.length === 0) {
            setError('Please select at least one seat to book.');
            return;
        }
        navigate('/payment', { state: { selectedSeats: selectedSeats, showId: showId } });
    };
    
    const getSeatStatus = (seat) => selectedSeats.includes(seat.seatNumber) ? 'selected' : seat.status;

    if (Object.keys(showData.seats).length === 0) return <div>Loading...</div>;

    return (
        <div className="seat-map-container">
            <h2>{showData.movieTitle}</h2>
            <h4>{new Date(showData.showTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</h4>
            <div className="screen"></div>
            <div className="seat-map">
                {Object.values(showData.seats).map((seat) => (
                    <Seat key={seat.seatId} seatData={{...seat, status: getSeatStatus(seat)}} onSelect={handleSelectSeat} />
                ))}
            </div>
            <div className="legend">
                <div><span className="seat available"></span> Available</div>
                <div><span className="seat selected"></span> Selected</div>
                <div><span className="seat booked"></span> Booked</div>
            </div>
            {error && <p className="error-message" style={{marginTop: '10px'}}>{error}</p>}
            <button onClick={handleProceedToPayment} className="book-button" disabled={selectedSeats.length === 0}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1.5 3A1.5 1.5 0 0 0 0 4.5V6a.5.5 0 0 0 .5.5 1.5 1.5 0 0 1 0 3 .5.5 0 0 0-.5.5v1.5A1.5 1.5 0 0 0 1.5 13h13a1.5 1.5 0 0 0 1.5-1.5V10a.5.5 0 0 0-.5-.5 1.5 1.5 0 0 1 0-3 .5.5 0 0 0 .5-.5V4.5A1.5 1.5 0 0 0 14.5 3h-13zM1 4.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v1.05a2.5 2.5 0 0 0 0 4.9v1.05a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-1.05a2.5 2.5 0 0 0 0-4.9V4.5z"/>
                </svg>
                {selectedSeats.length > 0 ? `Book ${selectedSeats.length} Ticket(s)` : 'Select Seats'}
            </button>
        </div>
    );
};

export default SeatMap;