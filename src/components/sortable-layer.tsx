"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Layers3 } from "lucide-react";
import type { AssetLayer } from "@/lib/types";

export function SortableLayer({ layer, index, total, onMove }: { layer: AssetLayer; index: number; total: number; onMove: (direction: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`sortable-layer ${isDragging ? "dragging" : ""}`}>
      <button className="drag-handle" aria-label={`Drag ${layer.displayName}`} {...attributes} {...listeners}><GripVertical size={20} /></button>
      <span className="order-index">{index + 1}</span>
      <span className="layer-icon"><Layers3 size={18} /></span>
      <span className="sortable-copy"><strong>{layer.displayName}</strong><small>{index === 0 ? "Furthest behind" : index === total - 1 ? "Furthest in front" : `${layer.traits.length} traits`}</small></span>
      <span className="move-buttons">
        <button aria-label={`Move ${layer.displayName} up`} disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp size={17} /></button>
        <button aria-label={`Move ${layer.displayName} down`} disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown size={17} /></button>
      </span>
    </div>
  );
}
