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
  canManageGame: boolean;
  onUpdateChips: (chips: Chip[]) => void;
  onSettlementClick: () => void;
}

const GameControls: React.FC<GameControlsProps> = ({
  players,
  cashedOutPlayers,
  chips,
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette /> Fichas do Jogo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedChips.map((chip) => (
                  <div key={chip.id} className="flex items-center gap-2">
                    <ChipIcon color={chip.color} />
                    <Input
                      type="text"
                      value={chip.name}
                      onChange={(e) => {
                        const updatedChips = chips.map((c) =>
                          c.id === chip.id ? { ...c, name: e.target.value } : c
                        );
                        onUpdateChips(updatedChips);
                      }}
                      className="w-24 flex-1"
                    />
                    <div className="flex items-center">
                      <span className="mr-2 text-sm">R$</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={chip.value}
                        onChange={(e) => {
                          const updatedChips = chips.map((c) =>
                            c.id === chip.id ? { ...c, value: parseFloat(e.target.value) || 0 } : c
                          );
                          onUpdateChips(updatedChips);
                        }}
                        className="w-20"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveChip(chip.id)}
                      disabled={players.length > 0 || cashedOutPlayers.length > 0}
                    >
                      <Trash2 className="h-4 w-4 text-red-500/80" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Dialog open={isAddChipOpen} onOpenChange={setIsAddChipOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Adicionar Ficha
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Ficha</DialogTitle>
                    <DialogDescription>Defina as propriedades da nova ficha para o jogo.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="chip-name" className="text-right">
                        Nome
                      </Label>
                      <Input
                        id="chip-name"
                        value={newChip.name}
                        onChange={(e) => setNewChip({ ...newChip, name: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="chip-value" className="text-right">
                        Valor (R$)
                      </Label>
                      <Input
                        id="chip-value"
                        type="number"
                        inputMode="decimal"
                        value={newChip.value}
                        onChange={(e) => setNewChip({ ...newChip, value: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="chip-color" className="text-right">
                        Cor
                      </Label>
                      <Input
                        id="chip-color"
                        type="color"
                        value={newChip.color}
                        onChange={(e) => setNewChip({ ...newChip, color: e.target.value })}
                        className="col-span-3 h-10 p-1"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddChip}>Salvar Ficha</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleResetChips}
                disabled={players.length > 0 || cashedOutPlayers.length > 0}
              >
                Resetar Fichas
              </Button>
            </CardFooter>
          </Card>

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
