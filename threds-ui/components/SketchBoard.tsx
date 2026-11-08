import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import {
  clipboardImageFiles,
  drawingStrokeWidth,
  nextImagePosition,
  SKETCH_SIZE,
  type SketchObject,
  type SketchObjectData,
  type SketchObjectType,
  type SketchPoint,
  type SketchTool,
  visibleSketchObjects,
} from '../sketch';
import { ProtectionBadge } from './ProtectionBadge';

const COLORS = ['#111827', '#ffffff', '#dc2626', '#f97316', '#facc15', '#16a34a', '#2563eb', '#9333ea', '#ec4899'];
const WIDTHS = [4, 10, 20, 36];
const TOOLS: { name: SketchTool | 'eraser' | 'select'; icon: string; label: string }[] = [
  { name: 'select', icon: 'fa-mouse-pointer', label: 'Select / move image' },
  { name: 'stroke', icon: 'fa-pencil-alt', label: 'Pencil' },
  { name: 'eraser', icon: 'fa-eraser', label: 'Eraser' },
  { name: 'line', icon: 'fa-minus', label: 'Line' },
  { name: 'rectangle', icon: 'fa-square', label: 'Rectangle' },
  { name: 'ellipse', icon: 'fa-circle', label: 'Ellipse' },
  { name: 'arrow', icon: 'fa-long-arrow-alt-right', label: 'Arrow' },
];

type PendingOperation = Pick<SketchObject, 'operationId' | 'type' | 'data'>;
type ImageManipulation = {
  operationId: string;
  mode: 'move' | 'resize';
  start: SketchPoint;
  originalData: SketchObjectData;
};

interface SketchBoardProps {
  threadId: string;
  threadTitle: string;
  isKeyed: boolean;
  postsPanel: React.ReactNode;
}

