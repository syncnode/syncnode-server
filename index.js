"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const WebSocket = require("ws");
const chokidar = require("chokidar");
const syncnode_common_1 = require("syncnode-common");
class SyncServer extends syncnode_common_1.SyncNodeEventEmitter {
    constructor(httpServer) {
        super();
        this.connections = new Set();
        this.wss = new WebSocket.Server({ server: httpServer });
        this.channels = {};
        this.wss.on('connection', (socket) => {
            this.connections.add(socket);
            socket.on('close', () => {
                this.connections.delete(socket);
            });
            socket.on('message', (msg) => {
                msg = msg || '';
                let deserialized = JSON.parse(msg);
                console.log('received2', deserialized);
                let channel = this.channels[deserialized.channel];
                if (!channel) {
                    console.error('Channel does not exists: ', channel);
                }
                else {
                    channel.handleMessage(socket, deserialized);
                }
            });
            console.log('Syncnode client connected to server.');
        });
    }
    createChannel(name, data) {
        data = data || new syncnode_common_1.SyncNode({});
        let channel = new SyncServerChannel(name, data);
        this.channels[name] = channel;
        return channel;
    }
}
exports.SyncServer = SyncServer;
class SyncServerChannel extends syncnode_common_1.SyncNodeEventEmitter {
    constructor(name, data) {
        super();
        this.name = name;
        this.data = data;
        this.clients = new Set();
    }
    subscribe(socket) {
        this.clients.add(socket);
        socket.on('close', () => this.clients.delete(socket));
    }
    unsubscribe(socket) {
        this.clients.delete(socket);
    }
    broadcast(msg, exclude) {
        msg.channel = this.name;
        this.clients.forEach((socket) => {
            if (socket !== exclude)
                this.send(socket, msg);
        });
    }
    send(socket, msg) {
        socket.send(JSON.stringify(msg));
    }
    handleMessage(socket, msg) {
        switch (msg.type) {
            case 'subscribe':
                this.subscribe(socket);
                this.send(socket, { channel: this.name, type: 'subscribed', data: this.data });
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
exports.SyncServerChannel = SyncServerChannel;
class SyncNodePersistFile {
    constructor(path, defaultData = {}) {
        this.path = path;
        let data;
        try {
            this.data = new syncnode_common_1.SyncNode(this.get());
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                console.log('File does not exist, using defualtData.');
            }
            else {
                console.log('Could not read data:  ', err);
            }
            this.data = new syncnode_common_1.SyncNode(defaultData);
        }
        this.data.on('updated', () => {
            this.persist(this.data);
        });
    }
    get() {
        let result = fs.readFileSync(this.path, 'utf8');
        return JSON.parse(result || '{}');
    }
    persist(obj) {
        console.log(this.path);
        fs.writeFile(this.path, JSON.stringify(obj), (err) => {
            if (err) {
                console.error('Failed to write ' + this.path + ': ' + err);
            }
        });
    }
}
exports.SyncNodePersistFile = SyncNodePersistFile;
function watch(path, channel) {
    chokidar.watch(path, { depth: 99 }).on('change', (filePath) => {
        if (filePath.match(/\.js$/i) !== null
            || filePath.match(/\.html$/i) !== null
            || filePath.match(/\.css$/i) !== null) {
            console.log('File changed: ', filePath);
            channel.broadcast({ type: 'reload' });
        }
    });
}
exports.watch = watch;
