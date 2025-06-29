// frontend/src/OrderConfirmationPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';

// Make sure your Stripe Publishable Key is correct
const stripePromise = loadStripe('pk_test_51RexQl2Lhp2aPDNUrzSAJOAOHVlspoIpw7pDM0yNYeoHWcRMiKwHzbLeQav5nxMLC0ASqAbfghP6Mj8xdP2nToRr00T3LvrYbI');

const OrderConfirmationPage = () => {
    const [message, setMessage] = useState('Processing your booking...');

    const bookSeatsInDatabase = useCallback(async (showIdToBook, seatsToBook) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8080/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                body: JSON.stringify({ showId: showIdToBook, seatNumbers: seatsToBook })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Booking failed after payment.');
            }
            setMessage('Success! Your booking is confirmed.');
        } catch (err) {
            setMessage(`An error occurred: ${err.message}`);
        }
    }, []);

    const checkPaymentStatus = useCallback(async () => {
        const clientSecret = new URLSearchParams(window.location.search).get("payment_intent_client_secret");
        if (!clientSecret) {
            setMessage("Could not find payment details. Please contact support.");
            return;
        }

        // Get the booking details from the browser's session
        const bookingDetails = JSON.parse(sessionStorage.getItem('booking_details'));

        // --- THIS IS THE FIX ---
        // Immediately remove the details so this process cannot run twice on a refresh
        sessionStorage.removeItem('booking_details');

        if (!bookingDetails) {
            setMessage("Your booking has already been processed. Thank you!");
            return;
        }
        
        const stripe = await stripePromise;
        const { error, paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

        if (error) {
            setMessage(`Payment check failed: ${error.message}`);
            return;
        }

        if (paymentIntent.status === "succeeded") {
            bookSeatsInDatabase(bookingDetails.showId, bookingDetails.selectedSeats);
        } else {
            setMessage("Payment not successful. Please try again.");
        }
    }, [bookSeatsInDatabase]);

    useEffect(() => {
        checkPaymentStatus();
    }, [checkPaymentStatus]);


    return (
        <div className="confirmation-page">
            <h2>Booking Status</h2>
            <p className="status-message">{message}</p>
            <Link to="/" className="cta-button">Return to Homepage</Link>
        </div>
    );
};

export default OrderConfirmationPage;