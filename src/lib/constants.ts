import type { Availability } from './types';

export const ACTIVITIES = [
  { key: 'bunk_partner', label: 'Bunk partner', icon: '🎒' },
  { key: 'chai_coffee', label: 'Chai / Coffee', icon: '☕' },
  { key: 'food', label: 'Food', icon: '🍜' },
  { key: 'games', label: 'Games', icon: '🎮' },
  { key: 'sports', label: 'Sports', icon: '⚽' },
  { key: 'walk', label: 'Walk', icon: '🚶' },
  { key: 'just_hangout', label: 'Just hangout', icon: '😎' },
  { key: 'meet_new_people', label: 'Meet new people', icon: '👋' },
] as const;

export const activityLabel = (key: string) => ACTIVITIES.find(a => a.key === key)?.label ?? key;
export const activityIcon = (key: string) => ACTIVITIES.find(a => a.key === key)?.icon ?? '✨';

export const DURATIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
];

export const AVAILABILITY: { key: Availability; label: string; hint: string }[] = [
  { key: 'available', label: 'Available', hint: "I'm free" },
  { key: 'maybe', label: 'Maybe', hint: 'Maybe later' },
  { key: 'in_class', label: 'In class', hint: 'Currently in class' },
  { key: 'busy', label: 'Busy', hint: "Don't disturb" },
];

export const REPORT_REASONS = [
  { key: 'harassment', label: 'Harassment' },
  { key: 'fake_identity', label: 'Fake identity' },
  { key: 'inappropriate', label: 'Inappropriate behavior' },
  { key: 'spam', label: 'Spam' },
  { key: 'threats', label: 'Threats' },
  { key: 'other', label: 'Something else' },
];

export const minutesLeft = (iso: string, now = Date.now()) => Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60000));
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
