// frontend/src/Paymentpage.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';

// Make sure your Stripe Publishable Key is correct
const stripePromise = loadStripe('pk_test_51RexQl2Lhp2aPDNUrzSAJOAOHVlspoIpw7pDM0yNYeoHWcRMiKwHzbLeQav5nxMLC0ASqAbfghP6Mj8xdP2nToRr00T3LvrYbI');

const PaymentPage = () => {
    const [clientSecret, setClientSecret] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const { selectedSeats, showId } = location.state || {}; 

    useEffect(() => {
        if (!selectedSeats || selectedSeats.length === 0) {
            navigate('/');
            return;
        }

        fetch("http://localhost:8080/api/create-payment-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numSeats: selectedSeats.length }),
        })
        .then((res) => res.json())
        .then((data) => {
            if(data.error) {
                alert(data.error.message);
                navigate('/');
            } else {
                setClientSecret(data.clientSecret);
                // We will now store the booking details in sessionStorage
                // so we can retrieve them after the user is redirected back.
                sessionStorage.setItem('booking_details', JSON.stringify(location.state));
            }
        });
    }, [selectedSeats, navigate, location.state]);

    const appearance = { theme: 'stripe' };
    const options = { clientSecret, appearance };

    if (!selectedSeats) {
        return <div>Loading...</div>;
    }

    const price = selectedSeats.length * 12.50;

    return (
        <div className="payment-container">
            <h2>Complete Your Booking</h2>
            <p>You are booking {selectedSeats.length} seat(s): {selectedSeats.join(', ')}</p>
            <p><strong>Total: ${price.toFixed(2)}</strong></p>
            {clientSecret && (
                <Elements options={options} stripe={stripePromise}>
                    <CheckoutForm />
                </Elements>
            )}
        </div>
    );
};

export default PaymentPage;