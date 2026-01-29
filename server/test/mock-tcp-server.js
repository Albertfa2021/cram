const net = require('net');

// Configuration
const PORT = process.argv.includes('--port')
  ? parseInt(process.argv[process.argv.indexOf('--port') + 1], 10)
  : 5000;

const HOST = process.argv.includes('--host')
  ? process.argv[process.argv.indexOf('--host') + 1]
  : '0.0.0.0';

// Create TCP server
const server = net.createServer((socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

  let buffer = Buffer.alloc(0);

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    // Process complete messages
    while (buffer.length >= 4) {
      // Read length prefix (4 bytes, Big-Endian)
      const messageLength = buffer.readUInt32BE(0);

      // Check if we have the complete message
      if (buffer.length < 4 + messageLength) {
        break; // Wait for more data
      }

      // Extract message payload
      const messageBuffer = buffer.subarray(4, 4 + messageLength);
      buffer = buffer.subarray(4 + messageLength);

      try {
        const jsonString = messageBuffer.toString('utf8');
        const message = JSON.parse(jsonString);

        console.log(`\n[${new Date().toISOString()}] Received message (${messageLength} bytes):`);
        console.log('─'.repeat(80));
        console.log(JSON.stringify(message, null, 2));
        console.log('─'.repeat(80));

        // Send acknowledgment
        const ack = JSON.stringify({
          status: 'received',
          bytesReceived: messageLength,
          timestamp: new Date().toISOString()
        });
        const ackBuffer = Buffer.from(ack, 'utf8');
        const ackLengthBuffer = Buffer.allocUnsafe(4);
        ackLengthBuffer.writeUInt32BE(ackBuffer.length, 0);
        socket.write(Buffer.concat([ackLengthBuffer, ackBuffer]));

        console.log(`Sent acknowledgment (${ackBuffer.length} bytes)\n`);
      } catch (error) {
        console.error(`Error parsing JSON: ${error.message}`);
      }
    }
  });

  socket.on('end', () => {
    console.log(`[${new Date().toISOString()}] Client disconnected`);
  });

  socket.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Socket error: ${err.message}`);
  });
});

server.listen(PORT, HOST, () => {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         CRAM Mock TCP Server - Ready for Testing              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\nListening on ${HOST}:${PORT}`);
  console.log('Waiting for connections...\n');
});

server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down mock server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
