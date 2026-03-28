import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { FaqItem } from "@/data/entreprise-data";

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="single" collapsible className="max-w-[800px] mx-auto space-y-2">
      {items.map((item, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl overflow-hidden px-6">
          <AccordionTrigger className="py-[18px] text-[15px] font-semibold text-[#1E293B] hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="pb-[18px] text-sm text-muted-foreground leading-relaxed">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
