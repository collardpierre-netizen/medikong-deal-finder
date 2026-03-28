import { useRef, useState, useEffect, ReactNode } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface ScrollableTableProps {
  children: ReactNode;
  className?: string;
}

export function ScrollableTable({ children, className = "" }: ScrollableTableProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);

  const checkScroll = () => {
    const el = ref.current;
    if (!el) return;
    const threshold = 4;
    setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > threshold);
    setCanScrollLeft(el.scrollLeft > threshold);
  };

  useEffect(() => {
    checkScroll();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, []);

  const scrollBy = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 150, behavior: "smooth" });
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} className="overflow-x-auto scrollbar-thin">
        {children}
      </div>

      {/* Mobile scroll indicators — rendered outside the overflow container */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white/90 to-transparent z-20 md:hidden flex items-center justify-start pl-0.5"
          aria-label="Scroll left"
        >
          <div className="bg-mk-navy/10 rounded-full p-1">
            <ChevronLeft size={14} className="text-mk-navy" />
          </div>
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white/90 to-transparent z-20 md:hidden flex items-center justify-end pr-1"
          aria-label="Scroll right"
        >
          <div className="animate-pulse bg-mk-navy/10 rounded-full p-1">
            <ChevronRight size={14} className="text-mk-navy" />
          </div>
        </button>
      )}
    </div>
  );
}
