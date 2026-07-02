import { AI_ANIMATION } from '@/components/ai/aiAssistantTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useEffect, useRef, useState } from 'react';

type UseTypewriterTextOptions = {
  active?: boolean;
  startDelayMs?: number;
};

export function useTypewriterText(
  fullText: string,
  charDelayMs = 80,
  options: UseTypewriterTextOptions = {}
) {
  const { active = true, startDelayMs = 0 } = options;
  const reducedMotion = useReducedMotion();
  const hasStartedRef = useRef(false);
  const [displayText, setDisplayText] = useState(reducedMotion ? fullText : '');
  const [isComplete, setIsComplete] = useState(reducedMotion);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayText(fullText);
      setIsComplete(true);
      return;
    }

    if (!active || hasStartedRef.current) return;

    hasStartedRef.current = true;
    setDisplayText('');
    setIsComplete(false);

    let index = 0;
    let charTimer: ReturnType<typeof setInterval> | null = null;

    const startDelayTimer = setTimeout(() => {
      charTimer = setInterval(() => {
        index += 1;
        setDisplayText(fullText.slice(0, index));
        if (index >= fullText.length) {
          if (charTimer) clearInterval(charTimer);
          setIsComplete(true);
        }
      }, charDelayMs);
    }, startDelayMs);

    return () => {
      clearTimeout(startDelayTimer);
      if (charTimer) clearInterval(charTimer);
    };
  }, [active, charDelayMs, fullText, reducedMotion, startDelayMs]);

  useEffect(() => {
    if (isComplete) return;

    const cursorTimer = setInterval(() => {
      setCursorVisible((visible) => !visible);
    }, AI_ANIMATION.typewriterCursorBlinkMs);

    return () => clearInterval(cursorTimer);
  }, [isComplete]);

  const textWithCursor =
    isComplete || reducedMotion
      ? displayText
      : `${displayText}${cursorVisible ? '|' : ' '}`;

  return { displayText, textWithCursor, isComplete, cursorVisible };
}
