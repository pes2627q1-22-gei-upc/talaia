import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = { label: string; children: ReactNode };

export function ScrollableTable({ label, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => setOverflow(container.scrollWidth > container.clientWidth + 1);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (container.firstElementChild) observer.observe(container.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {overflow ? (
        <p className="table-scroll-hint">
          <span aria-hidden="true">↔</span> Desplaça la taula horitzontalment per veure totes les
          columnes
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="punts-table-scroll"
        role={overflow ? 'region' : undefined}
        aria-label={overflow ? label : undefined}
        tabIndex={overflow ? 0 : undefined}
      >
        {children}
      </div>
    </>
  );
}
