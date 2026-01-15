import React from 'react';
import CashGameManager from '@/components/cash-game-manager';

export default async function CashGameRoomPage({ params }: { params: Promise<{ id: string }> }) {
  // Await params to handle both Next.js 15 (Promise) and safe for Next.js 14 (if object)
  const resolvedParams = await params;
  const id = resolvedParams.id;

  if (!id) {
    return null;
  }
  return <CashGameManager gameId={id} />;
}