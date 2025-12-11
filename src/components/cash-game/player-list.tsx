'use client';

import React, { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from '@/components/ui/table';
import { FileText, LogOut, Shuffle, Trash2 } from 'lucide-react';
import type { CashGameChip as Chip, CashGamePlayer as Player } from '@/lib/types';
import { cn } from '@/lib/utils';

const ChipIcon = ({ color, className }: { color: string; className?: string }) => (
  <div
    className={cn('h-5 w-5 rounded-full border-2 border-white/20 inline-block', className)}
    style={{ backgroundColor: color }}
  />
);

interface PlayerListProps {
  players: Player[];
  sortedChips: Chip[];
  canManageGame: boolean;
  positionsSet: boolean;
  onStartDealing: () => void;
  onPlayerDetailsClick: (player: Player) => void;
  onCashOutClick: (player: Player) => void;
  onRemovePlayer: (id: string) => void;
}

const PlayerList: React.FC<PlayerListProps> = ({
  players,
  sortedChips,
  canManageGame,
  positionsSet,
  onStartDealing,
  onPlayerDetailsClick,
  onCashOutClick,
  onRemovePlayer
}) => {
  const getPlayerTotalChips = useCallback(
    (player: Player) => {
      const playerTotalChips = new Map<number, number>();
      player.transactions.forEach((trans) => {
        trans.chips.forEach((chip) => {
          playerTotalChips.set(chip.chipId, (playerTotalChips.get(chip.chipId) || 0) + chip.count);
        });
      });
      return sortedChips.map((chip) => ({ chipId: chip.id, count: playerTotalChips.get(chip.id) || 0 }));
    },
    [sortedChips]
  );

  const totalChipsOnTable = useMemo(() => {
    const totals = new Map<number, number>();
    players.forEach((player) => {
      const playerChips = getPlayerTotalChips(player);
      playerChips.forEach((chip) => {
        totals.set(chip.chipId, (totals.get(chip.chipId) || 0) + chip.count);
      });
    });
    return sortedChips.map((chip) => ({ chip, count: totals.get(chip.id) || 0 }));
  }, [players, sortedChips, getPlayerTotalChips]);
  
  const totalValueOnTableByChip = useMemo(() => {
    return totalChipsOnTable.map(({ chip, count }) => chip.value * count);
  }, [totalChipsOnTable]);

  const grandTotalValueOnTable = useMemo(() => {
    return totalValueOnTableByChip.reduce((acc, value) => acc + value, 0);
  }, [totalValueOnTableByChip]);


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Jogadores na Mesa</CardTitle>
          <CardDescription>Distribuição de fichas e ações para cada jogador ativo.</CardDescription>
        </div>
        {!positionsSet && players.length > 1 && canManageGame && (
          <Button onClick={onStartDealing} variant="secondary">
            <Shuffle className="mr-2 h-4 w-4" />
            Sortear Posições
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead className="text-right">Buy-in Total</TableHead>
                {sortedChips.map((chip) => (
                  <TableHead key={chip.id} className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <ChipIcon color={chip.color} />
                      <span className="whitespace-nowrap">
                        {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4 + sortedChips.length}
                    className="text-center text-muted-foreground h-24"
                  >
                    Nenhum jogador na mesa ainda.
                  </TableCell>
                </TableRow>
              ) : (
                players.map((player) => {
                  const playerTotalBuyIn = player.transactions.reduce((acc, t) => acc + t.amount, 0);
                  const playerTotalChips = getPlayerTotalChips(player);
                  return (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium">{player.name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {playerTotalBuyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      {playerTotalChips.map((chip) => (
                        <TableCell key={chip.chipId} className="text-center font-mono">
                          {chip.count}
                        </TableCell>
                      ))}
                      <TableCell className="text-right flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPlayerDetailsClick(player)}
                          disabled={!canManageGame}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCashOutClick(player)}
                          disabled={!canManageGame}
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={!canManageGame}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Remover {player.name}?</DialogTitle>
                              <DialogDescription>
                                Tem certeza que deseja remover este jogador? Todas as suas transações serão
                                perdidas. Esta ação não é um cash out.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancelar</Button>
                              </DialogClose>
                              <Button variant="destructive" onClick={() => onRemovePlayer(player.id)}>
                                Sim, Remover
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {players.length > 0 && (
              <UiTableFooter>
                <TableRow className="bg-muted/50 hover:bg-muted font-bold">
                  <TableCell colSpan={2} className="text-right">
                    Total de Fichas na Mesa
                  </TableCell>
                  {totalChipsOnTable.map(({ chip, count }) => (
                    <TableCell key={chip.id} className="text-center font-mono">
                      {count}
                    </TableCell>
                  ))}
                  <TableCell></TableCell>
                </TableRow>
                <TableRow className="bg-muted/80 hover-bg-muted font-bold">
                  <TableCell colSpan={2} className="text-right">
                    Valor Total na Mesa
                  </TableCell>
                  {totalValueOnTableByChip.map((value, index) => (
                    <TableCell key={sortedChips[index].id} className="text-center font-mono">
                      {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono">
                    {grandTotalValueOnTable.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </TableCell>
                </TableRow>
              </UiTableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerList;