const mergeObject = (objects: SketchObject[], operation: SketchObject): SketchObject[] => {
  const existingIndex = objects.findIndex((object) => object.operationId === operation.operationId);
  if (existingIndex < 0) {
    return [...objects, operation].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
  if (objects[existingIndex].id === operation.id) return objects;

  return objects
    .map((object, index) => index === existingIndex ? operation : object)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

const transformImageData = (manipulation: ImageManipulation, point: SketchPoint): SketchObjectData => {
  const deltaX = point.x - manipulation.start.x;
  const deltaY = point.y - manipulation.start.y;
  const original = manipulation.originalData;
  const x = original.x!;
  const y = original.y!;
  const width = original.width!;
  const height = original.height!;
  return manipulation.mode === 'move'
    ? {
      ...original,
      x: Math.max(0, Math.min(SKETCH_SIZE - width, x + deltaX)),
      y: Math.max(0, Math.min(SKETCH_SIZE - height, y + deltaY)),
    }
    : {
      ...original,
      width: Math.max(80, Math.min(SKETCH_SIZE - x, width + deltaX)),
      height: Math.max(80, Math.min(SKETCH_SIZE - y, height + deltaY)),
    };
};

const SketchDrawing = ({ object }: { object: SketchObject }) => {
  const { type, data } = object;
  const style = {
    stroke: data.color,
    strokeWidth: data.strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  if (type === 'image') {
    return (
      <image
        href={data.url}
        x={data.x}
        y={data.y}
        width={data.width}
        height={data.height}
        preserveAspectRatio="xMidYMid meet"
        data-image-operation-id={object.operationId}
      />
    );
  }
  if (type === 'stroke') {
    const points = data.points || [];
    if (!points.length) return null;
    return <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} {...style} />;
  }

  const x = Math.min(data.x1!, data.x2!);
  const y = Math.min(data.y1!, data.y2!);
  const width = Math.abs(data.x2! - data.x1!);
  const height = Math.abs(data.y2! - data.y1!);
  if (type === 'rectangle') return <rect x={x} y={y} width={width} height={height} {...style} />;
  if (type === 'ellipse') return <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} {...style} />;
  if (type === 'arrow') {
    const angle = Math.atan2(data.y2! - data.y1!, data.x2! - data.x1!);
    const headLength = Math.max(12, data.strokeWidth! * 5);
    const headPoints = [-Math.PI / 6, Math.PI / 6].map((offset) => ({
      x: data.x2! - headLength * Math.cos(angle + offset),
      y: data.y2! - headLength * Math.sin(angle + offset),
    }));
    return (
      <g {...style}>
        <line x1={data.x1} y1={data.y1} x2={data.x2} y2={data.y2} />
        {headPoints.map((point, index) => (
          <line key={index} x1={data.x2} y1={data.y2} x2={point.x} y2={point.y} />
        ))}
      </g>
    );
  }
  return <line x1={data.x1} y1={data.y1} x2={data.x2} y2={data.y2} {...style} />;
};

export const SketchBoard: React.FC<SketchBoardProps> = ({ threadId, threadTitle, isKeyed, postsPanel }) => {
  const [objects, setObjects] = useState<SketchObject[]>([]);
  const [pending, setPending] = useState<PendingOperation[]>([]);
  const [tool, setTool] = useState<SketchTool | 'eraser' | 'select'>('stroke');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(WIDTHS[1]);
  const [threadKey, setThreadKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isImagePanelOpen, setIsImagePanelOpen] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [draft, setDraft] = useState<SketchObject | null>(null);
  const [selectedImageOperationId, setSelectedImageOperationId] = useState<string | null>(null);
  const [imageTransform, setImageTransform] = useState<{ operationId: string; data: SketchObjectData } | null>(null);
  const startPoint = useRef<SketchPoint | null>(null);
  const imageManipulation = useRef<ImageManipulation | null>(null);
  const imagePlacementReservations = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    api.fetchSketch(threadId)
      .then((savedObjects) => {
        if (active) setObjects((current) => savedObjects.reduce(mergeObject, current));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the sketch.');
      });

    return () => { active = false; };
  }, [threadId]);

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): SketchPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SKETCH_SIZE, ((event.clientX - bounds.left) / bounds.width) * SKETCH_SIZE)),
      y: Math.max(0, Math.min(SKETCH_SIZE, ((event.clientY - bounds.top) / bounds.height) * SKETCH_SIZE)),
    };
  };

  const makeDraft = (start: SketchPoint, end: SketchPoint, points?: SketchPoint[]): SketchObject => {
    const type: SketchObjectType = tool === 'stroke' || tool === 'eraser' || tool === 'select' ? 'stroke' : tool;
    const drawingColor = tool === 'eraser' ? '#ffffff' : color;
    const drawingWidth = drawingStrokeWidth(strokeWidth, tool === 'eraser');
    const data: SketchObjectData = type === 'stroke'
      ? { points: points || [start, end], color: drawingColor, strokeWidth: drawingWidth }
      : { x1: start.x, y1: start.y, x2: end.x, y2: end.y, color: drawingColor, strokeWidth: drawingWidth };
    return { id: 'preview', operationId: 'preview', type, data, createdAt: '' };
  };

  const addLocalObject = (type: SketchObjectType, data: SketchObjectData) => {
    const operationId = crypto.randomUUID();
    const operation: PendingOperation = { operationId, type, data };
    const localObject: SketchObject = {
      ...operation,
      id: `local-${operationId}`,
      createdAt: new Date().toISOString(),
    };
    setObjects((current) => mergeObject(current, localObject));
    setPending((current) => [...current, operation]);
    setError(null);
    return operationId;
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = event.target as SVGElement;
    const resizeOperationId = target.dataset.imageResizeOperationId;
    const imageOperationId = resizeOperationId || target.dataset.imageOperationId;
    if (imageOperationId && (tool === 'select' || resizeOperationId)) {
      const image = objects.find((object) => object.operationId === imageOperationId && object.type === 'image');
      if (!image) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedImageOperationId(imageOperationId);
      const start = pointFromEvent(event);
      imageManipulation.current = {
        operationId: imageOperationId,
        mode: resizeOperationId ? 'resize' : 'move',
        start,
        originalData: image.data,
      };
      return;
    }

    if (tool === 'select') {
      setSelectedImageOperationId(null);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    startPoint.current = point;
    setDraft(makeDraft(point, point));
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const manipulation = imageManipulation.current;
    if (manipulation) {
      const data = transformImageData(manipulation, pointFromEvent(event));
      setImageTransform({ operationId: manipulation.operationId, data });
      return;
    }
    if (!startPoint.current) return;
    const end = pointFromEvent(event);
    const points = tool === 'stroke' || tool === 'eraser'
      ? [...(draft?.data.points || []), end]
      : undefined;
    setDraft(makeDraft(startPoint.current, end, points));
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const manipulation = imageManipulation.current;
    if (manipulation) {
      const data = transformImageData(manipulation, pointFromEvent(event));
      const current = objects.find((object) => object.operationId === manipulation.operationId);
      if (current && (data.x !== current.data.x || data.y !== current.data.y || data.width !== current.data.width || data.height !== current.data.height)) {
        const queuedOperation = pending.find((operation) => operation.operationId === manipulation.operationId);
        if (queuedOperation) {
          setPending((operations) => operations.map((operation) =>
            operation.operationId === manipulation.operationId ? { ...operation, data } : operation,
          ));
          setObjects((items) => items.map((object) =>
            object.operationId === manipulation.operationId ? { ...object, data } : object,
          ));
        } else {
          addLocalObject('image', { ...data, supersedesOperationId: manipulation.operationId });
          setSelectedImageOperationId(null);
        }
      }
      imageManipulation.current = null;
      setImageTransform(null);
      return;
    }
    if (!startPoint.current) return;
    const start = startPoint.current;
    const end = pointFromEvent(event);
    const points = tool === 'stroke' || tool === 'eraser'
      ? [...(draft?.data.points || []), end]
      : undefined;
    const completed = makeDraft(start, end, points);
    startPoint.current = null;
    setDraft(null);
    addLocalObject(completed.type, completed.data);
  };

  const addImage = useCallback(async (file: File) => {
    if (isKeyed && !threadKey.trim()) {
      setError('Enter the thred key before adding an image to this sketch.');
      return;
    }

    const position = nextImagePosition(objects, imagePlacementReservations.current);
    imagePlacementReservations.current += 1;
    setError(null);
    setIsUploadingImage(true);
    try {
      const url = await api.uploadMedia(file, threadId, isKeyed ? threadKey : undefined);
      const operationId = addLocalObject('image', { url, ...position });
      setSelectedImageOperationId(operationId);
      setTool('select');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the image.');
    } finally {
      imagePlacementReservations.current -= 1;
      setIsUploadingImage(false);
    }
  }, [isKeyed, threadId, threadKey, objects]);

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /INPUT|TEXTAREA/.test(target.tagName))) return;
    const files = event.clipboardData ? clipboardImageFiles(event.clipboardData.items) : [];
    if (!files.length) return;
    event.preventDefault();
    void addImage(files[0]);
  }, [addImage]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleSync = async () => {
    if (!pending.length || isSyncing) return;
    if (isKeyed && !threadKey.trim()) {
      setError('Enter the thred key before syncing sketch changes.');
      return;
    }

    const batch = pending;
    const syncedIds: string[] = [];
    setIsSyncing(true);
    setError(null);
    try {
      for (const operation of batch) {
        const saved = await api.createSketchObject(threadId, operation, isKeyed ? threadKey : undefined);
        setObjects((current) => mergeObject(current, saved));
        syncedIds.push(operation.operationId);
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Could not sync sketch changes.');
    } finally {
      setPending((current) => current.filter((operation) => !syncedIds.includes(operation.operationId)));
      setIsSyncing(false);
    }
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void addImage(file);
  };

  const canvasObjects = visibleSketchObjects(objects).map((object) =>
    imageTransform?.operationId === object.operationId
      ? { ...object, data: imageTransform.data }
      : object,
  );
  const selectedImage = canvasObjects.find((object) => object.operationId === selectedImageOperationId && object.type === 'image');

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-stone-300 bg-[#f3f0e8] shadow-xl dark:border-stone-700 dark:bg-stone-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-300 bg-white px-5 py-4 dark:border-stone-700 dark:bg-stone-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
            <i className="fas fa-palette" aria-hidden="true" />
            Sketch studio
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-bold text-stone-900 dark:text-white">{threadTitle}</h2>
            <ProtectionBadge status={isKeyed ? 'code_protected' : 'public'} compact />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-500 dark:text-stone-400" role="status">
            {pending.length ? `${pending.length} unsynced ${pending.length === 1 ? 'change' : 'changes'}` : 'All changes synced'}
          </span>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!pending.length || isSyncing}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className={`fas ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-cloud-arrow-up'} mr-2`} aria-hidden="true" />
            {isSyncing ? 'Syncing…' : 'Sync changes'}
          </button>
        </div>
      </header>

      {isKeyed && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900 dark:bg-amber-950/30">
          <i className="fas fa-key text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <label htmlFor={`sketch-key-${threadId}`} className="text-sm font-medium text-stone-700 dark:text-stone-200">Thred key</label>
          <input
            id={`sketch-key-${threadId}`}
            type="password"
            autoComplete="new-password"
            value={threadKey}
            onChange={(event) => setThreadKey(event.target.value)}
            className="max-w-xs rounded border border-amber-300 bg-white px-3 py-1 text-sm text-stone-900 dark:border-amber-800 dark:bg-stone-800 dark:text-white"
          />
          <span className="text-xs text-stone-500 dark:text-stone-400">Needed to add images and sync edits.</span>
        </div>
      )}

      {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      <div className="flex min-h-[620px] flex-col sm:flex-row">
        <div className="flex shrink-0 flex-row items-center gap-2 border-b border-stone-300 bg-stone-100 p-2 sm:w-[72px] sm:flex-col sm:border-b-0 sm:border-r dark:border-stone-700 dark:bg-stone-800">
          <button
            type="button"
            onClick={() => setIsImagePanelOpen((open) => !open)}
            aria-expanded={isImagePanelOpen}
            aria-label={isImagePanelOpen ? 'Collapse Chat panel' : 'Expand Chat panel'}
            title="Chat"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition ${isImagePanelOpen ? 'border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'border-transparent text-stone-600 hover:bg-white dark:text-stone-300 dark:hover:bg-stone-700'}`}
          >
            <i className={`fas ${isImagePanelOpen ? 'fa-images' : 'fa-image'}`} aria-hidden="true" />
          </button>
          <span className="mr-auto text-xs font-semibold text-stone-500 sm:mr-0 sm:mt-1 sm:text-center">Chat</span>
          <span className="hidden h-px w-9 bg-stone-300 sm:block dark:bg-stone-600" />
          {TOOLS.map((drawingTool) => (
            <button
              type="button"
              key={drawingTool.name}
              aria-label={drawingTool.label}
              aria-pressed={tool === drawingTool.name}
              title={drawingTool.label}
              onClick={() => setTool(drawingTool.name)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-base transition ${tool === drawingTool.name ? 'bg-violet-600 text-white shadow' : 'text-stone-600 hover:bg-white dark:text-stone-300 dark:hover:bg-stone-700'}`}
            >
              <i className={`fas ${drawingTool.icon}`} aria-hidden="true" />
            </button>
          ))}
          <span className="hidden h-px w-9 bg-stone-300 sm:block dark:bg-stone-600" />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploadingImage}
            aria-label="Add image to canvas"
            title="Add image"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-base text-stone-600 transition hover:bg-white disabled:opacity-50 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <i className={`fas ${isUploadingImage ? 'fa-circle-notch fa-spin' : 'fa-file-image'}`} aria-hidden="true" />
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelection} />
        </div>

        {isImagePanelOpen && (
          <aside className="max-h-[320px] w-full shrink-0 overflow-y-auto border-b border-stone-300 bg-white p-3 sm:max-h-none sm:w-[280px] sm:border-b-0 sm:border-r dark:border-stone-700 dark:bg-stone-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-stone-800 dark:text-stone-100">Chat</h3>
              <button
                type="button"
                onClick={() => setIsImagePanelOpen(false)}
                aria-label="Close image board panel"
                className="rounded p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
            {postsPanel}
          </aside>
        )}

        <main className="min-w-0 flex-1 p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Color</span>
              {COLORS.map((paletteColor) => (
                <button
                  type="button"
                  key={paletteColor}
                  aria-label={`Color ${paletteColor}`}
                  aria-pressed={color === paletteColor}
                  onClick={() => { setColor(paletteColor); setTool('stroke'); }}
                  className={`h-7 w-7 rounded-full border-2 ${color === paletteColor ? 'border-violet-600 ring-2 ring-violet-200' : 'border-stone-300 dark:border-stone-500'}`}
                  style={{ backgroundColor: paletteColor }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1" title="Custom color">
                <span className="sr-only">Custom color</span>
                <input type="color" value={color} onChange={(event) => { setColor(event.target.value); setTool('stroke'); }} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
              Size
              <select value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-800 dark:border-stone-600 dark:bg-stone-700 dark:text-white">
                {WIDTHS.map((width) => <option key={width} value={width}>{width}px</option>)}
              </select>
            </label>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCanvasZoom((zoom) => Math.max(0.5, zoom - 0.25))}
                disabled={canvasZoom <= 0.5}
                aria-label="Zoom out"
                title="Zoom out"
                className="h-8 w-8 rounded border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                <i className="fas fa-minus" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setCanvasZoom(1)}
                aria-label="Reset canvas zoom"
                title="Reset zoom"
                className="min-w-[52px] rounded px-1 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                {Math.round(canvasZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setCanvasZoom((zoom) => Math.min(2, zoom + 0.25))}
                disabled={canvasZoom >= 2}
                aria-label="Zoom in"
                title="Zoom in"
                className="h-8 w-8 rounded border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                <i className="fas fa-plus" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-lg border border-stone-300 bg-[#e6e2d9] p-3 dark:border-stone-700 sm:p-5">
            <svg
              viewBox={`0 0 ${SKETCH_SIZE} ${SKETCH_SIZE}`}
              role="img"
              aria-label="Paint canvas. Use the toolbar to draw."
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`mx-auto block touch-none bg-white shadow-lg ${tool === 'eraser' ? 'cursor-cell' : tool === 'select' ? 'cursor-move' : 'cursor-crosshair'}`}
              style={{
                width: `${canvasZoom * 100}%`,
                minWidth: `${canvasZoom * 100}%`,
                maxWidth: `${canvasZoom * 1000}px`,
                aspectRatio: '1 / 1',
              }}
            >
              {canvasObjects.map((object) => <SketchDrawing key={object.operationId} object={object} />)}
              {selectedImage && (
                <g>
                  <rect
                    x={selectedImage.data.x}
                    y={selectedImage.data.y}
                    width={selectedImage.data.width}
                    height={selectedImage.data.height}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth={8}
                    strokeDasharray="20 12"
                    pointerEvents="none"
                  />
                  <circle
                    cx={Number(selectedImage.data.x) + Number(selectedImage.data.width)}
                    cy={Number(selectedImage.data.y) + Number(selectedImage.data.height)}
                    r={26}
                    fill="#7c3aed"
                    stroke="white"
                    strokeWidth={8}
                    data-image-resize-operation-id={selectedImage.operationId}
                    className="cursor-nwse-resize"
                  />
                </g>
              )}
              {draft && <SketchDrawing object={draft} />}
            </svg>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
            <span>
              {tool === 'select'
                ? 'Select an image to move it; drag its corner handle to resize.'
                : `4000 × 4000 px · Ctrl+V to paste an image · ${canvasZoom > 1 ? 'Scroll to pan' : 'Zoom to inspect'}`}
            </span>
            <span>{tool === 'eraser' ? 'Eraser' : tool === 'stroke' ? 'Pencil' : tool === 'select' ? 'Select' : tool[0].toUpperCase() + tool.slice(1)}</span>
          </div>
        </main>
      </div>
    </section>
  );
};
