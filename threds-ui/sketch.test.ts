import assert from 'node:assert/strict';
import test from 'node:test';
import { clipboardImageFiles, drawSketchObjects, exportSketchPng, SKETCH_SIZE, type SketchObject } from './sketch.ts';
import { SketchCable } from './services/sketchCable.ts';
import { api } from './services/api.ts';

test('clipboard image handling accepts image data and ignores other clipboard items', () => {
  const image = new File(['pixels'], 'paste.png', { type: 'image/png' });
  const items = [
    { type: 'text/plain', getAsFile: () => null },
    { type: 'image/png', getAsFile: () => image },
    { type: 'image/jpeg', getAsFile: () => null },
  ];

  assert.deepEqual(clipboardImageFiles(items), [image]);
});

test('clipboard image uploads use the existing media endpoint and keyed-thread authorization', async () => {
  const file = new File(['pixels'], 'paste.png', { type: 'image/png' });
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ imageUrl: 'https://cloudinary.example/paste.png' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    assert.equal(await api.uploadMedia(file, 'thread-1', 'thread-secret'), 'https://cloudinary.example/paste.png');
    assert.equal(requestUrl, '/upload');
    assert.equal(((requestInit?.body as FormData).get('file') as File).name, 'paste.png');
    assert.equal((requestInit?.body as FormData).get('thread_id'), 'thread-1');
    assert.equal(new Headers(requestInit?.headers).get('X-Thred-Key'), 'thread-secret');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sketch operations are persisted with their idempotency ID and keyed-thread header', async () => {
  const operation = {
    operationId: 'client-operation-1',
    type: 'arrow' as const,
    data: { x1: 10, y1: 20, x2: 90, y2: 100, color: '#111827', strokeWidth: 4 },
  };
  const saved: SketchObject = { ...operation, id: 'stored-1', createdAt: '2026-11-08T00:00:00.000Z' };
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify(init?.method === 'POST' ? { operation: saved } : { objects: [saved] }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await api.createSketchObject('thread-1', operation, 'thread-secret');
    assert.equal(requestUrl, '/threds/thread-1/sketch/objects');
    assert.deepEqual(JSON.parse(String(requestInit?.body)), operation);
    assert.equal(new Headers(requestInit?.headers).get('X-Thred-Key'), 'thread-secret');
    assert.equal(result.id, saved.id);
    assert.deepEqual(await api.fetchSketch('thread-1'), [saved]);
    assert.equal(requestUrl, '/threds/thread-1/sketch');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('PNG export renders a 4000 by 4000 PNG canvas', async () => {
  const dimensions: number[] = [];
  let exportedType = '';
  const context = {
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    strokeRect: () => {},
    ellipse: () => {},
    stroke: () => {},
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    set width(value: number) { dimensions[0] = value; },
    set height(value: number) { dimensions[1] = value; },
    getContext: () => context,
    toBlob: (callback: BlobCallback, type?: string) => {
      exportedType = type || '';
      callback(new Blob(['png'], { type }));
    },
  };
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => canvas },
  });

  try {
    const png = await exportSketchPng([]);
    assert.deepEqual(dimensions, [SKETCH_SIZE, SKETCH_SIZE]);
    assert.equal(exportedType, 'image/png');
    assert.equal(png.type, 'image/png');
  } finally {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
  }
});

test('PNG drawing preserves the contained image dimensions used by the SVG canvas', () => {
  let drawArgs: number[] = [];
  const context = {
    drawImage: (_image: HTMLImageElement, ...args: number[]) => { drawArgs = args; },
  } as unknown as CanvasRenderingContext2D;
  const image = { naturalWidth: 200, naturalHeight: 100 } as HTMLImageElement;
  const object: SketchObject = {
    id: 'image-1',
    operationId: 'image-op-1',
    type: 'image',
    data: { url: 'https://cloudinary.example/image.png', x: 100, y: 100, width: 800, height: 600 },
    createdAt: '',
  };

  drawSketchObjects(context, [object], new Map([[object.data.url!, image]]));

  assert.deepEqual(drawArgs, [100, 200, 800, 400]);
});

test('Action Cable reloads state after subscription and delivers live operations after reconnect', async () => {
  class FakeSocket {
    readyState = 1;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    sent: string[] = [];
    send(message: string) { this.sent.push(message); }
    close() { this.onclose?.({} as CloseEvent); }
    open() { this.onopen?.({} as Event); }
    receive(message: object) {
      this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
    }
  }

  const sockets: FakeSocket[] = [];
  const operations: SketchObject[] = [];
  let reloads = 0;
  const cable = new SketchCable(
    'thread-1',
    (operation) => operations.push(operation),
    () => {},
    () => { reloads += 1; },
    () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    1,
  );
  const stop = cable.start();
  sockets[0].open();
  assert.equal(JSON.parse(sockets[0].sent[0]).command, 'subscribe');
  sockets[0].receive({ type: 'confirm_subscription' });
  assert.equal(reloads, 1);
  sockets[0].receive({ message: { operation: { id: '1', operationId: 'op-1', type: 'line', data: {}, createdAt: '' } } });
  assert.equal(operations.length, 1);

  sockets[0].close();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(sockets.length, 2);
  sockets[1].open();
  sockets[1].receive({ type: 'confirm_subscription' });
  assert.equal(reloads, 2);
  stop();
});
