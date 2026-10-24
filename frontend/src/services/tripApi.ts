import axios from 'axios';
import type { TripRequest, TripResponse } from '../types/trip';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

export async function computeTrip(req: TripRequest, signal?: AbortSignal): Promise<TripResponse[]> {
  const { data } = await client.post<TripResponse[]>('/api/trip', req, { signal });
  return data;
}

export { axios };
