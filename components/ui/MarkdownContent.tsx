"use client";

import React from "react";

export function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-secondary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export default function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={key} className="space-y-1 mb-2">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex gap-2 text-gray-700 text-sm leading-relaxed">
            <span className="text-primary font-bold mt-0.5 flex-shrink-0">•</span>
            <span>{parseInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      flushList(`ul-${i}`);
      nodes.push(
        <h2
          key={i}
          className="text-lg font-bold text-secondary mt-7 mb-2 pb-1 border-b border-primary-100"
        >
          {parseInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      flushList(`ul-${i}`);
      nodes.push(
        <h3 key={i} className="text-base font-semibold text-secondary mt-5 mb-1.5">
          {parseInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      flushList(`ul-${i}`);
      nodes.push(
        <h4 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">
          {parseInline(line.slice(5))}
        </h4>
      );
    } else if (/^(\d+)\.\s/.test(line)) {
      flushList(`ul-${i}`);
      const content = line.replace(/^\d+\.\s/, "");
      const num = (line.match(/^(\d+)/) ?? ["1"])[0];
      nodes.push(
        <div key={i} className="flex gap-2 text-gray-700 text-sm leading-relaxed mb-1">
          <span className="text-primary font-bold flex-shrink-0 w-5">{num}.</span>
          <span>{parseInline(content)}</span>
        </div>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuffer.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList(`ul-${i}`);
      nodes.push(<div key={i} className="h-1" />);
    } else {
      flushList(`ul-${i}`);
      nodes.push(
        <p key={i} className="text-gray-700 text-sm leading-relaxed">
          {parseInline(line)}
        </p>
      );
    }
  });

  flushList("ul-end");
  return <div>{nodes}</div>;
}
