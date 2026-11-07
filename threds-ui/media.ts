export const MAX_MEDIA_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const getMediaFileError = (file: Pick<File, 'type' | 'size'>): string | null => {
  const contentType = file.type.toLowerCase();
  if (!contentType.startsWith('image/') && contentType !== 'video/webm' && contentType !== 'video/mp4') {
    return 'Choose an image, WebM video, or MP4 video.';
  }
  if (file.size >= MAX_MEDIA_FILE_SIZE_BYTES) {
    return 'Choose a file smaller than 25 MB.';
  }
  return null;
};

export const isVideoUrl = (url: string): boolean => /\.(?:webm|mp4)(?:$|[?#])/i.test(url);

export const isCloudinaryMediaUrl = (url: string): boolean =>
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload\//i.test(url);

const withCloudinaryTransformation = (
  url: string,
  transformation: string,
  outputExtension?: string,
): string => {
  if (!isCloudinaryMediaUrl(url)) return url;

  const transformed = url.replace(
    /\/(image|video)\/upload\//i,
    `/$1/upload/${transformation}/`,
  );
  return outputExtension
    ? transformed.replace(/\.(?:webm|mp4)(?=$|[?#])/i, `.${outputExtension}`)
    : transformed;
};

export const getMediaThumbnailUrl = (url: string): string =>
  withCloudinaryTransformation(
    url,
    isVideoUrl(url)
      ? 'so_0,f_jpg,q_auto,w_320,h_240,c_fill,g_auto'
      : 'f_auto,q_auto,w_320,h_240,c_fill,g_auto',
    isVideoUrl(url) ? 'jpg' : undefined,
  );

export const getOptimizedMediaUrl = (url: string, width = 1600): string => {
  const transformation = isVideoUrl(url)
    ? `f_auto,q_auto,vc_auto,w_${width},c_limit`
    : `f_auto,q_auto,w_${width},c_limit`;
  return withCloudinaryTransformation(url, transformation);
};
