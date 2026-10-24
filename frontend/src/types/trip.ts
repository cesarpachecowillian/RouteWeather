export type TravelMode = 'DRIVE' | 'TWO_WHEELER' | 'TRANSIT' | 'BICYCLE' | 'WALK';

export interface WeatherInfo {
  conditionCode: number;
  conditionLabel: string;
  temperatureCelsius: number;
  precipitationMm: number;
  windSpeedKmh: number;
  humidity: number;
  icon: string;
}

export interface Waypoint {
  lat: number;
  lng: number;
  estimatedArrival: string;
  distanceFromStartKm: number;
  cityName?: string;
  weather: WeatherInfo | null;
}

export type AlertType =
  | 'RAIN' | 'SNOW' | 'FREEZING_PRECIP' | 'STORM'
  | 'FOG' | 'WIND' | 'HEAT' | 'COLD';

export interface Alert {
  message: string;
  waypointIndex: number;
  type?: AlertType;
}

export interface TripResponse {
  origin: string;
  destination: string;
  description?: string;
  encodedPolyline?: string;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  departureTime: string;
  arrivalTime: string;
  waypoints: Waypoint[];
  alerts: Alert[];
}

export interface TripRequest {
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  travelMode: TravelMode;
}
