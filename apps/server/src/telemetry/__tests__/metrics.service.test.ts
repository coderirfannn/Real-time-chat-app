import { describe, it, expect, beforeEach } from 'vitest';
import { metricsService } from '../metrics.service.js';

describe('MetricsService (Prometheus Telemetry Engine)', () => {
  beforeEach(() => {
    metricsService.reset();
  });

  it('initializes with default metrics structure', () => {
    const snapshot = metricsService.getMetricsSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.http.totalRequests).toBe(0);
    expect(snapshot.socket.activeConnections).toBe(0);
    expect(snapshot.socket.totalEvents).toBe(0);
    expect(snapshot.memory.heapUsedBytes).toBeGreaterThan(0);
  });

  it('records HTTP requests and calculates latencies', () => {
    metricsService.recordHttpRequest('GET', '/api/v1/health', 200, 12.5);
    metricsService.recordHttpRequest('GET', '/api/v1/health', 200, 15.0);
    metricsService.recordHttpRequest('POST', '/api/v1/auth/login', 401, 45.2);

    const snapshot = metricsService.getMetricsSnapshot();
    expect(snapshot.http.totalRequests).toBe(3);
    expect(snapshot.http.statusCodeCounts['200']).toBe(2);
    expect(snapshot.http.statusCodeCounts['401']).toBe(1);

    const prometheusText = metricsService.getPrometheusMetrics();
    expect(prometheusText).toContain('http_requests_total{method="GET",path="/api/v1/health",status="200"} 2');
    expect(prometheusText).toContain('http_requests_total{method="POST",path="/api/v1/auth/login",status="401"} 1');
    expect(prometheusText).toContain('http_request_duration_ms_sum{method="GET",path="/api/v1/health"} 27.50');
    expect(prometheusText).toContain('http_request_duration_ms_count{method="GET",path="/api/v1/health"} 2');
  });

  it('tracks active and total socket connections and events', () => {
    metricsService.incrementSocketConnections();
    metricsService.incrementSocketConnections();
    expect(metricsService.getActiveSocketConnections()).toBe(2);

    metricsService.recordSocketEvent('message:send', 'inbound');
    metricsService.recordSocketEvent('message:new', 'outbound');

    metricsService.decrementSocketConnections();
    expect(metricsService.getActiveSocketConnections()).toBe(1);

    const snapshot = metricsService.getMetricsSnapshot();
    expect(snapshot.socket.activeConnections).toBe(1);
    expect(snapshot.socket.totalEvents).toBe(2);
    expect(snapshot.socket.eventsByType['message:send']).toBe(1);

    const prometheusText = metricsService.getPrometheusMetrics();
    expect(prometheusText).toContain('socket_connections_active 1');
    expect(prometheusText).toContain('socket_events_total{event="message:send",direction="inbound"} 1');
    expect(prometheusText).toContain('socket_events_total{event="message:new",direction="outbound"} 1');
  });

  it('tracks database query durations and operations', () => {
    metricsService.recordDbOperation('users', 'findOne', 5.4);
    metricsService.recordDbOperation('messages', 'create', 14.2);

    const snapshot = metricsService.getMetricsSnapshot();
    expect(snapshot.db.totalOperations).toBe(2);

    const prometheusText = metricsService.getPrometheusMetrics();
    expect(prometheusText).toContain('db_operations_total{collection="users",operation="findOne"} 1');
    expect(prometheusText).toContain('db_operations_total{collection="messages",operation="create"} 1');
  });

  it('normalizes dynamic MongoDB ObjectIds and UUIDs in routes', () => {
    metricsService.recordHttpRequest('GET', '/api/v1/users/507f1f77bcf86cd799439011', 200, 8.0);
    metricsService.recordHttpRequest('GET', '/api/v1/users/507f1f77bcf86cd799439022', 200, 9.0);

    const snapshot = metricsService.getMetricsSnapshot();
    expect(snapshot.http.totalRequests).toBe(2);

    const prometheusText = metricsService.getPrometheusMetrics();
    expect(prometheusText).toContain('http_requests_total{method="GET",path="/api/v1/users/:id",status="200"} 2');
  });

  it('tracks in-flight active HTTP requests', () => {
    metricsService.incrementActiveHttpRequests();
    metricsService.incrementActiveHttpRequests();

    let snapshot = metricsService.getMetricsSnapshot();
    expect(snapshot.http.activeRequests).toBe(2);

    metricsService.decrementActiveHttpRequests();
    snapshot = metricsService.getMetricsSnapshot();
    expect(snapshot.http.activeRequests).toBe(1);

    const prometheusText = metricsService.getPrometheusMetrics();
    expect(prometheusText).toContain('http_requests_in_flight 1');
  });
});
