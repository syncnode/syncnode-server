import * as path from 'path';
import * as fs from 'fs';
import * as events from 'events';
import * as WebSocket from 'ws';
import * as http from 'http';
import * as chokidar from 'chokidar';
import { SyncNode, SyncNodeEventEmitter } from 'syncnode-client';

export interface SyncServerMessage {
  channel: string;
  type: string;
  data: any;
}

export class SyncServer extends SyncNodeEventEmitter {
  connections: Set<WebSocket>;
  wss: WebSocket.Server;
  channels: { [key: string]: SyncServerChannel };
  constructor(httpServer: http.Server) {
    super();
    this.connections = new Set();
    this.wss = new WebSocket.Server({ server: httpServer });
    this.channels = {};

    this.wss.on('connection', (socket: WebSocket) => {
      this.connections.add(socket);
      socket.on('close', () => {
        this.connections.delete(socket);
      });
      socket.on('message', (msg: string) => {
        msg = msg || '';
        let deserialized = JSON.parse(msg);
        console.log('received2', deserialized);
        let channel = this.channels[deserialized.channel];
        if (!channel) {
          console.error('Channel does not exists: ', channel);
        } else {
          channel.handleMessage(socket, deserialized);
        }
      });
      console.log('Syncnode client connected to server.');
    });
  }
  createChannel(name: string, data?: SyncNode): SyncServerChannel {
    data = data || new SyncNode({});
    let channel = new SyncServerChannel(name, data);
    this.channels[name] = channel;
    return channel;
  }
}


export class SyncServerChannel extends SyncNodeEventEmitter {
  name: string;
  data: SyncNode;
  clients: Set<WebSocket>;

  constructor(name: string, data: SyncNode) {
    super();

    this.name = name;
    this.data = data;
    this.clients = new Set();
  }

  subscribe(socket: WebSocket) {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
  }

  unsubscribe(socket: WebSocket) {
    this.clients.delete(socket);
  }

  broadcast(msg: SyncServerMessage, exclude?: WebSocket) {
    msg.channel = this.name;
    this.clients.forEach((socket: WebSocket) => {
      if (socket !== exclude) this.send(socket, msg);
    });
  }

  send(socket: WebSocket, msg: SyncServerMessage) {
    socket.send(JSON.stringify(msg));
  }

  handleMessage(socket: WebSocket, msg: SyncServerMessage) {
    switch (msg.type) {
      case 'subscribe':
        this.subscribe(socket);
        this.send(socket, { channel: this.name, type: 'subscribed', data: this.data});
        break;
      case 'updated':
        let merge = msg.data;
        console.log('merge', merge);
        this.data.merge(merge);
        this.broadcast({ channel: this.name, type: 'updated', data: merge });
        break;
      default:
        this.emit(msg.type, msg.data);
        break;
    }
  }
}

export class SyncNodePersistFile {
    path: string;
    data: SyncNode;
    constructor(path: string, defaultData: any = {}) {
        this.path = path;
        let data: any;
        try {
            this.data = new SyncNode(this.get());
        } catch(err) {
            if(err.code === 'ENOENT') {
                console.log('File does not exist, using defualtData.');
            } else {
                console.log('Could not read data:  ', err);
            }
            this.data = new SyncNode(defaultData);
        }
        this.data.on('updated', () => {
            this.persist(this.data);
        });
    }

	get(): any {
		let result = fs.readFileSync(this.path, 'utf8');
        return JSON.parse(result || '{}');
	}

	persist(obj: any) {
		console.log(this.path);
	    fs.writeFile(this.path, JSON.stringify(obj), (err) => {
			if (err) {
				console.error('Failed to write ' + this.path + ': ' + err);
			}
		});
	}
}


export function watch(path: string, channel: any) {
  (chokidar.watch(path, { depth: 99 }) as any).on('change', (filePath: string) => {
    if (filePath.match(/\.js$/i) !== null
      || filePath.match(/\.html$/i) !== null
      || filePath.match(/\.css$/i) !== null
    ) {
      console.log('File changed: ', filePath);
      channel.broadcast({ type: 'reload' });
    }
  });
}
