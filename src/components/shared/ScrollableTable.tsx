import { useRef, useState, useEffect, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

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

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left fade */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none md:hidden" />
      )}

      <div ref={ref} className="overflow-x-auto scrollbar-thin">
        {children}
      </div>

      {/* Right fade + arrow */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none md:hidden flex items-center justify-end pr-1">
          <div className="animate-pulse bg-mk-navy/10 rounded-full p-1">
            <ChevronRight size={16} className="text-mk-navy" />
          </div>
        </div>
      )}
    </div>
  );
}
