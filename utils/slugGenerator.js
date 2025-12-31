import { customAlphabet } from 'nanoid';

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const nanoid = customAlphabet(alphabet, 8);

export function generateSlug() {
  const length = Math.floor(Math.random() * 4) + 5;
  return nanoid().substring(0, length);
}

export function validateSlug(slug) {
  const regex = /^[a-zA-Z0-9_-]+$/;
  return regex.test(slug) && slug.length >= 2 && slug.length <= 30;
}

export function validateUrl(url) {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}
