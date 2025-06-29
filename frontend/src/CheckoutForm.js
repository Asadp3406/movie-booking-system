// frontend/src/CheckoutForm.js
import React, { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsProcessing(true);

    if (!stripe || !elements) {
      setIsProcessing(false);
      return;
    }
    
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // THE FIX: Point to our new confirmation page
        return_url: `${window.location.origin}/confirm-booking`,
      },
    });
    
    if (error) {
      setErrorMessage(error.type === "card_error" || error.type === "validation_error" ? error.message : "An unexpected error occurred.");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} id="payment-form">
      <PaymentElement id="payment-element" />
      <button disabled={isProcessing || !stripe || !elements} id="submit" className="pay-button">
        <span id="button-text">
          {isProcessing ? "Processing..." : "Pay now"}
        </span>
      </button>
      {errorMessage && <div id="payment-message" style={{color: 'red'}}>{errorMessage}</div>}
    </form>
  );
};

export default CheckoutForm;