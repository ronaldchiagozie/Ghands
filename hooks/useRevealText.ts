import { AI_ANIMATION } from '@/components/ai/aiAssistantTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useEffect, useState } from 'react';

export function useRevealText(
  fullText: string,
  active: boolean,
  charDelayMs = AI_ANIMATION.revealCharMs
) {
  const reducedMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState(reducedMotion || !active ? fullText : '');
  const [isComplete, setIsComplete] = useState(reducedMotion || !active || fullText.length === 0);

  useEffect(() => {
    if (!active) {
      setDisplayText(fullText);
      setIsComplete(true);
      return;
    }

    if (reducedMotion || fullText.length === 0) {
      setDisplayText(fullText);
      setIsComplete(true);
      return;
    }

    setDisplayText('');
    setIsComplete(false);

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setDisplayText(fullText.slice(0, index));
      if (index >= fullText.length) {
        clearInterval(timer);
        setIsComplete(true);
      }
    }, charDelayMs);

    return () => clearInterval(timer);
  }, [active, charDelayMs, fullText, reducedMotion]);

  return { displayText, isComplete };
}

export function formatAiChatTime(date = new Date()): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
}
