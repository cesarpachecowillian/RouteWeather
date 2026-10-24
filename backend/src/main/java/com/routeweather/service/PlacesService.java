package com.routeweather.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlacesService {

    private static final String NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
    private static final String GOOGLE_PLACES = "https://places.googleapis.com/v1/places:autocomplete";
    private static final String USER_AGENT = "RouteWeather/0.1 (https://github.com/routeweather)";

    private final RestClient restClient;

    @Value("${google.places.api-key:${google.routes.api-key:}}")
    private String googleKey;

    private final AtomicBoolean googlePlacesDisabled = new AtomicBoolean(false);

    /**
     * User-facing address suggestions. Tries Google Places (New) for richer
     * Brazilian-address coverage; falls back to Nominatim.
     * Returned items always have `displayName`; `lat`/`lng` are populated only
     * for the Nominatim fallback.
     */
    public List<Map<String, Object>> suggestPlaces(String query) {
        if (query == null || query.trim().length() < 2) return Collections.emptyList();
        List<Map<String, Object>> google = googlePlaces(query);
        if (!google.isEmpty()) return google;
        return autocomplete(query);
    }

    /** Internal: returns suggestions WITH lat/lng (Nominatim) for backend geocoding fallback. */
    public List<Map<String, Object>> autocomplete(String query) {
        if (query == null || query.trim().length() < 2) return Collections.emptyList();
        try {
            String uri = UriComponentsBuilder.fromUriString(NOMINATIM_SEARCH)
                    .queryParam("q", query)
                    .queryParam("format", "json")
                    .queryParam("limit", 5)
                    .queryParam("addressdetails", 1)
                    .queryParam("accept-language", "pt-BR")
                    .build()
                    .toUriString();

            List<Map<String, Object>> results = restClient.get()
                    .uri(uri)
                    .header("User-Agent", USER_AGENT)
                    .retrieve()
                    .body(List.class);

            if (results == null) return Collections.emptyList();

            return results.stream().map(r -> {
                Map<String, Object> simplified = new HashMap<>();
                simplified.put("displayName", r.get("display_name"));
                simplified.put("lat", r.get("lat"));
                simplified.put("lng", r.get("lon"));
                return simplified;
            }).toList();
        } catch (Exception e) {
            log.warn("Nominatim autocomplete failed for '{}': {}", query, e.getMessage());
            return Collections.emptyList();
        }
    }

    private List<Map<String, Object>> googlePlaces(String query) {
        if (googlePlacesDisabled.get()) return Collections.emptyList();
        if (googleKey == null || googleKey.isBlank()) return Collections.emptyList();

        try {
            Map<String, Object> body = Map.of(
                    "input", query,
                    "languageCode", "pt-BR",
                    "regionCode", "BR"
            );

            Map<String, Object> response = restClient.post()
                    .uri(GOOGLE_PLACES)
                    .header("X-Goog-Api-Key", googleKey)
                    .header("X-Goog-FieldMask", "suggestions.placePrediction.text")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            if (response == null) return Collections.emptyList();
            List<Map<String, Object>> suggestions = (List<Map<String, Object>>) response.get("suggestions");
            if (suggestions == null) return Collections.emptyList();

            List<Map<String, Object>> result = new ArrayList<>();
            for (Map<String, Object> s : suggestions) {
                Map<String, Object> pred = (Map<String, Object>) s.get("placePrediction");
                if (pred == null) continue;
                Map<String, Object> text = (Map<String, Object>) pred.get("text");
                if (text == null) continue;
                String displayName = (String) text.get("text");
                if (displayName == null || displayName.isBlank()) continue;
                Map<String, Object> simplified = new HashMap<>();
                simplified.put("displayName", displayName);
                simplified.put("lat", "");
                simplified.put("lng", "");
                result.add(simplified);
            }
            return result;
        } catch (HttpStatusCodeException e) {
            HttpStatusCode status = e.getStatusCode();
            if (status.value() == 401 || status.value() == 403) {
                if (googlePlacesDisabled.compareAndSet(false, true)) {
                    log.warn("Google Places Autocomplete disabled (status={}, body={}). Falling back to Nominatim. " +
                            "Enable 'Places API (New)' in Cloud Console to use it.",
                            status, e.getResponseBodyAsString());
                }
            } else {
                log.warn("Google Places Autocomplete error ({}): {}", status, e.getMessage());
            }
            return Collections.emptyList();
        } catch (Exception e) {
            log.warn("Google Places Autocomplete failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }
}
