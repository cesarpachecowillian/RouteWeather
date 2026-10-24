package com.routeweather.component;

import com.routeweather.model.Alert;
import com.routeweather.model.AlertType;
import com.routeweather.model.TripRequest;
import com.routeweather.model.TripResponse;
import com.routeweather.model.Waypoint;
import com.routeweather.model.WeatherInfo;
import com.routeweather.service.GeocodingService;
import com.routeweather.service.RouteService;
import com.routeweather.service.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
@RequiredArgsConstructor
public class TripReportBuilder {

    private final WaypointCalculator waypointCalculator;
    private final WeatherService weatherService;
    private final GeocodingService geocodingService;

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH'h'mm");
    private static final ExecutorService EXEC = Executors.newVirtualThreadPerTaskExecutor();

    public TripResponse build(TripRequest request, RouteService.RouteData route) {
        double totalKm = route.distanceMeters() / 1000.0;
        long totalMinutes = route.durationSeconds() / 60;

        LocalDateTime departure = request.getDepartureTime() != null
                ? request.getDepartureTime()
                : request.getArrivalTime().minusSeconds(route.durationSeconds());
        LocalDateTime arrival = departure.plusSeconds(route.durationSeconds());

        List<Waypoint> waypoints = waypointCalculator.calculate(
                route.encodedPolyline(),
                totalKm,
                route.durationSeconds(),
                departure
        );

        // Weather: single batch call for all coordinates
        CompletableFuture<Void> weatherFuture = CompletableFuture.runAsync(() -> {
            List<double[]> coords = waypoints.stream()
                    .map(wp -> new double[] { wp.getLat(), wp.getLng() })
                    .toList();
            List<LocalDateTime> times = waypoints.stream()
                    .map(Waypoint::getEstimatedArrival)
                    .toList();
            List<WeatherInfo> weather = weatherService.fetchWeatherBatch(coords, times);
            for (int i = 0; i < waypoints.size() && i < weather.size(); i++) {
                waypoints.get(i).setWeather(weather.get(i));
            }
        }, EXEC);

        // Geocoding: parallel per-waypoint (with internal cache + semaphore)
        List<CompletableFuture<Void>> geoFutures = new ArrayList<>(waypoints.size());
        for (Waypoint wp : waypoints) {
            geoFutures.add(CompletableFuture.runAsync(
                    () -> wp.setCityName(geocodingService.reverseCity(wp.getLat(), wp.getLng())),
                    EXEC));
        }

        weatherFuture.join();
        CompletableFuture.allOf(geoFutures.toArray(new CompletableFuture[0])).join();

        List<Alert> alerts = buildAlerts(waypoints);

        return TripResponse.builder()
                .origin(request.getOrigin())
                .destination(request.getDestination())
                .description(route.description())
                .encodedPolyline(route.encodedPolyline())
                .totalDistanceKm(round(totalKm, 1))
                .totalDurationMinutes(totalMinutes)
                .departureTime(departure)
                .arrivalTime(arrival)
                .waypoints(waypoints)
                .alerts(alerts)
                .build();
    }

    private static boolean isRainCode(int c) {
        return (c >= 61 && c <= 65) || (c >= 80 && c <= 82);
    }

    private static boolean isSnowCode(int c) {
        return (c >= 71 && c <= 75) || c == 77 || c == 85 || c == 86;
    }

    private static boolean isStormCode(int c) {
        return c >= 95 && c <= 99;
    }

    /** Freezing drizzle (56, 57) and freezing rain (66, 67). */
    private static boolean isFreezingPrecipCode(int c) {
        return c == 56 || c == 57 || c == 66 || c == 67;
    }

