export const validateShortenRequest = (body) => {
  const errors = [];
  
  if (!body.originalUrl) {
    errors.push('originalUrl is required');
  } else if (!isValidUrl(body.originalUrl)) {
    errors.push('originalUrl must be a valid URL');
  }
  
  if (body.customSlug && !isValidSlug(body.customSlug)) {
    errors.push('customSlug must be 2-30 characters and contain only letters, numbers, hyphens, and underscores');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const isValidUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

export const isValidSlug = (slug) => {
  const regex = /^[a-zA-Z0-9_-]+$/;
  return regex.test(slug) && slug.length >= 2 && slug.length <= 30;
};
