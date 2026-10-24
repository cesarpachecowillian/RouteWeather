package com.routeweather.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TripRequest {

    @NotBlank
    private String origin;

    @NotBlank
    private String destination;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime departureTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime arrivalTime;

    private TravelMode travelMode = TravelMode.DRIVE;

    @JsonIgnore
    @AssertTrue(message = "Informe departureTime OU arrivalTime (exatamente um)")
    public boolean isExactlyOneTimeProvided() {
        return (departureTime == null) ^ (arrivalTime == null);
    }
}
