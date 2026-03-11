'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const winston = require('winston');

const { buildReplayFrames } = require('./frame-converter');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [ReplayRunner] ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

const os = require('os');

const TMP_DIR = path.join(os.tmpdir(), 'cram-sapf-tmp');

/**
 * Drops a replay JSON file to TMP_DIR and spawns ts_auralization_controller
 * with --replay-file.  Provides the same public interface as the old GrpcClient
 * so websocket-server.js requires no changes.
 */
class ReplayRunner {
  constructor(config) {
    this.config = config;
    this.child = null;
    this.streaming = false;
    this.replayFile = null;
    this.ackCount = 0;
    this.lastQueueDepth = 0;
    this.lastFrameSeq = 0;
    this.nextFrameSeq = 1;

    const tsPath = config.grpc.tsControllerPath;
    if (!fs.existsSync(tsPath)) {
      throw new Error(
        `ts_auralization_controller not found at: ${tsPath}\n` +
        'Run: npm install && npm run build in sapf/examples/ts_auralization_controller/'
      );
    }
    logger.info(`ts_auralization_controller path resolved: ${tsPath}`);

    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  /**
   * Convert cramData → replay JSON → spawn ts_auralization_controller.
   * If already streaming, stops the previous session first.
   *
   * @param {object} cramData - { metadata, rayPaths }
   */
  startStream(cramData) {
    if (this.streaming) {
      this.stopStream();
    }

    const frameCount = this.config.grpc.replayFrames;
    const startSeq = this.nextFrameSeq;
    const frames = buildReplayFrames(cramData, frameCount, startSeq);
    this.nextFrameSeq = startSeq + frameCount;

    this.replayFile = path.join(TMP_DIR, `replay-${Date.now()}.json`);
    fs.writeFileSync(this.replayFile, JSON.stringify(frames));
    logger.info(
      `Wrote replay.json (${frames.length} frames, ` +
      `${frames[0].sources[0].paths.length} paths) → ${this.replayFile}`
    );

    const args = [
      this.config.grpc.tsControllerPath,
      '--replay-file', this.replayFile,
      '--endpoint', this.config.grpc.endpoint,
      '--interval-ms', String(this.config.grpc.frameIntervalMs),
      '--ack-verbose', 'false'
    ];

    if (this.config.grpc.instanceId) {
      args.push('--instance-id', this.config.grpc.instanceId);
    }

    this.child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.streaming = true;
    this.ackCount = 0;
    this.lastQueueDepth = 0;

    logger.info(`Spawned PID=${this.child.pid}`);

    // Capture the file path for THIS process in the closure, so that if a new
    // session starts (and this.replayFile is updated) before this process exits,
    // we only delete the file that belongs to this process — not the new one.
    const ownFile = this.replayFile;

    this.child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      // Parse ACK lines emitted by ts_auralization_controller:
      // "ACK accepted_seq=N queue_depth=N apply_latency_us=N ..."
      const ackMatch = text.match(/ACK\s+accepted_seq=(\d+)\s+queue_depth=(\d+)/);
      if (ackMatch) {
        this.ackCount += 1;
        this.lastFrameSeq = parseInt(ackMatch[1], 10);
        this.lastQueueDepth = parseInt(ackMatch[2], 10);
      }
      // Forward stdout to our logger at debug level
      text.trim().split('\n').forEach(line => {
        if (line) logger.debug(`[ts-ctrl] ${line}`);
      });
    });

    this.child.stderr.on('data', (chunk) => {
      chunk.toString().trim().split('\n').forEach(line => {
        if (line) logger.warn(`[ts-ctrl] ${line}`);
      });
    });

    this.child.on('close', (code) => {
      logger.info(`Process exited with code ${code}`);
      this.streaming = false;
      this.child = null;
      // Only delete the file owned by this process instance
      if (ownFile && fs.existsSync(ownFile)) {
        try { fs.unlinkSync(ownFile); } catch (_) {}
      }
      if (this.replayFile === ownFile) this.replayFile = null;
    });

    this.child.on('error', (err) => {
      logger.error(`Spawn error: ${err.message}`);
      this.streaming = false;
      this.child = null;
      if (ownFile && fs.existsSync(ownFile)) {
        try { fs.unlinkSync(ownFile); } catch (_) {}
      }
      if (this.replayFile === ownFile) this.replayFile = null;
    });
  }

  /**
   * Kill the child process and clean up the temporary replay file.
   */
  stopStream() {
    if (!this.child) {
      return;
    }
    logger.info(`Killing PID=${this.child.pid}`);
    try {
      this.child.kill('SIGTERM');
    } catch (_) {
      // Process may have already exited
    }
    this.streaming = false;
    this.child = null;
    logger.info('Streaming stopped');
  }

  /** Alias for stopStream — matches old GrpcClient interface. */
  disconnect() {
    this.stopStream();
  }

  /**
   * Return status compatible with old grpcClient.getStatus().
   */
  getStatus() {
    return {
      connected: this.streaming,
      streaming: this.streaming,
      frameSeq: this.lastFrameSeq,
      ackCount: this.ackCount,
      queueDepth: this.lastQueueDepth
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _cleanupReplayFile() {
    if (this.replayFile && fs.existsSync(this.replayFile)) {
      try {
        fs.unlinkSync(this.replayFile);
      } catch (_) {}
      this.replayFile = null;
    }
  }
}

module.exports = ReplayRunner;
