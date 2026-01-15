'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, Palette, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CashGameChip as Chip, CashGamePlayer, CashedOutPlayer } from '@/lib/types';
import { cn } from '@/lib/utils';

const ChipIcon = ({ color, className }: { color: string; className?: string }) => (
    <div
      className={cn('h-5 w-5 rounded-full border-2 border-white/20 inline-block', className)}
      style={{ backgroundColor: color }}
    />
  );

interface GameControlsProps {
  players: CashGamePlayer[];
  cashedOutPlayers: CashedOutPlayer[];
  chips: Chip[];
  chipInventory?: Record<string, number>;
  canManageGame: boolean;
  onUpdateChips: (chips: Chip[]) => void;
  onSettlementClick: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  players,
  cashedOutPlayers,
  chips,
  chipInventory,
  canManageGame,
  onUpdateChips,
  onSettlementClick,
}) => {
  const { toast } = useToast();
  const [isAddChipOpen, setIsAddChipOpen] = useState(false);
  const [newChip, setNewChip] = useState({ name: '', value: '', color: '#ffffff' });

  const sortedChips = useMemo(() => [...chips].sort((a, b) => a.value - b.value), [chips]);
  
  const totalActivePlayerBuyIn = useMemo(() => {
    return players.reduce(
      (total, player) => total + player.transactions.reduce((subTotal, trans) => subTotal + trans.amount, 0),
      0
    );
  }, [players]);

  const handleAddChip = () => {
    const value = parseFloat(newChip.value);
    if (!newChip.name || isNaN(value) || value <= 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, preencha nome e valor (positivo) da ficha.',
      });
      return;
    }
    const newChipData: Chip = {
      id: chips.length > 0 ? Math.max(...chips.map((c) => c.id)) + 1 : 1,
      name: newChip.name,
      value,
      color: newChip.color,
    };
    onUpdateChips([...chips, newChipData]);
    toast({ title: 'Ficha Adicionada!', description: `A ficha "${newChip.name}" foi adicionada.` });
    setNewChip({ name: '', value: '', color: '#ffffff' });
    setIsAddChipOpen(false);
  };

  const handleRemoveChip = (id: number) => {
    if (players.length > 0 || cashedOutPlayers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Ação Bloqueada',
        description: 'Não é possível remover fichas com um jogo em andamento.',
      });
      return;
    }
    onUpdateChips(chips.filter((c) => c.id !== id));
  };
  
  const handleResetChips = () => {
    const initialChips: Chip[] = [
      { id: 1, value: 0.25, color: '#22c55e', name: 'Verde' },
      { id: 2, value: 0.5, color: '#ef4444', name: 'Vermelha' },
      { id: 3, value: 1, color: '#f5f5f5', name: 'Branca' },
      { id: 4, value: 10, color: '#171717', name: 'Preta' },
    ];
    if (players.length > 0 || cashedOutPlayers.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Ação Bloqueada',
        description: 'Não é possível resetar as fichas com um jogo em andamento.',
      });
      return;
    }
    onUpdateChips(initialChips);
    toast({ title: 'Fichas Resetadas!', description: 'As fichas foram restauradas para o padrão.' });
  };

  return (
    <>
      <Card className="bg-secondary hidden lg:block">
        <CardHeader>
          <CardTitle className="text-secondary-foreground">Banca Ativa</CardTitle>
          <CardDescription className="text-secondary-foreground/80">
            Valor total que entrou na mesa (jogadores ativos).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-accent">
            {totalActivePlayerBuyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </CardContent>
      </Card>

      {canManageGame && (
        <>
           {chipInventory && (
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette /> Maleta de Fichas
                </CardTitle>
                <CardDescription>Estoque atual de fichas na banca.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="space-y-3">
                    {sortedChips.map((chip) => {
                        const count = chipInventory[chip.color] ?? 0;
                        return (
                            <div key={chip.id} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <ChipIcon color={chip.color} />
                                    <span>{chip.name} ({chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                                </div>
                                <span className={cn("font-mono font-bold", count === 0 ? "text-red-500" : "text-foreground")}>
                                    {count}x
                                </span>
                            </div>
                        );
                    })}
                </div>
                </CardContent>
            </Card>
           )}



          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator /> Acerto de Contas
              </CardTitle>
              <CardDescription>
                Ao final do jogo, insira a contagem de fichas de cada jogador para calcular os resultados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Clique no botão abaixo para iniciar o acerto de contas.
              </p>
            </CardContent>
            <CardFooter>
                <Button className="w-full" disabled={!canManageGame || players.length === 0} onClick={onSettlementClick}>
                    Iniciar Acerto de Contas
                </Button>
            </CardFooter>
          </Card>
        </>
      )}
    </>
  );
};

export default GameControls;
