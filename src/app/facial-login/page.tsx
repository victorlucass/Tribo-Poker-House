'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as faceapi from 'face-api.js';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Video, VideoOff } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function FacialLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<'no-face' | 'face-detected' | 'multiple-faces'>('no-face');
  const [isProcessing, setIsProcessing] = useState(false);

  // Carrega os modelos da face-api.js
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelsLoading(false);
      } catch (error) {
        console.error("Erro ao carregar os modelos da IA:", error);
        toast({
          variant: 'destructive',
          title: 'Erro Crítico',
          description: 'Não foi possível carregar os modelos de reconhecimento facial. Tente recarregar a página.',
        });
      }
    };
    loadModels();
  }, [toast]);

  // Inicia a câmera
  useEffect(() => {
    const startVideo = async () => {
      if (isModelsLoading || hasCameraPermission === true) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (err) {
        console.error("Erro ao acessar a câmera:", err);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Câmera não autorizada',
          description: 'Por favor, autorize o acesso à câmera nas configurações do seu navegador para usar esta função.',
        });
      }
    };
    startVideo();
  }, [isModelsLoading, toast, hasCameraPermission]);

  // Realiza a detecção facial
  useEffect(() => {
    if(isModelsLoading || hasCameraPermission !== true || !videoRef.current) return;

    const interval = setInterval(async () => {
        if (videoRef.current && canvasRef.current) {
            const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

            const canvas = canvasRef.current;
            const video = videoRef.current;
            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                //faceapi.draw.drawDetections(canvas, resizedDetections);
            }

            if (detections.length === 1) {
                setDetectionStatus('face-detected');
            } else if (detections.length > 1) {
                setDetectionStatus('multiple-faces');
            } else {
                setDetectionStatus('no-face');
            }
        }
    }, 500);

    return () => clearInterval(interval);
  }, [isModelsLoading, hasCameraPermission]);
  
  const getDetectionMessage = () => {
    switch (detectionStatus) {
      case 'face-detected':
        return { message: 'Rosto detectado. Pronto para escanear.', color: 'text-green-400' };
      case 'multiple-faces':
        return { message: 'Múltiplos rostos detectados. Apenas uma pessoa por vez.', color: 'text-yellow-400' };
      case 'no-face':
      default:
        return { message: 'Posicione seu rosto na câmera.', color: 'text-muted-foreground' };
    }
  };

  const { message, color } = getDetectionMessage();


  const handleRegister = async () => {
    // Lógica para registrar será implementada aqui
    toast({ title: 'Em breve!', description: 'A funcionalidade de cadastro facial será implementada em breve.'});
  };

  const handleLogin = async () => {
    // Lógica para login será implementada aqui
    toast({ title: 'Em breve!', description: 'A funcionalidade de login facial será implementada em breve.'});
  };

  const isLoading = isModelsLoading || isProcessing;


  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
       <div className="absolute top-8 left-8">
        <Button asChild variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
        </Button>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login Facial</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando modelos de IA...' : 'Centralize seu rosto para cadastrar ou fazer login.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="relative w-full aspect-video rounded-md overflow-hidden border">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive text-destructive-foreground p-4 text-center">
                   <VideoOff className="h-10 w-10 mb-4"/>
                   <p className="font-bold">Acesso à câmera negado</p>
                   <p className="text-sm">Por favor, habilite a permissão nas configurações do seu navegador.</p>
                </div>
            )}
             <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cn('h-full w-full object-cover', isLoading && 'invisible')}
              />
              <canvas ref={canvasRef} className="absolute top-0 left-0" />
          </div>
          <p className={cn('text-sm h-5 transition-colors', color)}>
            {message}
          </p>
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-4">
          <Button variant="outline" onClick={handleRegister} disabled={isLoading || detectionStatus !== 'face-detected'}>
            Cadastrar Rosto
          </Button>
          <Button onClick={handleLogin} disabled={isLoading || detectionStatus !== 'face-detected'}>
            Login com Rosto
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}