'use client';

import React from 'react';
import CashGameManager from '@/components/cash-game-manager';

export default function CashGameRoomPage({ params }: { params: { id: string } }) {
  // Usando React.use() para acessar o parâmetro de forma síncrona
  const { id } = params;

  if (!id) {
    return null;
  }
  return <CashGameManager gameId={id} />;
}
