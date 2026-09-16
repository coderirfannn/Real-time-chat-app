/**
 * ChatLock Production Prometheus Metrics & Telemetry Service
 *
 * Implements high-throughput, in-memory counters, gauges, and histograms
 * formatted in standard Prometheus exposition format (v0.0.4).
 */

export interface HttpMetricEntry {
  method: string;
  path: string;
  statusCode: number;
}

export interface MetricSnapshot {
  uptimeSeconds: number;
  memory: {
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
  };
  http: {
    totalRequests: number;
    activeRequests: number;
    statusCodeCounts: Record<string, number>;
  };
  socket: {
    activeConnections: number;
    totalEvents: number;
    eventsByType: Record<string, number>;
  };
  db: {
    totalOperations: number;
  };
}

export class MetricsService {
  private static instance: MetricsService | null = null;

  // HTTP Metrics
  private httpRequestsTotal = new Map<string, number>();
  private httpRequestDurationSumMs = new Map<string, number>();
  private httpRequestDurationCount = new Map<string, number>();
  private httpActiveRequests = 0;

  // Socket Metrics
  private socketActiveConnections = 0;
  private socketEventsTotal = new Map<string, number>();

  // DB Metrics
  private dbOperationsTotal = new Map<string, number>();
  private dbOperationDurationSumMs = new Map<string, number>();
  private dbOperationDurationCount = new Map<string, number>();

  private startTime = Date.now();

  private constructor() {}

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Records an inbound HTTP request completion
   */
  public recordHttpRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const normalizedPath = this.normalizePath(path);
    const key = `method="${method}",path="${normalizedPath}",status="${statusCode}"`;
    this.httpRequestsTotal.set(key, (this.httpRequestsTotal.get(key) || 0) + 1);