    private List<Alert> buildAlerts(List<Waypoint> waypoints) {
        List<Alert> alerts = new ArrayList<>();
        Integer rainStartIdx = null, rainEndIdx = null;
        Integer snowStartIdx = null, snowEndIdx = null;
        Integer freezingStartIdx = null, freezingEndIdx = null;
        boolean fogReported = false;
        boolean windReported = false;
        boolean stormReported = false;
        boolean heatReported = false;
        boolean coldReported = false;

        for (int i = 0; i < waypoints.size(); i++) {
            Waypoint wp = waypoints.get(i);
            WeatherInfo w = wp.getWeather();
            if (w == null) continue;

            int code = w.getConditionCode() == null ? -1 : w.getConditionCode();
            String hhmm = wp.getEstimatedArrival().format(HHMM);

            if (isRainCode(code)) {
                if (rainStartIdx == null) rainStartIdx = i;
                rainEndIdx = i;
            } else if (rainStartIdx != null) {
                alerts.add(rangeAlert(waypoints, rainStartIdx, rainEndIdx, "Chuva", AlertType.RAIN));
                rainStartIdx = null; rainEndIdx = null;
            }

            if (isSnowCode(code)) {
                if (snowStartIdx == null) snowStartIdx = i;
                snowEndIdx = i;
            } else if (snowStartIdx != null) {
                alerts.add(rangeAlert(waypoints, snowStartIdx, snowEndIdx, "Neve", AlertType.SNOW));
                snowStartIdx = null; snowEndIdx = null;
            }

            if (isFreezingPrecipCode(code)) {
                if (freezingStartIdx == null) freezingStartIdx = i;
                freezingEndIdx = i;
            } else if (freezingStartIdx != null) {
                alerts.add(rangeAlert(waypoints, freezingStartIdx, freezingEndIdx,
                        "Chuva congelante", AlertType.FREEZING_PRECIP));
                freezingStartIdx = null; freezingEndIdx = null;
            }

            if (isStormCode(code) && !stormReported) {
                alerts.add(pointAlert(i, AlertType.STORM, pointMessage(wp, hhmm, null)));
                stormReported = true;
            }

            if ((code == 45 || code == 48) && !fogReported) {
                alerts.add(pointAlert(i, AlertType.FOG, pointMessage(wp, hhmm, null)));
                fogReported = true;
            }

            if (w.getWindSpeedKmh() != null && w.getWindSpeedKmh() > 60 && !windReported) {
                alerts.add(pointAlert(i, AlertType.WIND,
                        pointMessage(wp, hhmm, String.format("%.0f km/h", w.getWindSpeedKmh()))));
                windReported = true;
            }

            if (w.getTemperatureCelsius() != null) {
                double t = w.getTemperatureCelsius();
                if (t >= 38 && !heatReported) {
                    alerts.add(pointAlert(i, AlertType.HEAT,
                            pointMessage(wp, hhmm, String.format("%.0f°C", t))));
                    heatReported = true;
                }
                if (t <= 2 && !coldReported) {
                    alerts.add(pointAlert(i, AlertType.COLD,
                            pointMessage(wp, hhmm, String.format("%.0f°C", t))));
                    coldReported = true;
                }
            }
        }

        if (rainStartIdx != null) alerts.add(rangeAlert(waypoints, rainStartIdx, rainEndIdx, "Chuva", AlertType.RAIN));
        if (snowStartIdx != null) alerts.add(rangeAlert(waypoints, snowStartIdx, snowEndIdx, "Neve", AlertType.SNOW));
        if (freezingStartIdx != null) alerts.add(rangeAlert(waypoints, freezingStartIdx, freezingEndIdx,
                "Chuva congelante", AlertType.FREEZING_PRECIP));

        return alerts;
    }

    private Alert pointAlert(int idx, AlertType type, String message) {
        return Alert.builder().waypointIndex(idx).type(type).message(message).build();
    }

    private Alert rangeAlert(List<Waypoint> wps, int start, int end, String label, AlertType type) {
        Waypoint a = wps.get(start);
        Waypoint b = wps.get(end);
        String message;
        if (start == end) {
            message = pointMessage(a, a.getEstimatedArrival().format(HHMM), null);
        } else {
            String cities = formatRangeCities(a.getCityName(), b.getCityName());
            String time = a.getEstimatedArrival().format(HHMM) + "–" + b.getEstimatedArrival().format(HHMM);
            message = String.format("km %.0f–%.0f%s · %s",
                    a.getDistanceFromStartKm(), b.getDistanceFromStartKm(),
                    cities.isEmpty() ? "" : " · " + cities, time);
        }
        return Alert.builder().waypointIndex(start).type(type).message(message).build();
    }

    private static String pointMessage(Waypoint wp, String hhmm, String value) {
        StringBuilder sb = new StringBuilder();
        if (value != null) sb.append(value).append(" · ");
        sb.append(String.format("km %.0f", wp.getDistanceFromStartKm()));
        if (wp.getCityName() != null) sb.append(" · ").append(wp.getCityName());
        sb.append(" · ").append(hhmm);
        return sb.toString();
    }

    private static String formatRangeCities(String a, String b) {
        if (a == null && b == null) return "";
        if (a != null && a.equals(b)) return a;
        if (a != null && b != null) return a + " → " + b;
        return a != null ? a : b;
    }

    private static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }
}
