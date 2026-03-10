'use strict';

/**
 * mock-grpc-server.js
 *
 * Simulates the SAPF PathRenderControl gRPC service for local testing
 * without a running SAPF instance.
 *
 * Usage:
 *   node test/mock-grpc-server.js
 *
 * Then start the CRAM server (npm run server:start) and click "Send to Network"
 * in the CRAM UI — the mock server will log received RenderFrames and reply with
 * RenderAck messages.
 */

const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.resolve(
  __dirname,
  '../../../sapf/services/proto/path_render.proto'
);

if (!fs.existsSync(PROTO_PATH)) {
  console.error(`[mock-grpc] Proto file not found: ${PROTO_PATH}`);
  process.exit(1);
}

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const grpcObj = grpc.loadPackageDefinition(packageDef);
const { PathRenderControl } = grpcObj.apf.pathrender.v1;

let receivedFrames = 0;
let lastSeq = 0;
let oldFrameRejects = 0;

/**
 * Implementation of StreamRenderFrames bidirectional RPC.
 */
function streamRenderFrames(call) {
  console.log('[mock-grpc] StreamRenderFrames stream opened');

  call.on('data', (frame) => {
    receivedFrames += 1;
    const seq = parseInt(frame.frameSeq, 10) || 0;

    const rejectedOldFrame = seq <= lastSeq;
    if (rejectedOldFrame) {
      oldFrameRejects += 1;
      console.warn(
        `[mock-grpc] Rejected old frame: received seq=${seq} last=${lastSeq}`
      );
    } else {
      lastSeq = seq;
    }

    const pathCount = frame.sources
      ? frame.sources.reduce((n, s) => n + (s.paths ? s.paths.length : 0), 0)
      : 0;

    console.log(
      `[mock-grpc] Frame #${receivedFrames}: seq=${seq} scene=${frame.sceneId} ` +
        `paths=${pathCount} receiver=(${frame.receiverPosM ? frame.receiverPosM.x.toFixed(2) : '?'}, ` +
        `${frame.receiverPosM ? frame.receiverPosM.y.toFixed(2) : '?'}, ` +
        `${frame.receiverPosM ? frame.receiverPosM.z.toFixed(2) : '?'})`
    );

    // Simulate realistic queue and latency
    const queueDepth = Math.max(0, receivedFrames % 3);
    const applyLatencyUs = 400 + Math.floor(Math.random() * 200);

    const ack = {
      acceptedSeq: rejectedOldFrame ? lastSeq.toString() : seq.toString(),
      droppedPaths: 0,
      queueDepth,
      applyLatencyUs,
      overloaded: false,
      rejectedOldFrame,
      submittedSeq: seq.toString(),
      enqueued: !rejectedOldFrame,
      applied: !rejectedOldFrame,
      droppedInQueue: false,
      grpcDropCount: '0',
      oldFrameRejectCount: oldFrameRejects.toString(),
      renderGlitchCount: '0',
      controlCommitP50Us: 300,
      controlCommitP95Us: 600,
      controlCommitP99Us: 900,
      audioBlockP50Us: 200,
      audioBlockP95Us: 400,
      audioBlockP99Us: 600
    };

    call.write(ack);
  });

  call.on('end', () => {
    console.log(
      `[mock-grpc] Stream closed by client. Total frames received: ${receivedFrames}, ` +
        `old-frame rejects: ${oldFrameRejects}`
    );
    call.end();
  });

  call.on('error', (err) => {
    console.error(`[mock-grpc] Stream error: ${err.message}`);
  });
}

function main() {
  const port = process.env.GRPC_PORT || '50051';
  const host = `0.0.0.0:${port}`;

  const server = new grpc.Server();
  server.addService(PathRenderControl.service, { StreamRenderFrames: streamRenderFrames });

  server.bindAsync(host, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      console.error(`[mock-grpc] Failed to bind: ${err.message}`);
      process.exit(1);
    }
    console.log(`[mock-grpc] PathRenderControl mock server listening on port ${boundPort}`);
    console.log('[mock-grpc] Waiting for StreamRenderFrames connections...');
  });

  process.on('SIGINT', () => {
    console.log('\n[mock-grpc] Shutting down...');
    server.forceShutdown();
    process.exit(0);
  });
}

main();
