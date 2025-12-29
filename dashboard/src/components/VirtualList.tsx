"use client";

import React, { useRef, useState, useEffect, CSSProperties } from 'react';

interface VirtualListProps {
  height: number;
  width: string | number;
  itemCount: number;
  itemSize: number;
  children: (props: { index: number; style: CSSProperties }) => React.ReactNode;
}

export default function VirtualList({ height, width, itemCount, itemSize, children }: VirtualListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalHeight = itemCount * itemSize;
  
  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemSize));
  // Add buffer of 5 items
  const endIndex = Math.min(itemCount, Math.ceil((scrollTop + height) / itemSize) + 5);

  const items = [];
  for (let i = startIndex; i < endIndex; i++) {
    items.push(
      <React.Fragment key={i}>
        {children({
          index: i,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: itemSize,
            transform: `translateY(${i * itemSize}px)`,
          },
        })}
      </React.Fragment>
    );
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
        willChange: 'transform' // Optimize scrolling
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {items}
      </div>
    </div>
  );
}
