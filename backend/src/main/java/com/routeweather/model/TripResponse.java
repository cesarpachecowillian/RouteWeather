package com.routeweather.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TripResponse {
    private String origin;
    private String destination;
    private String description;
    private String encodedPolyline;
    private double totalDistanceKm;
    private long totalDurationMinutes;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime departureTime;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime arrivalTime;

    private List<Waypoint> waypoints;
    private List<Alert> alerts;
}
