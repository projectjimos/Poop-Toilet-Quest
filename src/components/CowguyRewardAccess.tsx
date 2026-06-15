import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { eraseCookie, setCookie } from '../utils/cookies';

interface CowguyRewardAccessProps {
  children: ReactNode;
}

const REWARD_COOKIE = 'cowguy_subscribed_token';
const REWARD_SOURCE = 'cowguy_verified_subscription_source';
const GOOGLE_SOURCE = 'google-youtube-oauth';

const rawRewardCookieExists = () => document.cookie.includes(`${REWARD_COOKIE}=`);

const approveCowguyReward = () => {
  localStorage.setItem(REWARD_SOURCE, GOOGLE_SOURCE);
  setCookie(REWARD_SOURCE, GOOGLE_SOURCE, 30);
};

const clearCowguyRewardFlag = () => {
  localStorage.removeItem(REWARD_SOURCE);
  eraseCookie(REWARD_SOURCE);
  eraseCookie(REWARD_COOKIE);
};

export default function CowguyRewardAccess({ children }: CowguyRewardAccessProps) {
  useEffect(() => {
    const win = window as typeof window & {
      __cowguyRewardFetchReady?: boolean;
      __cowguyRewardFetch?: typeof window.fetch;
    };

    if (!win.__cowguyRewardFetchReady) {
      win.__cowguyRewardFetchReady = true;
      win.__cowguyRewardFetch = window.fetch.bind(window);

      window.fetch = async (...args) => {
        const response = await win.__cowguyRewardFetch!(...args);
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

        if (url.includes('/api/auth/verify')) {
          response.clone().json().then((payload) => {
            if (payload?.success === true && payload?.subscribed === true) {
              approveCowguyReward();
            } else if (payload && payload.subscribed === false) {
              clearCowguyRewardFlag();
            }
          }).catch(() => undefined);
        }

        return response;
      };
    }

    const interval = window.setInterval(() => {
      const source = localStorage.getItem(REWARD_SOURCE);
      if (rawRewardCookieExists() && source !== GOOGLE_SOURCE) {
        eraseCookie(REWARD_COOKIE);
      }
    }, 750);

    return () => window.clearInterval(interval);
  }, []);

  return <>{children}</>;
}
