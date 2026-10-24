package com.routeweather.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeocodingService {

    private static final String PHOTON_REVERSE = "https://photon.komoot.io/reverse";
    private static final String NULL_SENTINEL = " ";

    /** Photon `osm_value`s that indicate a populated place. */
    private static final Set<String> PLACE_TYPES = Set.of(
            "city", "town", "village", "municipality", "hamlet", "locality",
            "suburb", "neighbourhood");

    /** Google address-component types that work as a city-level label. */
    private static final List<String> GOOGLE_CITY_TYPES = List.of(
            "locality",
            "administrative_area_level_3",
            "administrative_area_level_2",
            "sublocality_level_1");

    private final RestClient restClient;

    @Value("${google.geocoding.api-key:}")
    private String googleKey;

    @Value("${google.geocoding.base-url:https://maps.googleapis.com/maps/api/geocode/json}")
    private String googleBaseUrl;

    private final Semaphore photonGate = new Semaphore(8);
    private final Semaphore googleGate = new Semaphore(20);
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private final AtomicBoolean googleDisabled = new AtomicBoolean(false);

    public String reverseCity(double lat, double lng) {
        // ~5km cache granularity
        String key = String.format("%.2f,%.2f", lat, lng);
        String cached = cache.get(key);
        if (cached != null) {
            return NULL_SENTINEL.equals(cached) ? null : cached;
        }

        String result = lookupGoogle(lat, lng);
        if (result == null) result = lookupPhoton(lat, lng);

        cache.put(key, result == null ? NULL_SENTINEL : result);
        return result;
    }

    private String lookupGoogle(double lat, double lng) {
        if (googleDisabled.get()) return null;
        if (googleKey == null || googleKey.isBlank()) return null;
        try {
            googleGate.acquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
        try {
            String uri = UriComponentsBuilder.fromUriString(googleBaseUrl)
                    .queryParam("latlng", lat + "," + lng)
                    .queryParam("language", "pt-BR")
                    .queryParam("key", googleKey)
                    .build()
                    .toUriString();

            Map<String, Object> response = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            if (response == null) return null;
            String status = (String) response.get("status");

            if ("REQUEST_DENIED".equals(status) || "INVALID_REQUEST".equals(status)) {
                if (googleDisabled.compareAndSet(false, true)) {
                    log.warn("Google Geocoding disabled (status={}, error={}). Falling back to Photon.",
                            status, response.get("error_message"));
                }
                return null;
            }
            if (!"OK".equals(status)) return null;

            List<Map<String, Object>> results = (List<Map<String, Object>>) response.get("results");
            if (results == null || results.isEmpty()) return null;

            String city = null;
            String state = null;
            outer:
            for (Map<String, Object> result : results) {
                List<Map<String, Object>> components = (List<Map<String, Object>>) result.get("address_components");
                if (components == null) continue;
                for (String preferredType : GOOGLE_CITY_TYPES) {
                    for (Map<String, Object> comp : components) {
                        List<String> types = (List<String>) comp.get("types");
                        if (types != null && types.contains(preferredType)) {
                            city = (String) comp.get("long_name");
                            for (Map<String, Object> stateComp : components) {
                                List<String> stateTypes = (List<String>) stateComp.get("types");
                                if (stateTypes != null && stateTypes.contains("administrative_area_level_1")) {
                                    state = (String) stateComp.get("short_name");
                                    break;
                                }
                            }
                            break outer;
                        }
                    }
                }
            }

            if (city == null) return null;
            if (state != null && !state.equalsIgnoreCase(city)) return city + ", " + state;
            return city;
        } catch (Exception e) {
            log.warn("Google Geocoding failed for {},{}: {}", lat, lng, e.getMessage());
            return null;
        } finally {
            googleGate.release();
        }
    }

    private String lookupPhoton(double lat, double lng) {
        try {
            photonGate.acquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
        try {
            String uri = UriComponentsBuilder.fromUriString(PHOTON_REVERSE)
                    .queryParam("lat", lat)
                    .queryParam("lon", lng)
                    .queryParam("limit", 5)
                    .build()
                    .toUriString();

            Map<String, Object> response = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(Map.class);

            if (response == null) return null;
            List<Map<String, Object>> features = (List<Map<String, Object>>) response.get("features");
            if (features == null || features.isEmpty()) return null;

            String fallbackCity = null;
            String fallbackState = null;

            for (Map<String, Object> feature : features) {
                Map<String, Object> props = (Map<String, Object>) feature.get("properties");
                if (props == null) continue;

                String osmKey = (String) props.get("osm_key");
                String osmValue = (String) props.get("osm_value");
                String name = (String) props.get("name");
                String city = (String) props.get("city");
                String state = (String) props.get("state");
                String county = (String) props.get("county");

                if (fallbackState == null) fallbackState = state;

                if ("place".equals(osmKey) && PLACE_TYPES.contains(osmValue) && name != null) {
                    return formatPhoton(name, state);
                }
                if (fallbackCity == null) {
                    if (city != null && !city.isBlank()) fallbackCity = city;
                    else if (county != null && !county.isBlank()) fallbackCity = county;
                }
            }

            if (fallbackCity != null) return formatPhoton(fallbackCity, fallbackState);
            if (fallbackState != null) return abbreviateBrazilianState(fallbackState);
            return null;
        } catch (Exception e) {
            log.warn("Photon reverse geocode failed for {},{}: {}", lat, lng, e.getMessage());
            return null;
        } finally {
            photonGate.release();
        }
    }

    private static String formatPhoton(String city, String state) {
        if (city == null) return null;
        String abbr = abbreviateBrazilianState(state);
        if (abbr != null && !abbr.equalsIgnoreCase(city)) return city + ", " + abbr;
        return city;
    }

    private static String abbreviateBrazilianState(String state) {
        if (state == null) return null;
        return switch (state) {
            case "Acre" -> "AC";
            case "Alagoas" -> "AL";
            case "Amapá", "Amapa" -> "AP";
            case "Amazonas" -> "AM";
            case "Bahia" -> "BA";
            case "Ceará", "Ceara" -> "CE";
            case "Distrito Federal" -> "DF";
            case "Espírito Santo", "Espirito Santo" -> "ES";
            case "Goiás", "Goias" -> "GO";
            case "Maranhão", "Maranhao" -> "MA";
            case "Mato Grosso" -> "MT";
            case "Mato Grosso do Sul" -> "MS";
            case "Minas Gerais" -> "MG";
            case "Pará", "Para" -> "PA";
            case "Paraíba", "Paraiba" -> "PB";
            case "Paraná", "Parana" -> "PR";
            case "Pernambuco" -> "PE";
            case "Piauí", "Piaui" -> "PI";
            case "Rio de Janeiro" -> "RJ";
            case "Rio Grande do Norte" -> "RN";
            case "Rio Grande do Sul" -> "RS";
            case "Rondônia", "Rondonia" -> "RO";
            case "Roraima" -> "RR";
            case "Santa Catarina" -> "SC";
            case "São Paulo", "Sao Paulo" -> "SP";
            case "Sergipe" -> "SE";
            case "Tocantins" -> "TO";
            default -> state;
        };
    }
}
