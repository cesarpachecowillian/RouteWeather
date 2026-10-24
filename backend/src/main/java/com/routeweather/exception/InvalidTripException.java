package com.routeweather.exception;

public class InvalidTripException extends RuntimeException {
    public InvalidTripException(String message) {
        super(message);
    }
}
