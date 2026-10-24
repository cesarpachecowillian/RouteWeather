package com.routeweather.model;

public enum TravelMode {
    DRIVE,        // carro
    TWO_WHEELER,  // moto
    TRANSIT,      // onibus / transporte publico
    BICYCLE,      // bicicleta
    WALK;         // a pe

    public boolean supportsRoutingPreference() {
        return this == DRIVE || this == TWO_WHEELER;
    }
}
