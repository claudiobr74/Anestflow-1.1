import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripHorizontal } from 'lucide-react';

export function DraggablePanel({ id, children, isDark, className }: { id: string, children: React.ReactNode, isDark?: boolean, key?: string | number, className?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: isDragging ? 'relative' as const : 'static' as const,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} id={id} style={style} className={`relative group/panel transition-all duration-300 ${isDragging ? 'shadow-sm scale-[1.02]' : ''} ${className || ''}`}>
      {/* Drag handle */}
      <div 
        {...attributes} 
        {...listeners}
        className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 cursor-grab active:cursor-grabbing opacity-80 hover:opacity-100 group-hover/panel:opacity-100 transition-all duration-200 rounded-full z-20 shadow-xs border flex items-center justify-center scale-95 hover:scale-100 ${
          isDark 
            ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 shadow-black/40' 
            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-slate-200/50'
        }`}
        title="Arraste para reordenar"
      >
        <GripHorizontal className="w-3.5 h-3.5" />
      </div>
      {children}
    </div>
  );
}
