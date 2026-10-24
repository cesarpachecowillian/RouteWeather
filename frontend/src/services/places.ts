import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

export interface PlaceSuggestion {
  displayName: string;
  lat: string;
  lng: string;
}

export async function autocompletePlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query || query.trim().length < 2) return [];
  const { data } = await axios.get<PlaceSuggestion[]>(`${API_BASE}/api/places/autocomplete`, {
    params: { q: query },
    timeout: 8000,
  });
  return data;
}
