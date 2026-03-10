'use strict';

// [RETIRED — Phase 03]
// This file is no longer loaded by index.js.
// gRPC streaming is now handled by replay-runner.js which spawns
// ts_auralization_controller (sapf/examples/ts_auralization_controller/dist/main.js)
// with a generated --replay-file instead of implementing the gRPC protocol directly.
// Kept for reference only.


const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const winston = require('winston');

const { convertToRenderFrame } = require('./frame-converter');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [gRPC] ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

/**
 * Resolve the proto file path.
 * Priority: configured path → default relative to this file → cwd fallback.
 */
function resolveProtoPath(configuredPath) {
  const candidates = configuredPath
    ? [path.resolve(__dirname, configuredPath)]
    : [
        path.resolve(__dirname, '../../sapf/services/proto/path_render.proto'),
        path.resolve(process.cwd(), 'services/proto/path_render.proto')
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `path_render.proto not found, checked: ${candidates.join(', ')}`
  );
}

class GrpcClient {
  constructor(config) {
    this.config = config;
    this.call = null;
    this.timer = null;
    // Start sequence at current epoch-seconds to guarantee it is always
    // higher than any previous session's sequence after a server restart.
    this.frameSeq = Math.floor(Date.now() / 1000);
    this.ackCount = 0;
    this.lastAck = null;
    this.streaming = false;
    this.currentFrameData = null;

    const protoPath = resolveProtoPath(config.grpc.protoPath);
    const packageDef = protoLoader.loadSync(protoPath, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    const grpcObj = grpc.loadPackageDefinition(packageDef);
    const ServiceCtor = grpcObj.apf.pathrender.v1.PathRenderControl;

    const metadata = new grpc.Metadata();
    if (config.grpc.instanceId && config.grpc.instanceId.length > 0) {
      metadata.set('x-sapf-instance-id', config.grpc.instanceId);
    }
    this._metadata = metadata;

    this._client = new ServiceCtor(
      config.grpc.endpoint,
      grpc.credentials.createInsecure()
    );

    logger.info(`Client created, endpoint=${config.grpc.endpoint}`);
  }

  /**
   * Open a new StreamRenderFrames duplex stream.
   * No-op if a stream is already open.
   */
  connect() {
    if (this.call) {
      logger.warn('Stream already open, skipping connect()');
      return;
    }

    this.call = this._client.StreamRenderFrames(this._metadata);

    this.call.on('data', (ack) => {
      this.ackCount += 1;
      this.lastAck = ack;

      if (ack.rejectedOldFrame) {
        const sapfSeq = parseInt(ack.acceptedSeq, 10) || 0;
        if (sapfSeq >= this.frameSeq) {
          // Jump our counter so the next frame is accepted immediately
          this.frameSeq = sapfSeq;
          logger.warn(
            `Seq desync recovered: jumping frameSeq to ${sapfSeq + 1} ` +
              `(SAPF acceptedSeq=${sapfSeq})`
          );
        } else {
          logger.warn(
            `RenderAck: rejected_old_frame=true accepted=${ack.acceptedSeq}`
          );
        }
      } else {
        logger.debug(
          `RenderAck: accepted=${ack.acceptedSeq} queue=${ack.queueDepth} ` +
            `apply_us=${ack.applyLatencyUs} dropped=${ack.droppedPaths} overloaded=${ack.overloaded}`
        );
      }
    });

    this.call.on('error', (err) => {
      logger.error(`Stream error: ${err.message}`);
      this._cleanupCall();
    });

    this.call.on('end', () => {
      logger.info('Stream ended');
      this._cleanupCall();
    });

    logger.info('Stream opened');
  }

  /**
   * Start streaming RenderFrames at the configured interval.
   * If already streaming, replaces the frame data and resets the interval.
   *
   * @param {object} frameData - CRAM export JSON { metadata, rayPaths }
   */
  startStream(frameData) {
    this.currentFrameData = frameData;

    if (!this.call) {
      this.connect();
    }

    // Reset interval (handles the case where startStream is called again)
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.streaming = true;
    const intervalMs = this.config.grpc.frameIntervalMs;

    this.timer = setInterval(() => {
      if (!this.call || !this.streaming) {
        clearInterval(this.timer);
        this.timer = null;
        return;
      }

      this.frameSeq += 1;
      let frame;
      try {
        frame = convertToRenderFrame(this.currentFrameData, this.frameSeq);
      } catch (err) {
        logger.error(`Frame conversion error: ${err.message}`);
        return;
      }

      const accepted = this.call.write(frame);
      if (!accepted) {
        logger.warn('Back-pressure: write() returned false, stopping stream');
        this.stopStream();
        return;
      }

      logger.debug(
        `Frame sent: seq=${this.frameSeq} paths=${frame.sources[0].paths.length}`
      );
    }, intervalMs);

    logger.info(
      `Streaming started, interval=${intervalMs}ms, ` +
        `paths=${this._countPaths(frameData)}`
    );
  }

  /**
   * Stop the streaming interval and close the gRPC stream.
   */
  stopStream() {
    if (!this.streaming && !this.timer && !this.call) {
      return;
    }
    this.streaming = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.call) {
      try {
        this.call.end();
      } catch (err) {
        logger.error(`Error ending stream: ${err.message}`);
      }
      this.call = null;
    }

    logger.info('Streaming stopped');
  }

  /**
   * Stop streaming and close the underlying gRPC channel.
   */
  disconnect() {
    this.stopStream();
    if (this._client) {
      this._client.close();
      logger.info('gRPC channel closed');
    }
  }

  /**
   * Return current connection and streaming statistics.
   * @returns {{ connected: boolean, streaming: boolean, frameSeq: number, ackCount: number, queueDepth: number }}
   */
  getStatus() {
    return {
      connected: this.call !== null,
      streaming: this.streaming,
      frameSeq: this.frameSeq,
      ackCount: this.ackCount,
      queueDepth: this.lastAck ? (this.lastAck.queueDepth || 0) : 0
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _cleanupCall() {
    this.streaming = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.call = null;
  }

  _countPaths(frameData) {
    try {
      const valid = (frameData.rayPaths || []).filter(p => p.isValid !== false);
      return valid.length;
    } catch (_) {
      return '?';
    }
  }
}

module.exports = GrpcClient;
