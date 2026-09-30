/** GET /api/health */
export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  time: string;
}
