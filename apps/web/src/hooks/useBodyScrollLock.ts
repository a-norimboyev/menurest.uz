import { useEffect } from 'react';

/**
 * Modal yoki drawer ochiq paytida orqa fonni (html va body) qat'iy qotirib turuvchi hook.
 * Mishka g'ildiragi (mouse wheel) aylantirilganda orqadagi sahifa surilib ketmaydi.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    // Windows Chrome, Edge, Firefox brauzerlarida scrollbar yo'qolganda sahifa sakramasligi uchun
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    // Ham documentElement (html), ham body ga overflow: hidden beriladi
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
    };
  }, [isLocked]);
}
