import type { SketchObject } from '../sketch';

type CableStatus = 'connecting' | 'connected' | 'disconnected';
type CableSocket = Pick<WebSocket, 'readyState' | 'send' | 'close' | 'onopen' | 'onmessage' | 'onclose' | 'onerror'>;
type SocketFactory = (url: string) => CableSocket;

const API_BASE = import.meta.env?.VITE_API_URL;
const RETRY_DELAY_MS = 1500;

export class SketchCable {
  private socket: CableSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private subscribed = false;
  private retryDelay = RETRY_DELAY_MS;
  private readonly threadId: string;
  private readonly onOperation: (operation: SketchObject) => void;
  private readonly onStatus: (status: CableStatus) => void;
  private readonly onReconnect: () => void;
  private readonly createSocket: SocketFactory;
  private readonly initialRetryDelay: number;

  constructor(
    threadId: string,
    onOperation: (operation: SketchObject) => void,
    onStatus: (status: CableStatus) => void,
    onReconnect: () => void,
    createSocket: SocketFactory = (url) => new WebSocket(url),
    initialRetryDelay = RETRY_DELAY_MS,
  ) {
    this.threadId = threadId;
    this.onOperation = onOperation;
    this.onStatus = onStatus;
    this.onReconnect = onReconnect;
    this.createSocket = createSocket;
    this.initialRetryDelay = initialRetryDelay;
    this.retryDelay = initialRetryDelay;
  }

  start() {
    this.stopped = false;
    this.connect();
    return () => this.stop();
  }

  private connect() {
    if (this.stopped) return;
    this.onStatus('connecting');

    const origin = API_BASE || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const url = new URL('/cable', origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.createSocket(url.toString());
    this.socket = socket;
    this.subscribed = false;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        command: 'subscribe',
        identifier: JSON.stringify({ channel: 'SketchChannel', thread_id: this.threadId }),
      }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse((event as MessageEvent).data);
      if (message.type === 'welcome') this.retryDelay = this.initialRetryDelay;
      if (message.type === 'confirm_subscription' && !this.subscribed) {
        this.subscribed = true;
        this.onStatus('connected');
        this.onReconnect();
      }
      if (message.type === 'reject_subscription') {
        this.onStatus('disconnected');
        socket.close();
      }

      const operation = message.message?.operation;
      if (operation) this.onOperation(operation);
    };

    socket.onerror = () => {
      this.onStatus('disconnected');
    };

    socket.onclose = () => {
      if (this.stopped) return;
      this.onStatus('disconnected');
      this.retryTimer = setTimeout(() => this.connect(), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 15_000);
    };
  }

  private stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
  }
}
