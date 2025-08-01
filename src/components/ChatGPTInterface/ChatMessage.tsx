'use client';

import React from 'react';

interface ChatMessageProps {
  message: any;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className="whitespace-pre-wrap leading-relaxed text-white !text-white">
      {message.content}
    </div>
  );
} 