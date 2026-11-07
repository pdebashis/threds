export const SKETCH_SIZE = 4000;

export type SketchObjectType = 'stroke' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'image';
export type SketchPoint = { x: number; y: number };
export type SketchObjectData = Record<string, unknown> & {
  points?: SketchPoint[];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  url?: string;
};

export interface SketchObject {
  id: string;
  operationId: string;
  type: SketchObjectType;
  data: SketchObjectData;
  createdAt: string;
}

export type SketchTool = Exclude<SketchObjectType, 'image'>;

export const clipboardImageFiles = (
  items: ArrayLike<Pick<DataTransferItem, 'type' | 'getAsFile'>>,
): File[] =>
  Array.from(items)
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);

export const drawSketchObjects = (
  context: CanvasRenderingContext2D,
  objects: SketchObject[],
  images: Map<string, HTMLImageElement>,
) => {
  for (const object of objects) {
    const { data } = object;
    if (object.type === 'image' && data.url) {
      const image = images.get(data.url);
      if (image) {
        const scale = Math.min(data.width! / image.naturalWidth, data.height! / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(
          image,
          data.x! + (data.width! - width) / 2,
          data.y! + (data.height! - height) / 2,
          width,
          height,
        );
      }
      continue;
    }

    context.strokeStyle = data.color!;
    context.fillStyle = data.color!;
    context.lineWidth = data.strokeWidth!;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();

    if (object.type === 'stroke') {
      const points = data.points!;
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    } else if (object.type === 'rectangle') {
      context.strokeRect(
        Math.min(data.x1!, data.x2!),
        Math.min(data.y1!, data.y2!),
        Math.abs(data.x2! - data.x1!),
        Math.abs(data.y2! - data.y1!),
      );
      continue;
    } else if (object.type === 'ellipse') {
      context.ellipse(
        (data.x1! + data.x2!) / 2,
        (data.y1! + data.y2!) / 2,
        Math.abs(data.x2! - data.x1!) / 2,
        Math.abs(data.y2! - data.y1!) / 2,
        0,
        0,
        Math.PI * 2,
      );
    } else {
      context.moveTo(data.x1!, data.y1!);
      context.lineTo(data.x2!, data.y2!);
      if (object.type === 'arrow') {
        const angle = Math.atan2(data.y2! - data.y1!, data.x2! - data.x1!);
        const headLength = Math.max(12, data.strokeWidth! * 5);
        context.moveTo(data.x2!, data.y2!);
        context.lineTo(
          data.x2! - headLength * Math.cos(angle - Math.PI / 6),
          data.y2! - headLength * Math.sin(angle - Math.PI / 6),
        );
        context.moveTo(data.x2!, data.y2!);
        context.lineTo(
          data.x2! - headLength * Math.cos(angle + Math.PI / 6),
          data.y2! - headLength * Math.sin(angle + Math.PI / 6),
        );
      }
    }

    context.stroke();
  }
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('An image could not be loaded for PNG export.'));
    image.src = url;
  });

export const exportSketchPng = async (objects: SketchObject[]): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = SKETCH_SIZE;
  canvas.height = SKETCH_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG export is not supported by this browser.');

  const imageUrls = [...new Set(objects
    .filter((object) => object.type === 'image' && object.data.url)
    .map((object) => object.data.url!))];
  const loadedImages = await Promise.all(imageUrls.map(async (url) => [url, await loadImage(url)] as const));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, SKETCH_SIZE, SKETCH_SIZE);
  drawSketchObjects(context, objects, new Map(loadedImages));

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not create a PNG export.'));
    }, 'image/png');
  });
};
