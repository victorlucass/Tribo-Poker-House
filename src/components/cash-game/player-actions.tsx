'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, LogIn, PlusCircle, X, Lock } from 'lucide-react';
import type { JoinRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface PlayerActionsProps {
  canManageGame: boolean;
  currentUserIsPlayer: boolean;
  isAdmin: boolean;
  onOpenDistributionModal: (type: 'buy-in', details: { playerName: string; amount: number }) => void;
  requests: JoinRequest[];
  isClient: boolean;
  onDeclineRequest: (request: JoinRequest) => void;
  onApproveRequest: (request: JoinRequest, buyIn: string) => void;
  onAdminJoin: (buyIn: string) => void;
}

const PlayerActions: React.FC<PlayerActionsProps> = ({
  canManageGame,
  currentUserIsPlayer,
  isAdmin,
  onOpenDistributionModal,
  requests,
  isClient,
  onDeclineRequest,
  onApproveRequest,
  onAdminJoin,
}) => {
  const { toast } = useToast();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerBuyIn, setNewPlayerBuyIn] = useState('');
  const [adminBuyIn, setAdminBuyIn] = useState('');
  const [approvalBuyIn, setApprovalBuyIn] = useState('');

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  const handleAddManualPlayer = () => {
    if (!newPlayerName || !newPlayerBuyIn) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Preencha o nome e o valor de buy-in.',
      });
      return;
    }
    onOpenDistributionModal('buy-in', {
      playerName: newPlayerName,
      amount: parseFloat(newPlayerBuyIn),
    });
    setNewPlayerName('');
    setNewPlayerBuyIn('');
  };

  const handleAdminJoinClick = () => {
    if (!adminBuyIn) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Insira um valor de buy-in para entrar no jogo.' });
        return;
    }
    onAdminJoin(adminBuyIn);
    setAdminBuyIn('');
  }

  const handleApproveClick = (req: JoinRequest) => {
    if (!approvalBuyIn) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Insira um valor de buy-in para aprovar o jogador.' });
        return;
    }
    onApproveRequest(req, approvalBuyIn);
    setApprovalBuyIn('');
  }

  return (
    <>
      {isAdmin && !currentUserIsPlayer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <LogIn /> Entrar no Jogo
            </CardTitle>
            <CardDescription>Como administrador, você pode entrar diretamente na mesa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full">Entrar no Jogo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Entrar na Mesa</DialogTitle>
                  <DialogDescription>Insira o valor do seu buy-in para entrar no jogo.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="admin-buy-in">Valor do Buy-in (R$)</Label>
                  <Input
                    id="admin-buy-in"
                    type="number"
                    inputMode="decimal"
                    placeholder="Ex: 50.00"
                    value={adminBuyIn}
                    onChange={(e) => setAdminBuyIn(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={handleAdminJoinClick} disabled={!adminBuyIn}>
                      Confirmar e Distribuir Fichas
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {canManageGame && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus /> Adicionar Jogador Manualmente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Nome do Jogador"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Valor do Buy-in (R$)"
                value={newPlayerBuyIn}
                onChange={(e) => setNewPlayerBuyIn(e.target.value)}
              />
              <Button onClick={handleAddManualPlayer} className="w-full md:w-auto">
                <PlusCircle className="mr-2" />
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canManageGame && pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Lock /> Solicitações Pendentes
            </CardTitle>
            <CardDescription>Aprove ou recuse os jogadores que pediram para entrar na sala.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingRequests.map((req) => (
              <div key={req.userId} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div>
                  <p className="font-semibold">{req.userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {isClient ? `Pedido às ${new Date(req.requestedAt).toLocaleTimeString('pt-BR')}` : 'Carregando...'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                        <Check className="h-4 w-4 mr-2" />
                        Aprovar
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Aprovar {req.userName}?</DialogTitle>
                        <DialogDescription>
                          Insira o valor do buy-in para adicionar o jogador à mesa.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="approval-buy-in">Valor do Buy-in (R$)</Label>
                        <Input
                          id="approval-buy-in"
                          type="number"
                          inputMode="decimal"
                          placeholder="Ex: 50.00"
                          value={approvalBuyIn}
                          onChange={(e) => setApprovalBuyIn(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button onClick={() => handleApproveClick(req)} disabled={!approvalBuyIn}>
                          Confirmar e Distribuir Fichas
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="destructive" onClick={() => onDeclineRequest(req)}>
                    <X className="h-4 w-4 mr-2" />
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default PlayerActions;
