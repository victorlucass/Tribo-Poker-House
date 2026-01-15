'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CashGamePlayer, CashGameChip, CashedOutPlayer, JoinRequest, PlayerTransaction } from '@/lib/types';


const ChipIcon = ({ color, className }: { color: string; className?: string }) => (
  <div
    className={cn('h-5 w-5 rounded-full border-2 border-white/20 inline-block', className)}
    style={{ backgroundColor: color }}
  />
);

// CashOutDialog
interface CashOutDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    player: CashGamePlayer;
    sortedChips: CashGameChip[];
    onConfirm: (chipCounts: Map<number, number>, cashOutValue: number) => void;
}

export const CashOutDialog: React.FC<CashOutDialogProps> = ({ isOpen, onOpenChange, player, sortedChips, onConfirm }) => {
    const [cashOutChipCounts, setCashOutChipCounts] = useState<Map<number, number>>(new Map());

    const handleCashOutChipCountChange = (chipId: number, count: number) => {
        setCashOutChipCounts((prev) => new Map(prev).set(chipId, count));
    };

    const cashOutValue = useMemo(() => {
        return Array.from(cashOutChipCounts.entries()).reduce((acc, [chipId, count]) => {
          const chip = sortedChips.find((c) => c.id === chipId);
          return acc + (chip ? chip.value * count : 0);
        }, 0);
      }, [cashOutChipCounts, sortedChips]);

    const handleConfirm = () => {
        onConfirm(cashOutChipCounts, cashOutValue);
        setCashOutChipCounts(new Map());
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Cash Out de {player?.name}</DialogTitle>
                <DialogDescription>
                Insira a contagem final de fichas do jogador para calcular o valor a receber.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {sortedChips.map((chip) => (
                <div key={chip.id} className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor={`cashout-chip-${chip.id}`} className="text-right flex items-center justify-end gap-2">
                    <ChipIcon color={chip.color} />
                    Fichas de {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Label>
                    <Input
                    id={`cashout-chip-${chip.id}`}
                    type="number"
                    inputMode="decimal"
                    className="col-span-2"
                    min="0"
                    placeholder="Quantidade"
                    value={cashOutChipCounts.get(chip.id) || ''}
                    onChange={(e) => handleCashOutChipCountChange(chip.id, parseInt(e.target.value) || 0)}
                    />
                </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center text-lg font-bold">
                <Label>Valor a Receber:</Label>
                <span className="text-primary">
                    {cashOutValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
                </Button>
                <Button onClick={handleConfirm}>Confirmar Cash Out</Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ChipDistributionDialog
interface ChipDistributionDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    transactionDetails: { type: string, playerName?: string, amount: number, chipMap?: Map<number, number> };
    sortedChips: CashGameChip[];
    initialChips?: { chipId: number; count: number }[];
    onConfirm: (chipDistribution: { chipId: number; count: number }[], distributedValue: number) => void;
    distributeChips: (amount: number, chips: CashGameChip[]) => {chipId: number, count: number}[];
}

export const ChipDistributionDialog: React.FC<ChipDistributionDialogProps> = ({ isOpen, onOpenChange, transactionDetails, sortedChips, initialChips, onConfirm, distributeChips }) => {
    const [manualChipCounts, setManualChipCounts] = useState<Map<number, number>>(new Map());

    useEffect(() => {
        if (isOpen && transactionDetails?.amount && sortedChips.length > 0) {
            const chipMap = new Map<number, number>();
            
            if (initialChips && initialChips.length > 0) {
                initialChips.forEach(c => chipMap.set(c.chipId, c.count));
            } else {
                const suggestedDistribution = distributeChips(transactionDetails.amount, sortedChips);
                suggestedDistribution.forEach(c => chipMap.set(c.chipId, c.count));
            }
            setManualChipCounts(chipMap);
        }
    }, [isOpen, transactionDetails, sortedChips, distributeChips, initialChips]);


    const handleChipCountChange = (chipId: number, countStr: string) => {
        const count = parseInt(countStr) || 0;
        setManualChipCounts((prev) => new Map(prev).set(chipId, count));
    };

    const distributedValue = useMemo(() => {
        return Array.from(manualChipCounts.entries()).reduce((acc, [chipId, count]) => {
          const chip = sortedChips.find((c) => c.id === chipId);
          return acc + (chip ? chip.value * count : 0);
        }, 0);
      }, [manualChipCounts, sortedChips]);
    
    const handleConfirm = () => {
        const chipDistribution = sortedChips.map((chip) => ({
            chipId: chip.id,
            count: manualChipCounts.get(chip.id) || 0,
        }));
        onConfirm(chipDistribution, distributedValue);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Confirmar Distribuição de Fichas</DialogTitle>
                <DialogDescription>
                Para {transactionDetails?.playerName} - Valor da Transação:{' '}
                {transactionDetails?.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {sortedChips.map((chip) => (
                <div key={chip.id} className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor={`dist-chip-${chip.id}`} className="text-right flex items-center justify-end gap-2">
                    <ChipIcon color={chip.color} />
                    Fichas de {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Label>
                    <Input
                    id={`dist-chip-${chip.id}`}
                    type="number"
                    inputMode="decimal"
                    className="col-span-2"
                    min="0"
                    placeholder="Quantidade"
                    value={manualChipCounts.get(chip.id) || ''}
                    onChange={(e) => handleChipCountChange(chip.id, e.target.value)}
                    />
                </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center text-lg font-bold">
                <Label>Valor Distribuído:</Label>
                <span
                    className={cn(
                    'font-mono',
                    Math.abs(distributedValue - (transactionDetails?.amount || 0)) > 0.01
                        ? 'text-destructive'
                        : 'text-primary'
                    )}
                >
                    {distributedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
                </Button>
                <Button
                onClick={handleConfirm}
                disabled={Math.abs(distributedValue - (transactionDetails?.amount || 0)) > 0.01}
                >
                Confirmar
                </Button>
            </DialogFooter>
            </DialogContent>
      </Dialog>
    )
}

// PlayerDetailsDialog
interface PlayerDetailsDialogProps {
    player: CashGamePlayer | null;
    sortedChips: CashGameChip[];
    onOpenChange: (isOpen: boolean) => void;
    onRebuy: (amount: number) => void;
    onUpdateTransaction: (transactionId: number, newAmount: number, newChips: { chipId: number; count: number }[]) => void;
    onDeleteTransaction: (transactionId: number) => void;
    distributeChips: (amount: number, chips: CashGameChip[]) => {chipId: number, count: number}[];
}

export const PlayerDetailsDialog: React.FC<PlayerDetailsDialogProps> = ({ 
    player, 
    sortedChips, 
    onOpenChange, 
    onRebuy, 
    onUpdateTransaction, 
    onDeleteTransaction,
    distributeChips
}) => {
    const [rebuyAmount, setRebuyAmount] = useState('');
    const [transactionToEdit, setTransactionToEdit] = useState<PlayerTransaction | null>(null);

    const getPlayerTotalChips = useCallback((player: CashGamePlayer) => {
        const playerTotalChips = new Map<number, number>();
        player.transactions.forEach((trans) => {
          trans.chips.forEach((chip) => {
            playerTotalChips.set(chip.chipId, (playerTotalChips.get(chip.chipId) || 0) + chip.count);
          });
        });
        return sortedChips.map((chip) => ({ chipId: chip.id, count: playerTotalChips.get(chip.id) || 0 }));
      }, [sortedChips]);

    const handleRebuyClick = () => {
        const amount = parseFloat(rebuyAmount);
        if (isNaN(amount) || amount <= 0) return;
        onRebuy(amount);
        setRebuyAmount('');
        onOpenChange(false);
    }

    const handleEditClick = (trans: PlayerTransaction) => {
        setTransactionToEdit(trans);
    };

    const handleDeleteClick = (transId: number) => {
        if (confirm('Tem certeza que deseja excluir esta transação? As fichas serão devolvidas para a maleta.')) {
            onDeleteTransaction(transId);
        }
    };
      
    return (
        <>
        <Dialog open={!!player} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl">
            <DialogHeader>
                <DialogTitle>Detalhes de {player?.name}</DialogTitle>
                <DialogDescription>
                Histórico de transações e contagem de fichas do jogador.
                </DialogDescription>
            </DialogHeader>

            {player && (
                <>
                <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Transação</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        {sortedChips.map((chip) => (
                        <TableHead key={chip.id} className="text-center">
                            <div className="flex items-center justify-center gap-2">
                            <ChipIcon color={chip.color} className="h-3 w-3" />
                            <span className="whitespace-nowrap text-xs">
                                {chip.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            </div>
                        </TableHead>
                        ))}
                        <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {player.transactions.map((trans) => (
                        <TableRow key={trans.id}>
                        <TableCell className="font-medium capitalize py-2">
                            {trans.type} #{trans.id}
                        </TableCell>
                        <TableCell className="text-right font-mono py-2">
                            {trans.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        {sortedChips.map((chip) => {
                            const tChip = trans.chips.find((c) => c.chipId === chip.id);
                            return (
                            <TableCell key={chip.id} className="text-center font-mono py-2">
                                {tChip?.count || 0}
                            </TableCell>
                            );
                        })}
                        <TableCell className="text-center py-2">
                            <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(trans)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(trans.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                    <UiTableFooter>
                    <TableRow className="bg-muted/50 hover:bg-muted font-bold">
                        <TableCell colSpan={2} className="text-right">
                        Total de Fichas
                        </TableCell>
                        {getPlayerTotalChips(player).map((chip) => (
                        <TableCell key={chip.chipId} className="text-center font-mono">
                            {chip.count}
                        </TableCell>
                        ))}
                        <TableCell />
                    </TableRow>
                    <TableRow className="bg-muted/80 hover:bg-muted font-bold">
                        <TableCell colSpan={2} className="text-right">
                        Valor Total Investido
                        </TableCell>
                        <TableCell colSpan={sortedChips.length + 1} className="text-left font-mono">
                        {player.transactions
                            .reduce((acc, t) => acc + t.amount, 0)
                            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell />
                    </TableRow>
                    </UiTableFooter>
                </Table>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rebuy-amount" className="text-right">
                        Adicionar Valor (R$)
                    </Label>
                    <Input
                        id="rebuy-amount"
                        type="number"
                        inputMode="decimal"
                        placeholder="Ex: 50"
                        value={rebuyAmount}
                        onChange={(e) => setRebuyAmount(e.target.value)}
                        className="col-span-3"
                    />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                    onClick={handleRebuyClick}
                    >
                    Confirmar Adição
                    </Button>
                </DialogFooter>
                </>
            )}
            </DialogContent>
      </Dialog>
      
      {transactionToEdit && (
         <ChipDistributionDialog
            isOpen={!!transactionToEdit}
            onOpenChange={(open) => !open && setTransactionToEdit(null)}
            transactionDetails={{
                type: 'edit',
                playerName: player?.name,
                amount: transactionToEdit.amount
            }}
            sortedChips={sortedChips}
            initialChips={transactionToEdit.chips}
            distributeChips={distributeChips}
            onConfirm={(chips, val) => {
                onUpdateTransaction(transactionToEdit.id, val, chips);
                setTransactionToEdit(null);
            }}
         />
      )}
      </>
    )
}

// SettlementDialog
interface SettlementDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    players: CashGamePlayer[];
    cashedOutPlayers: CashedOutPlayer[];
    sortedChips: CashGameChip[];
    onPlayerChipCountChange: (playerId: string, chipId: number, count: number) => void;
    onResetGame: () => void;
}

export const SettlementDialog: React.FC<SettlementDialogProps> = ({ isOpen, onOpenChange, players, cashedOutPlayers, sortedChips, onPlayerChipCountChange, onResetGame }) => {
    const [croupierTipsChipCounts, setCroupierTipsChipCounts] = useState<Map<number, number>>(new Map());
    const [rakeChipCounts, setRakeChipCounts] = useState<Map<number, number>>(new Map());

    const getPlayerSettlementData = useCallback(
        (player: CashGamePlayer) => {
          const totalInvested = player.transactions.reduce((acc, t) => acc + t.amount, 0);
          const finalChipCountsMap = new Map(Object.entries(player.finalChipCounts).map(([k, v]) => [parseInt(k), v]));
          const finalValue = Array.from(finalChipCountsMap.entries()).reduce((acc, [chipId, count]) => {
            const chip = sortedChips.find((c) => c.id === chipId);
            return acc + (chip ? chip.value * count : 0);
          }, 0);
          const balance = finalValue - totalInvested;
          return { totalInvested, finalValue, balance };
        },
        [sortedChips]
    );

    const handleTipRakeChipCountChange = (type: 'tips' | 'rake', chipId: number, count: number) => {
        if (type === 'tips') {
          setCroupierTipsChipCounts((prev) => new Map(prev).set(chipId, count));
        } else {
          setRakeChipCounts((prev) => new Map(prev).set(chipId, count));
        }
    };
    
    const croupierTipsValue = useMemo(() => {
        return Array.from(croupierTipsChipCounts.entries()).reduce((acc, [chipId, count]) => {
          const chip = sortedChips.find((c) => c.id === chipId);
          return acc + (chip ? chip.value * count : 0);
        }, 0);
    }, [croupierTipsChipCounts, sortedChips]);
    
    const rakeValue = useMemo(() => {
        return Array.from(rakeChipCounts.entries()).reduce((acc, [chipId, count]) => {
          const chip = sortedChips.find((c) => c.id === chipId);
          return acc + (chip ? chip.value * count : 0);
        }, 0);
    }, [rakeChipCounts, sortedChips]);

    const totalSessionBuyIn = useMemo(() => {
        const activePlayersBuyIn = players.reduce(
          (total, player) => total + player.transactions.reduce((subTotal, trans) => subTotal + trans.amount, 0),
          0
        );
        const cashedOutPlayersBuyIn = cashedOutPlayers.reduce((total, player) => total + player.totalInvested, 0);
        return activePlayersBuyIn + cashedOutPlayersBuyIn;
    }, [players, cashedOutPlayers]);

    const totalSettlementValue = useMemo(() => {
        const activePlayersValue = players.reduce((total, player) => {
          return total + getPlayerSettlementData(player).finalValue;
        }, 0);
        const cashedOutPlayersValue = cashedOutPlayers.reduce((total, player) => total + player.amountReceived, 0);
        return activePlayersValue + cashedOutPlayersValue;
    }, [players, cashedOutPlayers, getPlayerSettlementData]);

    const settlementDifference = useMemo(() => {
        return totalSettlementValue + croupierTipsValue + rakeValue - totalSessionBuyIn;
    }, [totalSettlementValue, totalSessionBuyIn, croupierTipsValue, rakeValue]);
    
    const settlementChipsInPlay = useMemo(() => {
        const totalDistributed = new Map<number, number>();
        [...players, ...cashedOutPlayers].forEach((p) => {
          p.transactions.forEach((t) => {
            t.chips.forEach((c) => {
              totalDistributed.set(c.chipId, (totalDistributed.get(c.chipId) || 0) + c.count);
            });
          });
        });
    
        const totalCashedOutChips = new Map<number, number>();
        cashedOutPlayers.forEach((p) => {
          const pChipCounts = new Map(Object.entries(p.chipCounts).map(([k, v]) => [parseInt(k), v]));
          pChipCounts.forEach((count, chipId) => {
            totalCashedOutChips.set(chipId, (totalCashedOutChips.get(chipId) || 0) + count);
          });
        });
    
        const remainingChips = new Map<number, number>();
        sortedChips.forEach((chip) => {
          const distributed = totalDistributed.get(chip.id) || 0;
          const cashedOut = totalCashedOutChips.get(chip.id) || 0;
          remainingChips.set(chip.id, distributed - cashedOut);
        });
    
        return sortedChips.map((chip) => ({ chip, count: remainingChips.get(chip.id) || 0 }));
      }, [players, cashedOutPlayers, sortedChips]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] md:max-w-4xl lg:max-w-6xl h-[90vh]">
            <DialogHeader>
                <DialogTitle>Acerto de Contas Final</DialogTitle>
                <DialogDescription>
                Insira a contagem final de fichas para cada jogador, gorjetas e rake. O sistema calculará os
                valores.
                </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto pr-4 -mr-4 h-full">
                <div className="p-4 rounded-md bg-muted/50 border border-border mb-6">
                <h3 className="text-lg font-bold text-foreground mb-2">
                    Total de Fichas em Jogo (Restantes)
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {settlementChipsInPlay.map(({ chip, count }) => (
                    <div key={chip.id} className="flex items-center gap-2">
                        <ChipIcon color={chip.color} />
                        <span className="font-bold">{chip.name}:</span>
                        <span className="font-mono text-muted-foreground">{count} fichas</span>
                    </div>
                    ))}
                </div>
                </div>

                <h3 className="text-xl font-bold mb-2">Jogadores</h3>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[150px]">Jogador</TableHead>
                    {sortedChips.map((chip) => (
                        <TableHead key={chip.id} className="text-center w-[100px]">
                        <div className="flex items-center justify-center gap-2">
                            <ChipIcon color={chip.color} />
                            <span>{chip.value.toFixed(2)}</span>
                        </div>
                        </TableHead>
                    ))}
                    <TableHead className="text-right">Investido (R$)</TableHead>
                    <TableHead className="text-right font-bold text-foreground">
                        Valor Contado (R$)
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {players.map((player) => {
                    const { totalInvested, finalValue } = getPlayerSettlementData(player);
                    const pFinalChips = new Map(
                        Object.entries(player.finalChipCounts).map(([k, v]) => [parseInt(k), v])
                    );

                    return (
                        <TableRow key={player.id}>
                        <TableCell className="font-medium">{player.name}</TableCell>
                        {sortedChips.map((chip) => (
                            <TableCell key={chip.id}>
                            <Input
                                type="number"
                                inputMode="decimal"
                                className="w-16 text-center font-mono mx-auto"
                                min="0"
                                value={pFinalChips.get(chip.id) || ''}
                                onChange={(e) =>
                                onPlayerChipCountChange(
                                    player.id,
                                    chip.id,
                                    parseInt(e.target.value) || 0
                                )
                                }
                            />
                            </TableCell>
                        ))}
                        <TableCell className="text-right font-mono">
                            {totalInvested.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                            {finalValue.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            })}
                        </TableCell>
                        </TableRow>
                    );
                    })}
                </TableBody>
                </Table>

                <Separator className="my-6" />

                <div className="grid md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-bold mb-2">Gorjeta do Croupier</h3>
                    <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                    {sortedChips.map((chip) => (
                        <div key={`tips-${chip.id}`} className="grid grid-cols-2 items-center gap-2">
                        <Label
                            htmlFor={`tips-chip-${chip.id}`}
                            className="text-sm flex items-center gap-2"
                        >
                            <ChipIcon color={chip.color} />
                            Fichas de{' '}
                            {chip.value.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            })}
                        </Label>
                        <Input
                            id={`tips-chip-${chip.id}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            placeholder="Qtd."
                            className="font-mono text-center"
                            value={croupierTipsChipCounts.get(chip.id) || ''}
                            onChange={(e) =>
                            handleTipRakeChipCountChange('tips', chip.id, parseInt(e.target.value) || 0)
                            }
                        />
                        </div>
                    ))}
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center font-bold">
                        <span>Total Gorjeta:</span>
                        <span>
                        {croupierTipsValue.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        })}
                        </span>
                    </div>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-bold mb-2">Rake da Casa</h3>
                    <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                    {sortedChips.map((chip) => (
                        <div key={`rake-${chip.id}`} className="grid grid-cols-2 items-center gap-2">
                        <Label
                            htmlFor={`rake-chip-${chip.id}`}
                            className="text-sm flex items-center gap-2"
                        >
                            <ChipIcon color={chip.color} />
                            Fichas de{' '}
                            {chip.value.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            })}
                        </Label>
                        <Input
                            id={`rake-chip-${chip.id}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            placeholder="Qtd."
                            className="font-mono text-center"
                            value={rakeChipCounts.get(chip.id) || ''}
                            onChange={(e) =>
                            handleTipRakeChipCountChange('rake', chip.id, parseInt(e.target.value) || 0)
                            }
                        />
                        </div>
                    ))}
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center font-bold">
                        <span>Total Rake:</span>
                        <span>
                        {rakeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                    </div>
                </div>
                </div>

                <Separator className="my-6" />

                {Math.abs(settlementDifference) < 0.01 ? (
                <div className="p-4 rounded-md bg-green-900/50 border border-green-500">
                    <div className="flex items-center gap-2">
                    <CheckCircle2 className="text-green-400" />
                    <h3 className="text-lg font-bold text-green-300">Contas Batem!</h3>
                    </div>
                    <p className="text-green-400/80 mt-1">
                    O valor total (fichas + gorjeta + rake) corresponde ao valor total que entrou na mesa.
                    </p>
                    <div className="mt-4">
                    <h4 className="font-bold mb-2 text-green-300">Pagamentos Finais:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        <div>
                        <p className="font-bold border-b pb-1 mb-2">Valor a Receber</p>
                        <ul className="space-y-1 list-disc list-inside">
                            {players.map((player) => {
                            const { finalValue } = getPlayerSettlementData(player);
                            return (
                                <li key={player.id}>
                                {player.name} recebe{' '}
                                <span className="font-bold text-green-400">
                                    {finalValue.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                    })}
                                </span>
                                .
                                </li>
                            );
                            })}
                        </ul>
                        </div>
                        <div>
                        <p className="font-bold border-b pb-1 mb-2">Lucro / Prejuízo</p>
                        <ul className="space-y-1 list-disc list-inside">
                            {players.map((player) => {
                            const { balance } = getPlayerSettlementData(player);
                            return (
                                <li key={player.id}>
                                {player.name}:{' '}
                                <span
                                    className={cn(
                                    'font-bold',
                                    balance >= 0 ? 'text-green-400' : 'text-red-400'
                                    )}
                                >
                                    {balance.toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                    })}
                                </span>
                                </li>
                            );
                            })}
                        </ul>
                        </div>
                    </div>
                    </div>
                </div>
                ) : (
                <div className="p-4 rounded-md bg-red-900/50 border border-red-500">
                    <div className="flex items-center gap-2">
                    <AlertCircle className="text-red-400" />
                    <h3 className="text-lg font-bold text-red-300">Erro na Contagem!</h3>
                    </div>
                    <p className="text-red-400/80 mt-1">
                    A soma das fichas, gorjeta e rake não corresponde ao total de buy-ins. Verifique a contagem
                    de fichas de cada jogador.
                    </p>
                </div>
                )}
            </div>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
                <div className="flex-1 text-center md:text-right font-mono bg-muted p-2 rounded-md text-xs">
                TOTAL ENTRADO:{' '}
                <span className="font-bold">
                    {totalSessionBuyIn.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <br />
                TOTAL CONTADO:{' '}
                <span className="font-bold">
                    {totalSettlementValue.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    })}
                </span>{' '}
                (+
                {croupierTipsValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{' '}
                Gorjeta) (+
                {rakeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} Rake)
                <br />
                Diferença:{' '}
                <span
                    className={cn(
                    'font-bold',
                    Math.abs(settlementDifference) >= 0.01 ? 'text-destructive' : 'text-green-400'
                    )}
                >
                    {settlementDifference.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    })}
                </span>
                </div>
                <Dialog>
                <DialogTrigger asChild>
                    <Button variant="destructive">Resetar e Finalizar Sessão</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                    <DialogTitle>Confirmar Finalização</DialogTitle>
                    <DialogDescription>
                        Tem certeza que deseja finalizar a sessão? A sala e todos os seus dados serão apagados
                        permanentemente. Esta ação não pode ser desfeita.
                    </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={onResetGame}>
                        Sim, Finalizar
                    </Button>
                    </DialogFooter>
                </DialogContent>
                </Dialog>
            </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
