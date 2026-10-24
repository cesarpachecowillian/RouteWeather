package com.routeweather.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeatherInfo {
    private Integer conditionCode;
    private String conditionLabel;
    private Double temperatureCelsius;
    private Double precipitationMm;
    private Double windSpeedKmh;
    private Integer humidity;
    private String icon;
}
