package com.routeweather.service;

import com.routeweather.model.WeatherInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    private final RestClient restClient;

    @Value("${openmeteo.base-url}")
    private String baseUrl;

    /**
     * Batch fetch weather for many coordinates at once. Open-Meteo accepts
     * comma-separated lat/lng and returns one entry per location.
     */
    public List<WeatherInfo> fetchWeatherBatch(List<double[]> coords, List<LocalDateTime> times) {
        if (coords == null || coords.isEmpty()) return Collections.emptyList();
        if (coords.size() != times.size()) {
            throw new IllegalArgumentException("coords and times sizes must match");
        }

        try {
            LocalDate minDate = times.stream().map(LocalDateTime::toLocalDate)
                    .min(LocalDate::compareTo).orElse(LocalDate.now());
            LocalDate maxDate = times.stream().map(LocalDateTime::toLocalDate)
                    .max(LocalDate::compareTo).orElse(minDate);

            String latitudes = coords.stream()
                    .map(c -> String.valueOf(c[0]))
                    .collect(Collectors.joining(","));
            String longitudes = coords.stream()
                    .map(c -> String.valueOf(c[1]))
                    .collect(Collectors.joining(","));

            String uri = UriComponentsBuilder.fromUriString(baseUrl)
                    .queryParam("latitude", latitudes)
                    .queryParam("longitude", longitudes)
                    .queryParam("hourly", "temperature_2m,precipitation,weathercode,windspeed_10m,relativehumidity_2m")
                    .queryParam("start_date", minDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                    .queryParam("end_date", maxDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                    .queryParam("timezone", "America/Sao_Paulo")
                    .build()
                    .toUriString();

            Object raw = restClient.get().uri(uri).retrieve().body(Object.class);

            // Single location returns Map; multiple return List
            List<Map<String, Object>> entries;
            if (raw instanceof List<?> list) {
                entries = (List<Map<String, Object>>) list;
            } else if (raw instanceof Map<?, ?> map) {
                entries = List.of((Map<String, Object>) map);
            } else {
                return Collections.nCopies(coords.size(), null);
            }

            List<WeatherInfo> out = new ArrayList<>(coords.size());
            for (int i = 0; i < coords.size(); i++) {
                if (i >= entries.size()) {
                    out.add(null);
                    continue;
                }
                out.add(parseEntry(entries.get(i), times.get(i)));
            }
            return out;
        } catch (Exception e) {
            log.warn("Batch weather fetch failed: {}", e.getMessage());
            return Collections.nCopies(coords.size(), null);
        }
    }

    private WeatherInfo parseEntry(Map<String, Object> entry, LocalDateTime when) {
        try {
            Map<String, Object> hourly = (Map<String, Object>) entry.get("hourly");
            if (hourly == null) return null;

            List<String> hours = (List<String>) hourly.get("time");
            List<Number> temps = (List<Number>) hourly.get("temperature_2m");
            List<Number> precs = (List<Number>) hourly.get("precipitation");
            List<Number> codes = (List<Number>) hourly.get("weathercode");
            List<Number> winds = (List<Number>) hourly.get("windspeed_10m");
            List<Number> humidity = (List<Number>) hourly.get("relativehumidity_2m");

            int idx = findClosestHourIndex(hours, when);
            if (idx < 0) return null;

            int code = codes.get(idx).intValue();
            return WeatherInfo.builder()
                    .conditionCode(code)
                    .conditionLabel(labelFor(code))
                    .icon(iconFor(code))
                    .temperatureCelsius(temps.get(idx).doubleValue())
                    .precipitationMm(precs.get(idx).doubleValue())
                    .windSpeedKmh(winds.get(idx).doubleValue())
                    .humidity(humidity.get(idx).intValue())
                    .build();
        } catch (Exception e) {
            log.warn("Failed to parse weather entry: {}", e.getMessage());
            return null;
        }
    }

    private int findClosestHourIndex(List<String> times, LocalDateTime target) {
        if (times == null || times.isEmpty()) return -1;
        int bestIdx = -1;
        long bestDiff = Long.MAX_VALUE;
        for (int i = 0; i < times.size(); i++) {
            try {
                LocalDateTime t = LocalDateTime.parse(times.get(i));
                long diff = Math.abs(java.time.Duration.between(t, target).toMinutes());
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestIdx = i;
                }
            } catch (Exception ignored) {}
        }
        return bestIdx;
    }

    public static String labelFor(int code) {
        return switch (code) {
            case 0 -> "Céu limpo";
            case 1, 2, 3 -> "Parcialmente nublado";
            case 45, 48 -> "Neblina";
            case 51, 53, 55 -> "Garoa";
            case 56, 57 -> "Garoa congelante";
            case 61, 63, 65 -> "Chuva";
            case 66, 67 -> "Chuva congelante";
            case 71, 73, 75 -> "Neve";
            case 77 -> "Grãos de neve";
            case 80, 81, 82 -> "Pancadas de chuva";
            case 85, 86 -> "Pancadas de neve";
            case 95, 96, 99 -> "Tempestade";
            default -> "Indefinido";
        };
    }

    public static String iconFor(int code) {
        return switch (code) {
            case 0 -> "sunny";
            case 1, 2, 3 -> "cloudy";
            case 45, 48 -> "foggy";
            case 51, 53, 55, 56, 57 -> "drizzle";
            case 61, 63, 65, 66, 67 -> "rainy";
            case 71, 73, 75, 77, 85, 86 -> "snowy";
            case 80, 81, 82 -> "showers";
            case 95, 96, 99 -> "thunderstorm";
            default -> "cloudy";
        };
    }
}