    const routeKey = `method="${method}",path="${normalizedPath}"`;
    this.httpRequestDurationSumMs.set(
      routeKey,
      (this.httpRequestDurationSumMs.get(routeKey) || 0) + durationMs,
    );
    this.httpRequestDurationCount.set(
      routeKey,
      (this.httpRequestDurationCount.get(routeKey) || 0) + 1,
    );
  }

  public incrementActiveHttpRequests(): void {
    this.httpActiveRequests++;
  }

  public decrementActiveHttpRequests(): void {
    if (this.httpActiveRequests > 0) {
      this.httpActiveRequests--;
    }
  }

  /**
   * Socket Connection & Event tracking
   */
  public incrementSocketConnections(): void {
    this.socketActiveConnections++;
  }

  public decrementSocketConnections(): void {
    if (this.socketActiveConnections > 0) {
      this.socketActiveConnections--;
    }
  }

  public getActiveSocketConnections(): number {
    return this.socketActiveConnections;
  }

  public recordSocketEvent(event: string, direction: 'inbound' | 'outbound' = 'inbound'): void {
    const key = `event="${event}",direction="${direction}"`;
    this.socketEventsTotal.set(key, (this.socketEventsTotal.get(key) || 0) + 1);
  }

  /**
   * Database operation tracking
   */
  public recordDbOperation(collection: string, operation: string, durationMs: number): void {
    const key = `collection="${collection}",operation="${operation}"`;
    this.dbOperationsTotal.set(key, (this.dbOperationsTotal.get(key) || 0) + 1);
    this.dbOperationDurationSumMs.set(
      key,
      (this.dbOperationDurationSumMs.get(key) || 0) + durationMs,
    );
    this.dbOperationDurationCount.set(
      key,
      (this.dbOperationDurationCount.get(key) || 0) + 1,
    );
  }

  /**
   * Produces Prometheus Text Exposition Format (v0.0.4)
   */
  public getPrometheusMetrics(): string {
    const lines: string[] = [];
    const mem = process.memoryUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Process & System
    lines.push('# HELP process_uptime_seconds The process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${uptime}`);

    lines.push('# HELP process_memory_heap_used_bytes Process heap memory used in bytes.');
    lines.push('# TYPE process_memory_heap_used_bytes gauge');
    lines.push(`process_memory_heap_used_bytes ${mem.heapUsed}`);

    lines.push('# HELP process_memory_heap_total_bytes Process heap memory total in bytes.');
    lines.push('# TYPE process_memory_heap_total_bytes gauge');
    lines.push(`process_memory_heap_total_bytes ${mem.heapTotal}`);

    lines.push('# HELP process_memory_rss_bytes Process resident set size in bytes.');
    lines.push('# TYPE process_memory_rss_bytes gauge');
    lines.push(`process_memory_rss_bytes ${mem.rss}`);

    // HTTP Active
    lines.push('# HELP http_requests_in_flight Current number of HTTP requests being processed.');
    lines.push('# TYPE http_requests_in_flight gauge');
    lines.push(`http_requests_in_flight ${this.httpActiveRequests}`);

    // HTTP Total
    lines.push('# HELP http_requests_total Total number of HTTP requests processed.');
    lines.push('# TYPE http_requests_total counter');
    if (this.httpRequestsTotal.size === 0) {
      lines.push('http_requests_total 0');
    } else {
      for (const [labels, count] of this.httpRequestsTotal.entries()) {
        lines.push(`http_requests_total{${labels}} ${count}`);
      }
    }

    // HTTP Latency
    lines.push('# HELP http_request_duration_ms Total execution time of HTTP requests in milliseconds.');
    lines.push('# TYPE http_request_duration_ms summary');
    for (const [labels, sum] of this.httpRequestDurationSumMs.entries()) {
      const count = this.httpRequestDurationCount.get(labels) || 1;
      lines.push(`http_request_duration_ms_sum{${labels}} ${sum.toFixed(2)}`);
      lines.push(`http_request_duration_ms_count{${labels}} ${count}`);
    }

    // Socket Connections
    lines.push('# HELP socket_connections_active Total active WebSocket connections.');
    lines.push('# TYPE socket_connections_active gauge');
    lines.push(`socket_connections_active ${this.socketActiveConnections}`);

    // Socket Events
    lines.push('# HELP socket_events_total Total Socket.IO events processed.');
    lines.push('# TYPE socket_events_total counter');
    if (this.socketEventsTotal.size === 0) {
      lines.push('socket_events_total 0');
    } else {
      for (const [labels, count] of this.socketEventsTotal.entries()) {
        lines.push(`socket_events_total{${labels}} ${count}`);
      }
    }

    // DB Operations
    lines.push('# HELP db_operations_total Total database operations performed.');
    lines.push('# TYPE db_operations_total counter');
    if (this.dbOperationsTotal.size === 0) {
      lines.push('db_operations_total 0');
    } else {
      for (const [labels, count] of this.dbOperationsTotal.entries()) {
        lines.push(`db_operations_total{${labels}} ${count}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * JSON summary snapshot for admin API and telemetry dashboards
   */
  public getMetricsSnapshot(): MetricSnapshot {
    const mem = process.memoryUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    let totalHttp = 0;
    const statusCodeCounts: Record<string, number> = {};
    for (const [labels, count] of this.httpRequestsTotal.entries()) {
      totalHttp += count;
      const match = labels.match(/status="(\d+)"/);
      if (match && match[1]) {
        const code = match[1];
        statusCodeCounts[code] = (statusCodeCounts[code] || 0) + count;
      }
    }

    let totalSocketEvents = 0;
    const eventsByType: Record<string, number> = {};
    for (const [labels, count] of this.socketEventsTotal.entries()) {
      totalSocketEvents += count;
      const match = labels.match(/event="([^"]+)"/);
      if (match && match[1]) {
        const evt = match[1];
        eventsByType[evt] = (eventsByType[evt] || 0) + count;
      }
    }

    let totalDbOps = 0;
    for (const count of this.dbOperationsTotal.values()) {
      totalDbOps += count;
    }

    return {
      uptimeSeconds: uptime,
      memory: {
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        rssBytes: mem.rss,
      },
      http: {
        totalRequests: totalHttp,
        activeRequests: this.httpActiveRequests,
        statusCodeCounts,
      },
      socket: {
        activeConnections: this.socketActiveConnections,
        totalEvents: totalSocketEvents,
        eventsByType,
      },
      db: {
        totalOperations: totalDbOps,
      },
    };
  }

  /**
   * Reset all counters (for testing)
   */
  public reset(): void {
    this.httpRequestsTotal.clear();
    this.httpRequestDurationSumMs.clear();
    this.httpRequestDurationCount.clear();
    this.httpActiveRequests = 0;
    this.socketActiveConnections = 0;
    this.socketEventsTotal.clear();
    this.dbOperationsTotal.clear();
    this.dbOperationDurationSumMs.clear();
    this.dbOperationDurationCount.clear();
    this.startTime = Date.now();
  }

  /**
   * Normalize path by replacing IDs with parameter placeholders
   */
  private normalizePath(path: string): string {
    return path
      .replace(/[0-9a-fA-F]{24}/g, ':id')
      .replace(/[0-9a-fA-F-]{36}/g, ':uuid')
      .split('?')[0] || '/';
  }
}

export const metricsService = MetricsService.getInstance();
