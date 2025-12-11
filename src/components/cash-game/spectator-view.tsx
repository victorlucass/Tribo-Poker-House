'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Hourglass, ThumbsDown } from 'lucide-react';

interface SpectatorViewProps {
  currentUserStatus: 'pending' | 'approved' | 'declined' | 'player' | 'spectator';
}

const SpectatorView: React.FC<SpectatorViewProps> = ({ currentUserStatus }) => {
  if (currentUserStatus === 'pending') {
    return (
      <Alert className="mb-8 border-amber-500 text-amber-500">
        <Hourglass className="h-4 w-4 !text-amber-500" />
        <AlertTitle>Aguardando Aprovação</AlertTitle>
        <AlertDescription>Sua solicitação para entrar na mesa está pendente. O administrador precisa aprová-la.</AlertDescription>
      </Alert>
    );
  }

  if (currentUserStatus === 'declined') {
    return (
      <Alert variant="destructive" className="mb-8">
        <ThumbsDown className="h-4 w-4" />
        <AlertTitle>Solicitação Recusada</AlertTitle>
        <AlertDescription>Sua solicitação para entrar na mesa foi recusada pelo administrador. Entre em contato com ele para mais informações.</AlertDescription>
      </Alert>
    );
  }

  return null;
};

export default SpectatorView;
