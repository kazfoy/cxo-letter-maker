'use client';

import React, { useState, ReactNode, useId } from 'react';

interface AccordionProps {
  title: string;
  defaultExpanded?: boolean;
  children: ReactNode;
  className?: string;
}

export function Accordion({
  title,
  defaultExpanded = false,
  children,
  className = '',
}: AccordionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentId = useId();
  const buttonId = useId();

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      <button
        id={buttonId}
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="font-medium text-slate-700">{title}</span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!isExpanded}
        className={isExpanded ? 'p-4 border-t border-slate-200 bg-white' : ''}
      >
        {isExpanded && children}
      </div>
    </div>
  );
}
