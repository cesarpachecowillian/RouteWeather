package com.routeweather.component;

import com.google.maps.internal.PolylineEncoding;
import com.google.maps.model.LatLng;
import com.routeweather.model.Waypoint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
public class WaypointCalculator {

    /** Aim for one waypoint roughly every X hours of travel time on long trips. */
    @Value("${routeweather.target-interval-hours:1.25}")
    private double targetIntervalHours;

    /** Floor on the number of waypoints so short trips stay densely sampled. */
    @Value("${routeweather.min-waypoints:8}")
    private int minWaypoints;

    /** Minimum km between waypoints — avoids degenerate spacing on very slow modes. */
    private static final double MIN_INTERVAL_KM = 5.0;

    private static final double EARTH_RADIUS_KM = 6371.0;

    public List<Waypoint> calculate(String encodedPolyline,
                                    double totalDistanceKm,
                                    long totalDurationSeconds,
                                    LocalDateTime departureTime) {
        List<LatLng> path = PolylineEncoding.decode(encodedPolyline);
        List<Waypoint> waypoints = new ArrayList<>();

        if (path.isEmpty()) return waypoints;

        // Two candidate intervals; the smaller wins.
        //   - timeBased: 1.25h × avgSpeed → sparse sampling for long trips
        //   - countBased: distance / (minWaypoints-1) → dense sampling for short trips
        double totalHours = Math.max(0.1, totalDurationSeconds / 3600.0);
        double avgSpeedKmh = totalDistanceKm / totalHours;
        double timeBased = avgSpeedKmh * targetIntervalHours;
        double countBased = totalDistanceKm / Math.max(1, minWaypoints - 1);
        double interval = Math.max(MIN_INTERVAL_KM, Math.min(timeBased, countBased));

        LatLng first = path.get(0);
        waypoints.add(buildWaypoint(first, 0.0, totalDistanceKm, totalDurationSeconds, departureTime));

        double accumulated = 0.0;
        double nextThreshold = interval;

        for (int i = 1; i < path.size(); i++) {
            LatLng prev = path.get(i - 1);
            LatLng curr = path.get(i);
            double segmentKm = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
            accumulated += segmentKm;

            while (accumulated >= nextThreshold && nextThreshold < totalDistanceKm) {
                double overshoot = accumulated - nextThreshold;
                double ratio = segmentKm == 0 ? 0 : 1.0 - (overshoot / segmentKm);
                double lat = prev.lat + (curr.lat - prev.lat) * ratio;
                double lng = prev.lng + (curr.lng - prev.lng) * ratio;
                waypoints.add(buildWaypoint(new LatLng(lat, lng), nextThreshold,
                        totalDistanceKm, totalDurationSeconds, departureTime));
                nextThreshold += interval;
            }
        }

        LatLng last = path.get(path.size() - 1);
        waypoints.add(buildWaypoint(last, totalDistanceKm, totalDistanceKm,
                totalDurationSeconds, departureTime));

        return waypoints;
    }

    private Waypoint buildWaypoint(LatLng point, double distanceKm, double totalKm,
                                   long totalDurationSeconds, LocalDateTime departure) {
        double ratio = totalKm == 0 ? 0 : distanceKm / totalKm;
        long elapsedSeconds = Math.round(totalDurationSeconds * ratio);
        LocalDateTime arrival = departure.plusSeconds(elapsedSeconds);
        return Waypoint.builder()
                .lat(point.lat)
                .lng(point.lng)
                .distanceFromStartKm(round(distanceKm, 2))
                .estimatedArrival(arrival)
                .build();
    }

    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    private static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }
}
