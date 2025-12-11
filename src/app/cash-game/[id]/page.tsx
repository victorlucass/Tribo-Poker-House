'use client';

import CashGameManager from '@/components/cash-game-manager';

export default function CashGameRoomPage({ params }: { params: { id: string } }) {
  if (!params.id) {
    return null;
  }
  return <CashGameManager gameId={params.id} />;
}
