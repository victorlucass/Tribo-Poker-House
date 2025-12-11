'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { CashGame, CashGamePlayer, CashGameChip } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const ChipIcon = ({ color, className }: { color: string; className?: string }) => (
  <div
    className={cn('h-5 w-5 rounded-full border-2 border-white/20 inline-block', className)}
    style={{ backgroundColor: color }}
  />
);

export default function MySituationPage() {
  const params = useParams();
  const gameId = params.id as string;
  
  const { user, loading: authLoading } = useAuth();
  const firestore = useFirestore();

  const gameRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'cashGames', gameId);
  }, [firestore, gameId]);

  const { data: game, status: gameStatus } = useDoc<CashGame>(gameRef);

  const [myChipCounts, setMyChipCounts] = useState<Map<number, number>>(new Map());

  const player = useMemo(() => {
    if (!user || !game) return null;
    return game.players.find(p => p.id === user.uid);
  }, [user, game]);

  const sortedChips = useMemo(() => game?.chips ? [...game.chips].sort((a, b) => a.value - b.value) : [], [game]);

  const handleMyChipCountChange = (chipId: number, count: number) => {
    setMyChipCounts(prev => new Map(prev).set(chipId, count));
  };

  const myCurrentChipsValue = useMemo(() => {
    return Array.from(myChipCounts.entries()).reduce((acc, [chipId, count]) => {
      const chip = sortedChips.find(c => c.id === chipId);
      return acc + (chip ? chip.value * count : 0);
    }, 0);
  }, [myChipCounts, sortedChips]);
  
  const myTotalInvested = useMemo(() => {
    if (!player) return 0;
    return player.transactions.reduce((acc, t) => acc + t.amount, 0);
  }, [player]);
  
  const myBalance = useMemo(() => {
    return myCurrentChipsValue - myTotalInvested;
  }, [myCurrentChipsValue, myTotalInvested]);

  if (authLoading || gameStatus === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Skeleton className="h-[600px] w-full max-w-lg" />
      </div>
    );
  }
  
  if (!player || !game) {
     return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <Card>
            <CardHeader>
                <CardTitle>Jogador não encontrado</CardTitle>
                <CardDescription>Você não parece estar nesta mesa de jogo.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href={`/cash-game/${gameId}`}>Voltar para a Sala</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-lg">
        <header className="mb-8 flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
                <Link href={`/cash-game/${gameId}`}>
                    <ArrowLeft />
                </Link>
            </Button>
            <div>
              <h1 className="font-headline text-3xl font-bold text-accent">Minha Situação</h1>
              <p className="text-muted-foreground">Calcule seu balanço atual inserindo suas fichas.</p>
            </div>
        </header>

        <main className="space-y-8">
          <Card>
            <CardHeader>
                <CardTitle>Meu Investimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {player.transactions.map(t => (
                   <div key={t.id} className="flex justify-between items-center">
                      <span className="capitalize text-muted-foreground">{t.type} #{t.id}</span>
                      <span className="font-mono">{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                   </div>
                ))}
                 <Separator className="!my-4" />
                 <div className="flex justify-between items-center font-bold text-base">
                    <span>Total Investido</span>
                    <span className="font-mono">{myTotalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                 </div>
            </CardContent>
          </Card>
          
          <Card>
             <CardHeader>
                <CardTitle>Minhas Fichas Atuais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {sortedChips.map((chip) => (
                  <div key={chip.id} className="grid grid-cols-[auto_1fr] items-center gap-4">
                    <Label htmlFor={`my-chip-${chip.id}`} className="flex items-center justify-end gap-2 text-sm">
                      <ChipIcon color={chip.color} />
                      <span className="whitespace-nowrap">Fichas de {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </Label>
                    <Input
                      id={`my-chip-${chip.id}`}
                      type="number"
                      inputMode="decimal"
                      className="font-mono text-center"
                      min="0"
                      placeholder="Quantidade"
                      value={myChipCounts.get(chip.id) || ''}
                      onChange={(e) => handleMyChipCountChange(chip.id, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
            </CardContent>
          </Card>
        </main>
        
        <footer className="mt-8">
            <Card className="bg-secondary/50 border-primary shadow-primary/10 shadow-lg">
                <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-center font-bold text-lg">
                       <Label>Valor em Fichas:</Label>
                       <span className="font-mono text-primary">{myCurrentChipsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                     <Separator />
                    <div className="flex justify-between items-center font-bold text-xl">
                       <Label>Balanço (Lucro/Prejuízo):</Label>
                       <span className={cn('font-mono', myBalance >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {myBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                </CardContent>
            </Card>
        </footer>
      </div>
    </div>
  );
}
