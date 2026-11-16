"use client";

import { MotionConfig, Reorder, useDragControls } from "motion/react";

/**
 * Drag-to-reorder list. Drag by the handle (touch or mouse), or focus the handle
 * and use the arrow keys. `onReorder` updates local order while dragging;
 * `onCommit` is called once with the final order, to save it.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  onCommit,
  children,
}: {
  items: T[];
  onReorder: (items: T[]) => void;
  onCommit: (items: T[]) => void;
  children: (item: T) => React.ReactNode;
}) {
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
    onCommit(next);
  };

  return (
    // reducedMotion="user": with "reduce motion" on, rows jump to their place instead of sliding.
    <MotionConfig reducedMotion="user">
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={onReorder}
        className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface"
      >
        {items.map((item, index) => (
          <Row
            key={item.id}
            item={item}
            onDrop={() => onCommit(items)}
            onMove={(delta) => move(index, delta)}
          >
            {children(item)}
          </Row>
        ))}
      </Reorder.Group>
    </MotionConfig>
  );
}

function Row<T>({
  item,
  onDrop,
  onMove,
  children,
}: {
  item: T;
  onDrop: () => void;
  onMove: (delta: number) => void;
  children: React.ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="relative flex items-center bg-surface"
    >
      <button
        type="button"
        aria-label="إعادة الترتيب: اسحب، أو استخدم السهمين للأعلى والأسفل"
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMove(e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-muted active:cursor-grabbing"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="currentColor"
          aria-hidden
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>
      {children}
    </Reorder.Item>
  );
}
