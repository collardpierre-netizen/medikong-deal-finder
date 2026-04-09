import type { ProcessStep } from "@/data/trust-process-data";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function ProcessStepsVertical({ steps }: { steps: ProcessStep[] }) {
  return (
    <div className="max-w-[800px] mx-auto relative">
      {steps.map((step, i) => (
        <StepItem key={step.number} step={step} isLast={i === steps.length - 1} delay={i * 100} />
      ))}
    </div>
  );
}

function StepItem({ step, isLast, delay }: { step: ProcessStep; isLast: boolean; delay: number }) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`flex gap-6 md:gap-8 py-8 relative transition-all duration-700 ease-expressive ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="relative flex flex-col items-center shrink-0">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-mk-blue text-white flex items-center justify-center text-lg md:text-xl font-bold relative z-10">
          {step.number}
        </div>
        {!isLast && <div className="absolute top-14 md:top-16 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-mk-line" />}
      </div>
      <div className="pt-1">
        <h3 className="text-lg md:text-xl font-bold text-mk-navy mb-2">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{step.description}</p>
        {step.tags && (
          <div className="flex flex-wrap gap-2">
            {step.tags.map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full text-xs font-semibold bg-mk-blue/10 text-mk-blue">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
