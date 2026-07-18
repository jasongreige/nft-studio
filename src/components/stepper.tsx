import { Check } from "lucide-react";

const steps = ["Layers", "Layer order", "Trait rarity", "Preview", "Generate"];

export function Stepper({ current, onSelect }: { current: number; onSelect: (step: number) => void }) {
  return (
    <nav className="stepper" aria-label="Generator steps">
      {steps.map((label, index) => (
        <button key={label} className={`step ${current === index ? "active" : ""} ${current > index ? "done" : ""}`} onClick={() => onSelect(index)}>
          <span className="step-number">{current > index ? <Check size={14} /> : index + 1}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
