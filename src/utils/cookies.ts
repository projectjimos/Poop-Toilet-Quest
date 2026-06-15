const REWARD_NAME = 'cowguy_subscribed_token';
const SOURCE_NAME = 'cowguy_verified_subscription_source';
const SOURCE_VALUE = 'google-youtube-oauth';
const ACTIVE_VALUE = ['COW55', 'LEGENDARY', 'ACTIVE'].join('_');

function readRaw(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export function setCookie(name: string, value: string, days = 30): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=None; Secure`;
}

export function getCookie(name: string): string | null {
  const value = readRaw(name);
  if (name === REWARD_NAME && value === ACTIVE_VALUE) {
    const sourceCookie = readRaw(SOURCE_NAME);
    const sourceLocal = localStorage.getItem(SOURCE_NAME);
    return sourceCookie === SOURCE_VALUE || sourceLocal === SOURCE_VALUE ? value : null;
  }
  return value;
}

export function eraseCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=None; Secure`;
}
