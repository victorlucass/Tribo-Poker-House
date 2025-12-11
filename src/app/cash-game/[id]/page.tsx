'use client';

import React from 'react';
import CashGameManager from '@/components/cash-game-manager';

export default function CashGameRoomPage({ params }: { params: { id: string } }) {
  // Usando React.use() para acessar o parâmetro de forma síncrona
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;

  if (!id) {
    return null;
  }
  return <CashGameManager gameId={id} />;
}
