import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { SketchCable } from '../services/sketchCable';
import {
  clipboardImageFiles,
  exportSketchPng,
  SKETCH_SIZE,
  type SketchObject,
  type SketchObjectData,
  type SketchObjectType,
  type SketchPoint,
  type SketchTool,
} from '../sketch';

const COLORS = ['#111827', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#9333ea'];
const WIDTHS = [4, 10, 20];

interface SketchBoardProps {
  threadId: string;
  isKeyed: boolean;
}

const mergeObject = (objects: SketchObject[], operation: SketchObject): SketchObject[] => {
  if (objects.some((object) => object.operationId === operation.operationId)) return objects;
  return [...objects, operation].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
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
    return <image href={data.url} x={data.x} y={data.y} width={data.width} height={data.height} preserveAspectRatio="xMidYMid meet" />;
  }
  if (type === 'stroke') {
    const points = data.points || [];
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
  return (
    <line
      x1={data.x1}
      y1={data.y1}
      x2={data.x2}
      y2={data.y2}
      {...style}
    />
  );
};

export const SketchBoard: React.FC<SketchBoardProps> = ({ threadId, isKeyed }) => {
  const [objects, setObjects] = useState<SketchObject[]>([]);
  const [tool, setTool] = useState<SketchTool>('stroke');
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(WIDTHS[0]);
  const [threadKey, setThreadKey] = useState('');
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [draft, setDraft] = useState<SketchObject | null>(null);
  const startPoint = useRef<SketchPoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const loadObjects = useCallback(async () => {
    const savedObjects = await api.fetchSketch(threadId);
    setObjects((current) => savedObjects.reduce(mergeObject, current));
  }, [threadId]);

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

  useEffect(() => {
    const cable = new SketchCable(
      threadId,
      (operation) => setObjects((current) => mergeObject(current, operation)),
      setConnection,
      () => loadObjects().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Could not reload the sketch.');
      }),
    );
    return cable.start();
  }, [threadId, loadObjects]);

  const saveObject = useCallback(async (type: SketchObjectType, data: SketchObjectData) => {
    if (isKeyed && !threadKey.trim()) {
      setError('Enter the thred key before changing this sketch.');
      return;
    }

    const operation = { operationId: crypto.randomUUID(), type, data };
    setIsSaving(true);
    setError(null);
    try {
      const saved = await api.createSketchObject(threadId, operation, isKeyed ? threadKey : undefined);
      setObjects((current) => mergeObject(current, saved));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this sketch change.');
    } finally {
      setIsSaving(false);
    }
  }, [isKeyed, threadId, threadKey]);

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>): SketchPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SKETCH_SIZE, ((event.clientX - bounds.left) / bounds.width) * SKETCH_SIZE)),
      y: Math.max(0, Math.min(SKETCH_SIZE, ((event.clientY - bounds.top) / bounds.height) * SKETCH_SIZE)),
    };
  };

  const makeDraft = (start: SketchPoint, end: SketchPoint, points?: SketchPoint[]): SketchObject => {
    const type: SketchObjectType = tool === 'stroke' ? 'stroke' : tool;
    const data: SketchObjectData = type === 'stroke'
      ? { points: points || [start, end], color, strokeWidth }
      : { x1: start.x, y1: start.y, x2: end.x, y2: end.y, color, strokeWidth };
    return { id: 'preview', operationId: 'preview', type, data, createdAt: '' };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isKeyed && !threadKey.trim()) {
      setError('Enter the thred key before changing this sketch.');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    startPoint.current = point;
    setDraft(makeDraft(point, point));
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!startPoint.current) return;
    const end = pointFromEvent(event);
    const points = tool === 'stroke'
      ? [...(draft?.data.points || []), end]
      : undefined;
    setDraft(makeDraft(startPoint.current, end, points));
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!startPoint.current) return;
    const start = startPoint.current;
    const end = pointFromEvent(event);
    const points = tool === 'stroke'
      ? [...(draft?.data.points || []), end]
      : undefined;
    const completed = makeDraft(start, end, points);
    startPoint.current = null;
    setDraft(null);
    void saveObject(completed.type, completed.data);
  };

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /INPUT|TEXTAREA/.test(target.tagName))) return;
    const files = event.clipboardData ? clipboardImageFiles(event.clipboardData.items) : [];
    if (!files.length) return;
    event.preventDefault();

    if (isKeyed && !threadKey.trim()) {
      setError('Enter the thred key before adding an image to this sketch.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const url = await api.uploadMedia(files[0], threadId, isKeyed ? threadKey : undefined);
      await saveObject('image', { url, x: 200, y: 200, width: 800, height: 600 });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the clipboard image.');
    } finally {
      setIsSaving(false);
    }
  }, [isKeyed, threadId, threadKey, saveObject]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const png = await exportSketchPng(objects);
      const url = URL.createObjectURL(png);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sketch-${threadId}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export the sketch.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-700">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white">Shared sketch</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">4000 × 4000 · Ctrl+V to paste an image</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={connection === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            {connection === 'connected' ? 'Live updates connected' : connection === 'connecting' ? 'Connecting…' : 'Live updates disconnected; reconnecting'}
          </span>
          <button type="button" onClick={handleExport} disabled={isExporting} className="rounded border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            {isExporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700" aria-label="Sketch tools">
        {(['stroke', 'rectangle', 'ellipse', 'line', 'arrow'] as SketchTool[]).map((drawingTool) => (
          <button
            type="button"
            key={drawingTool}
            aria-pressed={tool === drawingTool}
            onClick={() => setTool(drawingTool)}
            className={`rounded px-2.5 py-1.5 text-sm capitalize ${tool === drawingTool ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
          >
            {drawingTool === 'stroke' ? 'Pencil' : drawingTool}
          </button>
        ))}
        <span className="mx-1 h-6 border-l border-gray-300 dark:border-gray-600" />
        {COLORS.map((paletteColor) => (
          <button
            type="button"
            key={paletteColor}
            aria-label={`Color ${paletteColor}`}
            aria-pressed={color === paletteColor}
            onClick={() => setColor(paletteColor)}
            className={`h-6 w-6 rounded-full border-2 ${color === paletteColor ? 'border-blue-500' : 'border-gray-300 dark:border-gray-500'}`}
            style={{ backgroundColor: paletteColor }}
          />
        ))}
        <label className="ml-1 text-xs text-gray-500 dark:text-gray-400">
          Width
          <select value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} className="ml-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            {WIDTHS.map((width) => <option key={width} value={width}>{width}</option>)}
          </select>
        </label>
        {isSaving && <span className="ml-auto text-xs text-gray-500">Saving…</span>}
      </div>

      {isKeyed && (
        <div className="border-b border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <label htmlFor={`sketch-key-${threadId}`} className="mr-2 text-sm font-medium text-gray-800 dark:text-gray-200">Thred key to edit</label>
          <input
            id={`sketch-key-${threadId}`}
            type="password"
            autoComplete="new-password"
            value={threadKey}
            onChange={(event) => setThreadKey(event.target.value)}
            className="max-w-xs rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      )}

      {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

      <div className="max-h-[75vh] overflow-auto bg-gray-100 p-3 dark:bg-gray-950">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SKETCH_SIZE} ${SKETCH_SIZE}`}
          role="img"
          aria-label="Shared 4000 by 4000 sketch canvas"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="mx-auto block w-full max-w-[900px] touch-none cursor-crosshair bg-white shadow dark:bg-white"
          style={{ aspectRatio: '1 / 1' }}
        >
          {objects.map((object) => <SketchDrawing key={object.operationId} object={object} />)}
          {draft && <SketchDrawing object={draft} />}
        </svg>
      </div>
    </section>
  );
};
