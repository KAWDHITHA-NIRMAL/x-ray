import React, { useEffect, useRef, useState } from 'react';
import lottie, { type AnimationItem } from 'lottie-web';
import logoAnimationData from './Logo-animation.json';
import './SplashScreen.css';

export interface SplashScreenProps {
  /** Duration in milliseconds to play before transitioning. Default: 4000 (4 seconds) */
  duration?: number;
  /** Callback fired when splash finishes fading out */
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  duration = 4000,
  onFinish,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [visible, setVisible] = useState(true);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: logoAnimationData,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[SplashScreen] Failed to initialize Lottie animation:', e);
    }

    // Begin fade-out 600ms before duration completes (e.g. at 3400ms for 4s)
    const fadeTimer = window.setTimeout(() => {
      setFadingOut(true);
    }, Math.max(0, duration - 600));

    // Fully exit and reveal page at exactly duration (4000ms)
    const endTimer = window.setTimeout(() => {
      setVisible(false);
      onFinishRef.current?.();
    }, duration);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(endTimer);
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [duration]);

  if (!visible) return null;

  return (
    <div
      className={`splash-overlay${fadingOut ? ' splash-fade-out' : ''}`}
      aria-label="X-ray Splash Screen"
      role="dialog"
      aria-modal="true"
    >
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-content">
        <div ref={containerRef} className="splash-lottie-container" />
      </div>
    </div>
  );
};

export default SplashScreen;
