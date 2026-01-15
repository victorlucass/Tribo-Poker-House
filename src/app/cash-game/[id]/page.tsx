'use client';

import React from 'react';
import CashGameManager from '@/components/cash-game-manager';

export default function CashGameRoomPage({ params }: { params: { id: string } }) {
  const id = params.id;

  if (!id) {
    return null;
  }
  return <CashGameManager gameId={id} />;
}
