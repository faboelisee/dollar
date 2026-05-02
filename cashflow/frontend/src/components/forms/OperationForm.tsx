'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operationsApi, cashRegistersApi, contactsApi } from '@/lib/api';
import { PAYMENT_METHOD_LABELS, OPERATION_TYPE_LABELS, formatCurrency } from '@/lib/utils';
import type { OperationType } from '@/types';

const operationSchema = z.object({
  type: z.enum(['encaissement', 'decaissement', 'avance', 'depense', 'recette', 'transfert']),
  cashRegisterId: z.string().uuid('Caisse invalide'),
  amount: z.number({ invalid_type_error: 'Montant requis' }).positive('Montant doit être positif'),
  date: z.string().min(1, 'Date requise'),
  description: z.string().min(3, 'Description requise (min. 3 caractères)'),
  paymentMethod: z.enum(['especes', 'orange_money', 'mtn_momo', 'wave', 'moov_money', 'cheque', 'virement', 'carte']),
  categoryId: z.string().uuid('Catégorie requise'),
  contactId: z.string().uuid().optional().or(z.literal('')),
  reference: z.string().optional(),
  targetCashRegisterId: z.string().uuid().optional(),
});

type OperationFormData = z.infer<typeof operationSchema>;

interface OperationFormProps {
  defaultType?: OperationType;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function OperationForm({ defaultType = 'encaissement', onSuccess, onCancel }: OperationFormProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [attachments, setAttachments] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<OperationFormData>({
    resolver: zodResolver(operationSchema),
    defaultValues: {
      type: defaultType,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'especes',
    },
    mode: 'onChange',
  });

  const operationType = watch('type');
  const amount = watch('amount');
  const isTransfert = operationType === 'transfert';

  const { data: cashRegisters } = useQuery({
    queryKey: ['cash-registers'],
    queryFn: () => cashRegistersApi.list('current').then((r) => r.data),
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list({ limit: 200 }).then((r) => r.data.items),
  });

  const mutation = useMutation({
    mutationFn: async (data: OperationFormData) => {
      const result = await operationsApi.create(data);
      if (attachments.length) {
        await Promise.all(
          attachments.map((f) => operationsApi.uploadAttachment(result.data.id, f))
        );
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      onSuccess?.();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const onSubmit = (data: OperationFormData) => mutation.mutate(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= s ? 'bg-[#1B4F72] text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s}
            </div>
            {s < 3 && <div className={`h-0.5 w-8 ${step > s ? 'bg-[#1B4F72]' : 'bg-gray-200'}`} />}
          </div>
        ))}
        <div className="ml-2 text-sm text-gray-500">
          {step === 1 && 'Informations principales'}
          {step === 2 && 'Détails & Catégorie'}
          {step === 3 && 'Justificatifs & Confirmation'}
        </div>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type d'opération <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['encaissement', 'decaissement', 'depense', 'recette', 'avance', 'transfert'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('type', type)}
                  className={`p-2 text-xs border rounded-lg text-center transition-colors ${
                    operationType === type
                      ? 'border-[#1B4F72] bg-[#1B4F72] text-white'
                      : 'border-gray-300 hover:border-[#2E86AB] text-gray-600'
                  }`}
                >
                  {OPERATION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caisse <span className="text-red-500">*</span>
            </label>
            <select
              {...register('cashRegisterId')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
            >
              <option value="">Sélectionner une caisse</option>
              {cashRegisters?.map((cr: { id: string; name: string; currentBalance: number }) => (
                <option key={cr.id} value={cr.id}>
                  {cr.name} — {formatCurrency(cr.currentBalance)}
                </option>
              ))}
            </select>
            {errors.cashRegisterId && (
              <p className="mt-1 text-xs text-red-500">{errors.cashRegisterId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant ({amount ? formatCurrency(amount) : '0 FCFA'})
              <span className="text-red-500"> *</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-16 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                FCFA
              </span>
            </div>
            {errors.amount && (
              <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mode de paiement <span className="text-red-500">*</span>
              </label>
              <select
                {...register('paymentMethod')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('description')}
              placeholder="Motif de l'opération"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact (client / fournisseur)
            </label>
            <select
              {...register('contactId')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
            >
              <option value="">-- Aucun contact --</option>
              {contacts?.map((c: { id: string; name: string; type: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Référence externe
            </label>
            <input
              type="text"
              {...register('reference')}
              placeholder="N° facture, bon de commande…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
            />
          </div>

          {isTransfert && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caisse destinataire <span className="text-red-500">*</span>
              </label>
              <select
                {...register('targetCashRegisterId')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]"
              >
                <option value="">Sélectionner</option>
                {cashRegisters?.map((cr: { id: string; name: string }) => (
                  <option key={cr.id} value={cr.id}>{cr.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pièces jointes (reçus, factures)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.heic"
              onChange={handleFileChange}
              className="w-full border border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-500 cursor-pointer hover:border-[#2E86AB] transition-colors"
            />
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map((f) => (
                  <li key={f.name} className="text-xs text-gray-500">
                    📎 {f.name} ({(f.size / 1024).toFixed(0)} Ko)
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Summary */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
            <h4 className="font-semibold text-[#1B4F72]">Récapitulatif</h4>
            <div className="flex justify-between">
              <span className="text-gray-600">Type :</span>
              <span className="font-medium">{OPERATION_TYPE_LABELS[operationType]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Montant :</span>
              <span className="font-bold text-[#1B4F72] text-base">
                {amount ? formatCurrency(amount) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date :</span>
              <span className="font-medium">{watch('date')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Mode :</span>
              <span className="font-medium">{PAYMENT_METHOD_LABELS[watch('paymentMethod')]}</span>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <div>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Retour
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Annuler
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="px-6 py-2 text-sm bg-[#1B4F72] text-white rounded-lg hover:bg-[#2E86AB] transition-colors"
            >
              Suivant
            </button>
          ) : (
            <button
              type="submit"
              disabled={mutation.isPending || !isValid}
              className="px-6 py-2 text-sm bg-[#27AE60] text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {mutation.isPending ? 'Enregistrement…' : 'Valider l\'opération'}
            </button>
          )}
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-500 text-center">
          Une erreur est survenue. Veuillez réessayer.
        </p>
      )}
    </form>
  );
}
