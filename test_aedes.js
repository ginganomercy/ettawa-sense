import http from 'http';
import { Aedes } from 'aedes';
import { createServer } from 'aedes-server-factory';
import mqtt from 'mqtt';

const port = 3005;
const httpServer = http.createServer((req, res) => { res.end('ok')});
const aedes = new Aedes();

createServer(aedes, { ws: true, server: httpServer });

httpServer.listen(port, () => {
  console.log('HTTP listening');
  const client = mqtt.connect('ws://localhost:' + port);
  client.on('connect', () => {
    console.log('MQTT Connected');
    process.exit(0);
  });
  client.on('error', (err) => {
    console.log('Error:', err);
    process.exit(1);
  });
});
