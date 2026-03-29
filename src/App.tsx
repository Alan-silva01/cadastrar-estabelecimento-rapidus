/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Store, 
  Loader2,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

interface FormData {
  nome: string;
  telefone: string;
  endereco: string;
  descricao: string;
  latitude: string;
  longitude: string;
}

const WEBHOOK_URL = "https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/cadastrar_clientes";
const AUTH_TOKEN = "Oenru4qmHnqk8QqKLy4G60U545P3Kpg3LX34lWpV5KZC009t8LsECVMl8wZt";

export default function App() {
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    telefone: '',
    endereco: '',
    descricao: '',
    latitude: '',
    longitude: '',
  });

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    handleGetLocation();
  }, []);

  const handleGetLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada pelo seu navegador.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
        }));
        setLocating(false);
        toast.success("Localização capturada com sucesso!");
      },
      (error) => {
        console.error('Error getting location:', error);
        toast.error("Não foi possível obter sua localização. Verifique as permissões.");
        setLocating(false);
      }
    );
  };

  const formatNumero = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return `55${digits}@s.whatsapp.net`;
  };

  const formatEmail = (nome: string) => {
    const cleanName = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
    return `${cleanName}@gmail.com`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.latitude || !formData.longitude) {
      toast.error("Por favor, capture a localização antes de enviar.");
      setLoading(false);
      return;
    }

    const numero = formatNumero(formData.telefone);
    const email = formatEmail(formData.nome);

    const payload = {
      numero: numero,
      dados: {
        nome: formData.nome,
        email: email,
        endereco: formData.endereco,
        latitude: formData.latitude,
        longitude: formData.longitude,
        telefone: formData.telefone,
        descricao: formData.descricao,
      },
      created_at: new Date().toISOString(),
      entregas: null
    };

    try {
      // 1. Save to Supabase
      const { error: supabaseError } = await supabase
        .from('clientes')
        .upsert([payload], { onConflict: 'numero' });

      if (supabaseError) {
        console.warn('Supabase backup error:', supabaseError);
      }

      // 2. Send to Webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': AUTH_TOKEN
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      const isSuccess = result === true || result?.resposta === true || result?.success === true;

      if (isSuccess) {
        toast.success("Estabelecimento cadastrado com sucesso!");
        setFormData({
          nome: '',
          telefone: '',
          endereco: '',
          descricao: '',
          latitude: formData.latitude,
          longitude: formData.longitude,
        });
      } else {
        throw new Error("O servidor recusou o cadastro.");
      }

    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error(error.message || 'Erro ao processar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      <Toaster position="top-center" richColors />
      
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="p-3 bg-primary/10 rounded-full mb-2">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Rapidus</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de Estabelecimento Parceiro
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Novo Cadastro</CardTitle>
            <CardDescription>
              Preencha os dados do estabelecimento abaixo.
            </CardDescription>
          </CardHeader>
          
          <form id="establishment-form" onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Ponto</Label>
                <Input 
                  id="nome"
                  required
                  placeholder="Ex: Açaitropical"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp / Telefone</Label>
                <Input 
                  id="telefone"
                  required
                  type="tel"
                  placeholder="Ex: 99 99137-2552"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Apenas números. Ex: 99991372552
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Categoria / Tipo</Label>
                <Input 
                  id="descricao"
                  required
                  placeholder="Ex: Açaiteria, Pizzaria, Açougue"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Textarea 
                  id="endereco"
                  required
                  placeholder="Rua, Número, Bairro, Cidade-UF, CEP"
                  className="resize-none"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Localização (GPS)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    readOnly 
                    value={formData.latitude && formData.longitude ? `${formData.latitude}, ${formData.longitude}` : ''} 
                    placeholder="Aguardando localização..." 
                    className="bg-muted font-mono text-xs" 
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={handleGetLocation} 
                    disabled={locating}
                    title="Atualizar Localização"
                  >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

            </CardContent>
            
            <CardFooter>
              <Button 
                type="submit"
                disabled={loading || locating}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar Estabelecimento
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Rapidus &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
}
