'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, LogIn, Wallet, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

interface CashGameHeaderProps {
  gameName?: string;
  gameId: string;
  isClient: boolean;
  currentUserIsPlayer: boolean;
  canManageGame: boolean;
  onLogoutClick: () => void;
}

const CashGameHeader: React.FC<CashGameHeaderProps> = ({
  gameName,
  gameId,
  isClient,
  currentUserIsPlayer,
  onLogoutClick,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const copyGameId = () => {
    if (isClient) {
      navigator.clipboard.writeText(gameId);
      toast({ title: 'ID da Sala Copiado!', description: 'Você pode compartilhar este ID com seus amigos.' });
    }
  };

  return (
    <header className="mb-8 flex items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon" className="shrink-0">
          <Link href="/cash-game">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex flex-col items-start gap-1">
          <h1 className="font-headline text-3xl font-bold text-accent md:text-4xl">{gameName}</h1>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm text-muted-foreground break-all">ID: {gameId}</p>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copyGameId}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {currentUserIsPlayer && (
            <Button variant="secondary" asChild>
              <Link href={`/cash-game/${gameId}/my-situation`}>
                <Wallet className="mr-2 h-4 w-4" />
                Minha Situação
              </Link>
            </Button>
        )}
        {user ? (
            <Button variant="outline" onClick={onLogoutClick} size="sm" className="shrink-0">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
        ) : (
            <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href="/login">
                    <LogIn className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Login</span>
                </Link>
            </Button>
        )}
      </div>
    </header>
  );
};

export default CashGameHeader;

    