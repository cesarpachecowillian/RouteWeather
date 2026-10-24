package com.routeweather.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Alert {
    private String message;
    private int waypointIndex;
    private AlertType type;
}
