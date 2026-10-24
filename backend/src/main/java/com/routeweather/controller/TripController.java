package com.routeweather.controller;

import com.routeweather.component.TripReportBuilder;
import com.routeweather.exception.InvalidTripException;
import com.routeweather.model.TripRequest;
import com.routeweather.model.TripResponse;
import com.routeweather.service.RouteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TripController {

    private static final ZoneId BR = ZoneId.of("America/Sao_Paulo");
    private static final long PAST_TOLERANCE_MIN = 5;
    private static final int MAX_DAYS_AHEAD = 14;
    private static final ExecutorService EXEC = Executors.newVirtualThreadPerTaskExecutor();

    private final RouteService routeService;
    private final TripReportBuilder tripReportBuilder;

    @PostMapping("/trip")
    public ResponseEntity<List<TripResponse>> computeTrip(@Valid @RequestBody TripRequest request) {
        validateRequestTimes(request);

        List<RouteService.RouteData> routes = routeService.fetchRoutes(
                request.getOrigin(), request.getDestination(), request.getTravelMode());

        // Filter out routes whose computed departure would be in the past
        List<RouteService.RouteData> viable = new ArrayList<>();
        InvalidTripException lastInvalid = null;
        for (RouteService.RouteData route : routes) {
            try {
                validateComputedDeparture(request, route.durationSeconds());
                viable.add(route);
            } catch (InvalidTripException e) {
                lastInvalid = e;
            }
        }
        if (viable.isEmpty()) {
            throw lastInvalid != null ? lastInvalid
                    : new InvalidTripException("Nenhuma rota viável encontrada");
        }

        // Build alternatives in parallel
        List<CompletableFuture<TripResponse>> futures = viable.stream()
                .map(route -> CompletableFuture.supplyAsync(
                        () -> tripReportBuilder.build(request, route), EXEC))
                .toList();
        List<TripResponse> responses = futures.stream()
                .map(CompletableFuture::join)
                .toList();

        return ResponseEntity.ok(responses);
    }

    private void validateRequestTimes(TripRequest request) {
        LocalDateTime now = LocalDateTime.now(BR);
        LocalDateTime maxAllowed = now.plusDays(MAX_DAYS_AHEAD);

        if (request.getDepartureTime() != null) {
            if (request.getDepartureTime().isBefore(now.minusMinutes(PAST_TOLERANCE_MIN))) {
                throw new InvalidTripException("Horário de partida não pode estar no passado");
            }
            if (request.getDepartureTime().isAfter(maxAllowed)) {
                throw new InvalidTripException(
                        "Não é possível planejar viagens com mais de " + MAX_DAYS_AHEAD + " dias de antecedência");
            }
        }
        if (request.getArrivalTime() != null) {
            if (!request.getArrivalTime().isAfter(now)) {
                throw new InvalidTripException("Horário de chegada precisa ser no futuro");
            }
            if (request.getArrivalTime().isAfter(maxAllowed)) {
                throw new InvalidTripException(
                        "Não é possível planejar chegadas com mais de " + MAX_DAYS_AHEAD + " dias de antecedência");
            }
        }
    }

    private void validateComputedDeparture(TripRequest request, long durationSeconds) {
        if (request.getArrivalTime() == null) return;
        LocalDateTime computedDeparture = request.getArrivalTime().minusSeconds(durationSeconds);
        LocalDateTime now = LocalDateTime.now(BR);
        if (computedDeparture.isBefore(now.minusMinutes(PAST_TOLERANCE_MIN))) {
            long minutes = durationSeconds / 60;
            throw new InvalidTripException(String.format(
                    "Para chegar nesse horário, você precisaria ter saído há %d minutos. " +
                            "Escolha um horário de chegada mais tarde.", minutes));
        }
    }
}
