'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function UserRow({ user, currentUserId }: { user: UserProfile; currentUserId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isSuperAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  const handleRoleChange = async (newRole: 'admin' | 'player') => {
    if (!firestore) return;
    const userDocRef = doc(firestore, 'users', user.uid);
    try {
      await updateDoc(userDocRef, { role: newRole });
      toast({ title: 'Sucesso', description: `O papel de ${user.nickname} foi atualizado.` });
    } catch (error) {
      console.error('Failed to update role', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar o papel do usuário.' });
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.nickname}</TableCell>
      <TableCell className="hidden md:table-cell">{user.email}</TableCell>
      <TableCell className="text-right">
        {isSuperAdmin ? (
          <span className="text-xs font-semibold text-accent">SUPER ADMIN</span>
        ) : (
          <Switch
            checked={user.role === 'admin'}
            onCheckedChange={(checked) => handleRoleChange(checked ? 'admin' : 'player')}
            disabled={user.uid === currentUserId}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

export default function AdminPage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const firestore = useFirestore();

  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersCollection);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/');
    }
  }, [isSuperAdmin, authLoading, router]);

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
              <Link href="/">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="font-headline text-3xl font-bold text-accent">Painel de Admin</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield /> Gerenciamento de Usuários
            </CardTitle>
            <CardDescription>
              Promova ou rebaixe usuários para o papel de administrador. Administradores podem gerenciar salas de cash game.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Apelido</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-right">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <>
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  </>
                ) : (
                  users && users.map((u) => (
                    <UserRow key={u.uid} user={u} currentUserId={user!.uid} />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
