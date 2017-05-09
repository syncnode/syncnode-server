/// <reference types="ws" />
/// <reference types="node" />
import * as WebSocket from 'ws';
import * as http from 'http';
import { SyncNode, SyncNodeEventEmitter } from 'syncnode-common';
export interface SyncServerMessage {
    channel: string;
    type: string;
    data: any;
}
export declare class SyncServer extends SyncNodeEventEmitter {
    connections: Set<WebSocket>;
    wss: WebSocket.Server;
    channels: {
        [key: string]: SyncServerChannel;
    };
    constructor(httpServer: http.Server);
    createChannel(name: string, data?: SyncNode): SyncServerChannel;
}
export declare class SyncServerChannel extends SyncNodeEventEmitter {
    name: string;
    data: SyncNode;
    clients: Set<WebSocket>;
    constructor(name: string, data: SyncNode);
    subscribe(socket: WebSocket): void;
    unsubscribe(socket: WebSocket): void;
    broadcast(msg: SyncServerMessage, exclude?: WebSocket): void;
    send(socket: WebSocket, msg: SyncServerMessage): void;
    handleMessage(socket: WebSocket, msg: SyncServerMessage): void;
}
export declare class SyncNodePersistFile {
    path: string;
    data: SyncNode;
    constructor(path: string, defaultData?: any);
    get(): any;
    persist(obj: any): void;
}
export declare function watch(path: string, channel: any): void;
