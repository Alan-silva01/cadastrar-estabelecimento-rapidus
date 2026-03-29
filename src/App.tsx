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
  email: string;
  telefone: string;
  endereco: string;
  descricao: string;
  latitude: string;
  longitude: string;
  senha?: string;
  externalId?: string;
}

const WEBHOOK_URL = "https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/cadastrar_clientes";
const AUTH_TOKEN = "jhegfiegwiufhniejnfiuewnbfiuvenwiufniwunfejwnfiuwhe";

export default function App() {
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    descricao: '',
    latitude: '',
    longitude: '',
    senha: '',
    externalId: '',
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

  const formatPhoneMask = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = formatPhoneMask(e.target.value);
    setFormData({ ...formData, telefone: masked });
  };


  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nome = e.target.value;
    const firstWord = nome.split(' ')[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
    
    setFormData(prev => {
      // Keep existing numbers or generate new 5-digit random number
      const existingNumbers = prev.externalId?.match(/\d+$/)?.[0] || Math.floor(10000 + Math.random() * 90000).toString();
      return {
        ...prev,
        nome,
        externalId: firstWord ? `${firstWord}${existingNumbers}` : ''
      };
    });
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

    const payload = {
      numero: numero,
      dados: {
        nome: formData.nome,
        email: formData.email,
        endereco: formData.endereco,
        latitude: formData.latitude,
        longitude: formData.longitude,
        telefone: formData.telefone,
        descricao: formData.descricao,
        senha: formData.senha,
        externalId: formData.externalId,
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

      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error(responseText || `Erro no servidor: ${response.status}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = responseText;
      }
      
      const isSuccess = 
        result === true || 
        result?.resposta === true || 
        result?.success === true || 
        (typeof result === 'string' && result.toLowerCase() === 'true');

      if (isSuccess) {
        toast.success("Estabelecimento cadastrado com sucesso!");
        setFormData({
          nome: '',
          email: '',
          telefone: '',
          endereco: '',
          descricao: '',
          latitude: formData.latitude,
          longitude: formData.longitude,
          senha: '',
          externalId: '',
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
          <img src="/logo.jpg" alt="Rapidus Express" className="w-24 h-24 rounded-full object-cover mb-2 shadow-md" />
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
                  placeholder="Açaitropical"
                  value={formData.nome}
                  onChange={handleNameChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email"
                  required
                  type="email"
                  placeholder="contato@estabelecimento.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha de Acesso</Label>
                <Input 
                  id="senha"
                  required
                  type="text"
                  placeholder="123456"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp / Telefone</Label>
                <Input 
                  id="telefone"
                  required
                  type="tel"
                  placeholder="(99) 99137-2552"
                  value={formData.telefone}
                  onChange={handlePhoneChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Categoria / Tipo</Label>
                <Input 
                  id="descricao"
                  required
                  placeholder="Açaiteria, Pizzaria, Açougue"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Textarea 
                  id="endereco"
                  required
                  placeholder="Rua, Nº, Bairro, Cidade-UF"
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

        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Rapidus &copy; 2026
          </p>
          <p className="text-xs text-muted-foreground/60">
            Powered by <span className="font-semibold">Intelflux</span>
          </p>
        </div>
      </div>
    </div>
  );
}
