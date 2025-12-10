import CashGameManager from '@/components/cash-game-manager';

export default function CashGameRoomPage({ params }: { params: { id: string } }) {
  return <CashGameManager gameId={params.id} />;
}
