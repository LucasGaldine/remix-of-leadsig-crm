import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { shouldAnimateMainPageTransition } from "@/lib/pageTransition";

interface MainPageTransitionProps {
  children: React.ReactNode;
}

export function MainPageTransition({ children }: MainPageTransitionProps) {
  const location = useLocation();
  const previousPathRef = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);
  const [routeNeedsTransition, setRouteNeedsTransition] = useState(false);
  const [playTransition, setPlayTransition] = useState(false);
  const [transitionNonce, setTransitionNonce] = useState(0);

  const shouldAnimate = shouldAnimateMainPageTransition(location.pathname, previousPathRef.current);

  const clearFrame = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  const playRouteTransition = () => {
    clearFrame();
    requestAnimationFrame(() => {
      setTransitionNonce((value) => value + 1);
      setPlayTransition(true);
    });
  };

  useEffect(() => {
    clearFrame();

    if (shouldAnimate) {
      setRouteNeedsTransition(true);
      setPlayTransition(false);
      frameRef.current = window.requestAnimationFrame(() => {
        playRouteTransition();
      });
    } else {
      setRouteNeedsTransition(false);
      setPlayTransition(false);
    }

    previousPathRef.current = location.pathname;
    return () => {
      clearFrame();
    };
  }, [location.pathname]);

  const shouldRenderAnimation = playTransition && routeNeedsTransition;

  if (!shouldRenderAnimation) return <>{children}</>;

  return (
    <>
      {children}
      <div key={`${location.key}-${transitionNonce}`} className="main-page-transition-overlay" aria-hidden />
    </>
  );
}
