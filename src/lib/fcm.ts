import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, handleFirestoreError, OperationType } from './firebase';
import defaultConfig from '../../firebase-applet-config.json';
import { toast } from 'sonner';

let messagingInstance: Messaging | null = null;
let messagingSupportedPromise: Promise<boolean> | null = null;

const env = (import.meta as any).env || {};
const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY || (defaultConfig as any).vapidKey;

/**
 * Safely initialize FCM Messaging instance if supported by the browser environment
 */
export async function getFcmMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (!messagingSupportedPromise) {
    messagingSupportedPromise = isSupported().catch((err) => {
      console.warn('FCM Messaging support check failed:', err);
      return false;
    });
  }

  const supported = await messagingSupportedPromise;
  if (supported) {
    try {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    } catch (err) {
      console.warn('Failed to initialize FCM messaging:', err);
      return null;
    }
  }
  return null;
}

/**
 * Request notification permission from browser and register FCM token
 */
export async function requestFcmNotificationPermission(userId?: string, userRole?: string): Promise<{ granted: boolean; token?: string }> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.');
    return { granted: false };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied by user.');
      return { granted: false };
    }

    // Register Service Worker for push background handling if available
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.ready;
      } catch (e) {
        console.warn('Service worker not ready for FCM token:', e);
      }
    }

    const messaging = await getFcmMessaging();
    let token: string | undefined;

    if (messaging) {
      try {
        token = await getToken(messaging, {
          vapidKey: VAPID_KEY || (defaultConfig as any).vapidKey || undefined,
          serviceWorkerRegistration
        });

        if (token && userId) {
          console.log('FCM Registration Token acquired:', token);
          // Store token in Firestore for targeted push messaging
          await setDoc(doc(db, 'fcm_tokens', token), {
            userId,
            userRole: userRole || 'observer',
            token,
            updatedAt: serverTimestamp(),
            platform: 'web_pwa'
          }, { merge: true });

          // Also attach token to user profile
          await setDoc(doc(db, 'users', userId), {
            fcmToken: token,
            notificationsEnabled: true,
            lastTokenUpdate: serverTimestamp()
          }, { merge: true });
        }
      } catch (tokenErr) {
        console.warn('Could not retrieve FCM token (using local Push Notification fallback):', tokenErr);
      }
    }

    return { granted: true, token };
  } catch (err) {
    console.error('Error requesting FCM notification permission:', err);
    return { granted: false };
  }
}

/**
 * Trigger an OS / Browser System Notification directly (works when app is in background or foreground)
 */
export async function triggerSystemPushNotification(options: {
  title: string;
  body: string;
  icon?: string;
  link?: string;
  tag?: string;
  isSosAlert?: boolean;
}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const title = options.title || '🚨 EMERGENCY DANGER SOS';
  const body = options.body;
  const icon = options.icon || '/pwa-icon.svg';
  const tag = options.tag || 'danger-sos-alert';
  const link = options.link || '/incidents';

  // Play browser emergency audio alarm
  if (options.isSosAlert) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      // Audio context policy
    }
  }

  // Use ServiceWorkerRegistration showNotification if available (ensures OS level system push banner)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body,
          icon,
          badge: '/pwa-icon.svg',
          tag,
          renotify: true,
          requireInteraction: true,
          vibrate: [500, 150, 500, 150, 500],
          data: { url: link },
          actions: [
            { action: 'open_sos', title: '🚨 Open Emergency SOS' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        } as any);
        return;
      }
    } catch (swErr) {
      console.warn('Service worker showNotification fallback to window.Notification:', swErr);
    }
  }

  // Fallback to standard window.Notification
  try {
    const notif = new Notification(title, {
      body,
      icon,
      tag,
      requireInteraction: true,
      data: { url: link }
    });

    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (link) {
        window.location.href = link;
      }
      notif.close();
    };
  } catch (nErr) {
    console.warn('System Notification error:', nErr);
  }
}

/**
 * Listen for foreground FCM messages
 */
export async function registerFcmForegroundHandler(onMessageReceived: (payload: any) => void) {
  const messaging = await getFcmMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    onMessageReceived(payload);

    // Trigger system push notification if tab is in background or hidden
    if (document.hidden) {
      triggerSystemPushNotification({
        title: payload.notification?.title || payload.data?.title || '🚨 EMERGENCY DANGER SOS',
        body: payload.notification?.body || payload.data?.body || 'New high priority incident reported.',
        link: payload.data?.link || '/incidents',
        isSosAlert: true
      });
    }
  });
}
