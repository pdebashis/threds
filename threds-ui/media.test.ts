import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMediaFileError,
  getMediaThumbnailUrl,
  getOptimizedMediaUrl,
  isCloudinaryMediaUrl,
  isVideoUrl,
  MAX_MEDIA_FILE_SIZE_BYTES,
} from './media.ts';

test('allows images, WebM, and MP4 files smaller than 25 MB', () => {
  assert.equal(getMediaFileError({ type: 'image/gif', size: MAX_MEDIA_FILE_SIZE_BYTES - 1 }), null);
  assert.equal(getMediaFileError({ type: 'video/webm', size: 1024 }), null);
  assert.equal(getMediaFileError({ type: 'video/mp4', size: 1024 }), null);
});

test('rejects unsupported video formats and files at least 25 MB', () => {
  assert.equal(getMediaFileError({ type: 'video/quicktime', size: 1024 }), 'Choose an image, WebM video, or MP4 video.');
  assert.equal(
    getMediaFileError({ type: 'video/webm', size: MAX_MEDIA_FILE_SIZE_BYTES }),
    'Choose a file smaller than 25 MB.',
  );
});

test('recognizes WebM and MP4 URLs with query strings and fragments', () => {
  assert.equal(isVideoUrl('https://example.com/clip.webm'), true);
  assert.equal(isVideoUrl('https://example.com/clip.MP4?token=abc'), true);
  assert.equal(isVideoUrl('https://example.com/image.gif'), false);
});

test('builds optimized Cloudinary image and video thumbnail URLs without replacing originals', () => {
  const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v123/threds/picture.gif';
  const videoUrl = 'https://res.cloudinary.com/demo/video/upload/v123/threds/clip.webm?token=abc';

  assert.equal(
    getMediaThumbnailUrl(imageUrl),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_320,h_240,c_fill,g_auto/v123/threds/picture.gif',
  );
  assert.equal(
    getMediaThumbnailUrl(videoUrl),
    'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto,w_320,h_240,c_fill,g_auto/v123/threds/clip.jpg?token=abc',
  );
  assert.equal(
    getOptimizedMediaUrl(videoUrl),
    'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto,vc_auto,w_1600,c_limit/v123/threds/clip.webm?token=abc',
  );
  assert.equal(isCloudinaryMediaUrl(imageUrl), true);
  assert.equal(isCloudinaryMediaUrl('https://example.com/image.gif'), false);
});
