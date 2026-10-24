package com.routeweather.controller;

import com.routeweather.service.PlacesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
public class PlacesController {

    private final PlacesService placesService;

    @GetMapping("/autocomplete")
    public ResponseEntity<List<Map<String, Object>>> autocomplete(@RequestParam("q") String query) {
        return ResponseEntity.ok(placesService.suggestPlaces(query));
    }
}
