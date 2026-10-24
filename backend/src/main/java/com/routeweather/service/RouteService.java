package com.routeweather.service;

import com.routeweather.exception.ExternalApiException;
import com.routeweather.model.TravelMode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RouteService {

    private final RestClient restClient;
    private final PlacesService placesService;

    @Value("${google.routes.api-key}")
    private String apiKey;

    @Value("${google.routes.base-url}")
    private String baseUrl;

    private static final String FIELD_MASK =
            "routes.polyline.encodedPolyline,routes.legs,routes.duration,routes.distanceMeters,routes.description";

    public List<RouteData> fetchRoutes(String origin, String destination, TravelMode mode) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ExternalApiException("Google Routes API key is not configured");
        }
        if (mode == null) mode = TravelMode.DRIVE;

        Map<String, Object> originObj = Map.of("address", origin);
        Map<String, Object> destObj = Map.of("address", destination);

        // 1st attempt: addresses with alternatives + traffic-aware
        List<RouteData> result = doFetch(originObj, destObj, mode, true, mode.supportsRoutingPreference());

        // 2nd attempt: addresses without alternatives/traffic
        if (result.isEmpty()) {
            log.info("Empty address-based Google Routes response, retrying simpler ({} -> {})", origin, destination);
            result = doFetch(originObj, destObj, mode, false, false);
        }

        // 3rd attempt: geocode via Nominatim and call with lat/lng. Google Routes
        // sometimes returns no route for long-distance address pairs but works
        // when given coordinates.
        if (result.isEmpty()) {
            log.info("Falling back to lat/lng geocoding for {} -> {}", origin, destination);
            Map<String, Object> originLatLng = geocodeToLocation(origin);
            Map<String, Object> destLatLng = geocodeToLocation(destination);
            if (originLatLng != null && destLatLng != null) {
                result = doFetch(originLatLng, destLatLng, mode, true, mode.supportsRoutingPreference());
                if (result.isEmpty()) {
                    result = doFetch(originLatLng, destLatLng, mode, false, false);
                }
            }
        }

        if (result.isEmpty()) {
            throw new ExternalApiException("Nenhuma rota encontrada entre origem e destino");
        }
        return result;
    }

    private Map<String, Object> geocodeToLocation(String query) {
        List<Map<String, Object>> hits = placesService.autocomplete(query);
        if (hits.isEmpty()) return null;
        Map<String, Object> hit = hits.get(0);
        try {
            double lat = Double.parseDouble(String.valueOf(hit.get("lat")));
            double lng = Double.parseDouble(String.valueOf(hit.get("lng")));
            return Map.of("location", Map.of("latLng",
                    Map.of("latitude", lat, "longitude", lng)));
        } catch (Exception e) {
            log.warn("Failed to parse geocoded location for '{}': {}", query, e.getMessage());
            return null;
        }
    }

    private List<RouteData> doFetch(Map<String, Object> origin, Map<String, Object> destination, TravelMode mode,
                                    boolean alternatives, boolean trafficAware) {
        Map<String, Object> body = new HashMap<>();
        body.put("origin", origin);
        body.put("destination", destination);
        body.put("travelMode", mode.name());
        body.put("units", "METRIC");
        body.put("languageCode", "pt-BR");
        if (alternatives) body.put("computeAlternativeRoutes", true);
        if (trafficAware) body.put("routingPreference", "TRAFFIC_AWARE");

        try {
            Map<String, Object> response = restClient.post()
                    .uri(baseUrl)
                    .header("X-Goog-Api-Key", apiKey)
                    .header("X-Goog-FieldMask", FIELD_MASK)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null || !response.containsKey("routes")) {
                log.debug("Empty Google Routes response. body={} got={}", body, response);
                return List.of();
            }

            List<Map<String, Object>> routes = (List<Map<String, Object>>) response.get("routes");
            if (routes == null || routes.isEmpty()) return List.of();

            List<RouteData> result = new ArrayList<>();
            for (Map<String, Object> route : routes) {
                Map<String, Object> polyline = (Map<String, Object>) route.get("polyline");
                String encodedPolyline = polyline != null ? (String) polyline.get("encodedPolyline") : null;
                if (encodedPolyline == null) continue;

                Number distanceMeters = (Number) route.get("distanceMeters");
                long durationSeconds = parseDuration((String) route.get("duration"));
                String description = (String) route.get("description");

                result.add(new RouteData(encodedPolyline,
                        distanceMeters != null ? distanceMeters.doubleValue() : 0.0,
                        durationSeconds,
                        description));
            }
            return result;
        } catch (Exception e) {
            log.error("Failed to fetch route from Google Routes API", e);
            throw new ExternalApiException("Falha ao calcular rota: " + e.getMessage());
        }
    }

    private long parseDuration(String duration) {
        if (duration == null) return 0;
        String trimmed = duration.endsWith("s") ? duration.substring(0, duration.length() - 1) : duration;
        try {
            return Long.parseLong(trimmed);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    public record RouteData(String encodedPolyline, double distanceMeters, long durationSeconds, String description) {}
}
