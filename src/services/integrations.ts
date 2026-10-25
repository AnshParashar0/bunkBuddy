// Integration layer: swap implementations without touching screens.

/** OCR of the ID card. OCR output is a hint for the admin reviewer, never the source of truth. */
export interface OcrResult { name?: string; college?: string; course?: string; department?: string; year?: string; studentId?: string; validTill?: string }
export interface OcrProvider { extract(front: File): Promise<OcrResult> }
// Default: no OCR, admin reviews the photo. Plug in tesseract.js, Google Vision, or an Edge Function here.
export const ocrProvider: OcrProvider = { extract: async () => ({}) };

/** College verification API (ERP / student database). Used only where a college offers one. */
export interface CollegeVerifier { verify(collegeId: string, studentId: string): Promise<boolean> }
export const collegeVerifier: CollegeVerifier = { verify: async () => false };

/** Notifications. In-app realtime is always on; this adds OS-level alerts while the tab is open. */
export interface Notifier { requestPermission(): Promise<void>; notify(title: string, body: string): void }
export const notifier: Notifier = {
  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  },
  notify(title, body) {
    if ('vibrate' in navigator) navigator.vibrate?.(120);
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
      new Notification(title, { body, tag: 'bunk-request' });
    }
  },
};
// Phase 2: real Web Push (service worker + Supabase Edge Function triggered by a DB webhook on request_inbox inserts).
