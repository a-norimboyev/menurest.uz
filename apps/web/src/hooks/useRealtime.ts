import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeEvent } from '@menurest/shared';

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export interface UseRealtimeOptions {
  restaurantId?: string;
  guestToken?: string;
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
  onReconnect?: () => void;
}

// Web Audio API Synthesizer Chime
let audioCtx: AudioContext | null = null;

export function playNotificationChime() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    // First tone (880 Hz - A5)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second harmonic tone (1320 Hz - E6)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.12);
    gain2.gain.setValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.4);
  } catch (err) {
    console.warn('[RealtimeAudio] Could not play synthesized chime:', err);
  }
}

export function useRealtime({
  restaurantId,
  guestToken,
  enabled = true,
  onEvent,
  onReconnect,
}: UseRealtimeOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('menurest_sound_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('menurest_sound_enabled', String(next));
      } catch {}
      if (next) {
        // Play sample chime so user verifies audio is working and grants browser interaction context
        playNotificationChime();
      }
      return next;
    });
  }, []);

  const eventSourceRef = useRef<EventSource | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const lastEventIdRef = useRef<string | null>(null);
  const isFirstConnectRef = useRef<boolean>(true);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);

  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!enabled || (!restaurantId && !guestToken)) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('DISCONNECTED');
      return;
    }

    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    function connect() {
      if (!isMounted) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setStatus('CONNECTING');

      // Determine SSE endpoint URL
      let url: string;
      if (guestToken) {
        url = `/api/v1/guest/events?token=${encodeURIComponent(guestToken)}`;
      } else {
        url = `/api/v1/restaurants/${restaurantId}/events`;
      }

      // Append lastEventId cursor if reconnecting
      if (lastEventIdRef.current) {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}lastEventId=${encodeURIComponent(lastEventIdRef.current)}`;
      }

      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!isMounted) return;
        setStatus('CONNECTED');

        // If this is a reconnection after an outage, trigger full snapshot refresh
        if (!isFirstConnectRef.current) {
          if (onReconnectRef.current) {
            onReconnectRef.current();
          }
        }
        isFirstConnectRef.current = false;
      };

      // General message event handler
      es.onmessage = (messageEvent) => {
        if (!isMounted) return;
        try {
          const raw = JSON.parse(messageEvent.data);
          const event: RealtimeEvent = raw.event || raw;

          if (!event || !event.id) return;

          // Event Deduplication
          if (seenEventIdsRef.current.has(event.id)) {
            return;
          }

          seenEventIdsRef.current.add(event.id);
          if (seenEventIdsRef.current.size > 1000) {
            // Keep memory bounded
            const oldest = Array.from(seenEventIdsRef.current).slice(0, 500);
            for (const oldId of oldest) {
              seenEventIdsRef.current.delete(oldId);
            }
          }

          lastEventIdRef.current = event.id;
          setLastEvent(event);

          // Audio chime for high-priority operational notifications
          if (
            soundEnabled &&
            (event.type === 'order.created' ||
              event.type === 'order.confirmed' ||
              event.type === 'call.created')
          ) {
            playNotificationChime();
          }

          if (onEventRef.current) {
            onEventRef.current(event);
          }
        } catch (err) {
          console.error('[RealtimeClient] Failed to parse event payload:', err);
        }
      };

      es.onerror = () => {
        if (!isMounted) return;
        setStatus('DISCONNECTED');
        es.close();
        eventSourceRef.current = null;

        // Auto retry reconnection after 3 seconds
        retryTimeout = setTimeout(() => {
          if (isMounted) {
            connect();
          }
        }, 3000);
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('DISCONNECTED');
    };
  }, [restaurantId, guestToken, enabled, soundEnabled]);

  return {
    status,
    lastEvent,
    soundEnabled,
    toggleSound,
    isConnected: status === 'CONNECTED',
    isDisconnected: status === 'DISCONNECTED',
  };
}
