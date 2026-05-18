import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Clock, AlertCircle, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { CardSkeleton } from '../../components/ui/LoadingSkeleton';
import type { KYC } from '../../types';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_RE = /^\d{12}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const STATUS_CONFIG: Record<string, { icon: typeof ShieldCheck; bg: string; text: string; label: string }> = {
  verified: { icon: ShieldCheck, bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'KYC Verified' },
  pending: { icon: Clock, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Verification Pending' },
  rejected: { icon: ShieldAlert, bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'KYC Rejected' },
};

interface FormData {
  pan_number: string;
  aadhaar_number: string;
  bank_account_number: string;
  ifsc_code: string;
  gst_number: string;
}

const EMPTY_FORM: FormData = { pan_number: '', aadhaar_number: '', bank_account_number: '', ifsc_code: '', gst_number: '' };

export function KYCPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [kyc, setKyc] = useState<KYC | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  const fetchKyc = useCallback(async () => {
    const { data } = await supabase
      .from('kyc')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) {
      setKyc(data);
      setForm({
        pan_number: data.pan_number || '',
        aadhaar_number: data.aadhar_no || '',
        bank_account_number: data.bank_acc_no || '',
        ifsc_code: data.ifsc || '',
        gst_number: data.gst_number || '',
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchKyc(); }, [fetchKyc]);

  const validate = (): boolean => {
    const e: Partial<FormData> = {};
    if (!PAN_RE.test(form.pan_number.toUpperCase())) e.pan_number = 'Invalid PAN (e.g. ABCDE1234F)';
    if (!AADHAAR_RE.test(form.aadhaar_number)) e.aadhaar_number = 'Must be 12 digits';
    if (!form.bank_account_number.trim()) e.bank_account_number = 'Required';
    if (!IFSC_RE.test(form.ifsc_code.toUpperCase())) e.ifsc_code = 'Invalid IFSC (e.g. SBIN0001234)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      user_id: user!.id,
      pan_number: form.pan_number.toUpperCase(),
      aadhar_no: form.aadhaar_number,
      bank_acc_no: form.bank_account_number.trim(),
      ifsc: form.ifsc_code.toUpperCase(),
      gst_number: form.gst_number.trim() || null,
      status: 'pending' as const,
    };
    const { error } = await supabase.from('kyc').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast(error.message || 'Failed to submit KYC. Please try again.', 'error');
    } else {
      toast('KYC submitted successfully', 'success');
      await fetchKyc();
    }
    setSubmitting(false);
  };

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const isReadOnly = kyc?.status === 'verified' || kyc?.status === 'pending';

  if (loading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;

  const status = kyc?.status as string | undefined;
  const cfg = status ? STATUS_CONFIG[status] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">KYC Verification</h1>

      {cfg && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.bg}`}>
          <cfg.icon className={`w-6 h-6 ${cfg.text}`} />
          <div>
            <p className={`font-semibold ${cfg.text}`}>{cfg.label}</p>
            <p className="text-sm text-gray-600">
              {status === 'verified' && 'Your identity has been verified. No changes needed.'}
              {status === 'pending' && 'Your documents are under review. This usually takes 1-2 business days.'}
              {status === 'rejected' && 'Please correct the details below and re-submit.'}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <Field label="PAN Number" value={form.pan_number} error={errors.pan_number} readOnly={isReadOnly}
          placeholder="ABCDE1234F" maxLength={10}
          onChange={(v) => update('pan_number', v.toUpperCase())} />

        <Field label="Aadhaar Number" value={form.aadhaar_number} error={errors.aadhaar_number} readOnly={isReadOnly}
          placeholder="123456789012" maxLength={12}
          onChange={(v) => update('aadhaar_number', v.replace(/\D/g, ''))} />

        <Field label="Bank Account Number" value={form.bank_account_number} error={errors.bank_account_number} readOnly={isReadOnly}
          placeholder="Enter account number"
          onChange={(v) => update('bank_account_number', v)} />

        <Field label="IFSC Code" value={form.ifsc_code} error={errors.ifsc_code} readOnly={isReadOnly}
          placeholder="SBIN0001234" maxLength={11}
          onChange={(v) => update('ifsc_code', v.toUpperCase())} />

        <Field label="GST Number" value={form.gst_number} error={errors.gst_number} readOnly={isReadOnly}
          placeholder="Optional" optional
          onChange={(v) => update('gst_number', v.toUpperCase())} />

        {!isReadOnly && (
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : kyc?.status === 'rejected' ? 'Re-submit KYC' : 'Submit KYC'}
          </button>
        )}
      </form>
    </div>
  );
}

function Field({
  label, value, error, readOnly, placeholder, maxLength, optional, onChange,
}: {
  label: string; value: string; error?: string; readOnly?: boolean;
  placeholder?: string; maxLength?: number; optional?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy-900 mb-1">
        {label} {optional && <span className="text-gray-400 font-normal">(optional)</span>}
      </label>
      {readOnly ? (
        <p className="px-3 py-2 bg-gray-50 rounded-lg text-navy-900 text-sm">{value || '--'}</p>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${
            error ? 'border-red-300 bg-red-50' : 'border-gray-200'
          }`}
        />
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
