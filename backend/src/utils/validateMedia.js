const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'video/mp4',
];

const MAX_MEDIA_SIZE =
  2 * 1024 * 1024;

const MAX_MEDIA_COUNT = 3;

function validateMedia(media = []) {
  if (!Array.isArray(media)) {
    return {
      valid: false,
      message:
        'Media must be an array.',
    };
  }

  if (
    media.length >
    MAX_MEDIA_COUNT
  ) {
    return {
      valid: false,
      message:
        `A maximum of ${MAX_MEDIA_COUNT} attachments is allowed.`,
    };
  }

  for (
    const item of media
  ) {
    if (
      !ALLOWED_MEDIA_TYPES.includes(
        item.mimeType
      )
    ) {
      return {
        valid: false,
        message:
          'Only JPG, PNG and MP4 files are supported.',
      };
    }

    if (
      Number(item.size) >
      MAX_MEDIA_SIZE
    ) {
      return {
        valid: false,
        message:
          'Each media file must be 2 MB or smaller.',
      };
    }
  }

  return {
    valid: true,
  };
}

module.exports = {
  validateMedia,
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_SIZE,
  MAX_MEDIA_COUNT,
};