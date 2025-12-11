'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-4xl font-bold text-destructive">404</CardTitle>
          <CardDescription className="text-xl">Página Não Encontrada</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-muted-foreground">
            A página que você está tentando acessar não existe ou foi movida.
          </p>
          <Button asChild>
            <Link href="/">Voltar para a Página Inicial</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
