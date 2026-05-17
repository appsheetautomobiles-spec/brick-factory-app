'use client';
import { useRef, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Category { id: string; name: string }
interface Subcategory { id: string; category_id: string; name: string }

interface Props {
  onExpenseAdded: () => void;
  onCancel?: () => void;
}

type PaymentStatus = 'unpaid' | 'partial' | 'paid';

const SEL = "w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 text-sm font-medium appearance-none pr-8";

export default function ExpenseForm({ onExpenseAdded, onCancel }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [formData, setFormData] = useState({ amount: '', description: '', expense_date: localToday() });
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [paidAmount, setPaidAmount] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      const cats = data || [];
      setCategories(cats);
      if (cats.length) setCategoryId(cats[0].id);
    });
  }, []);

  useEffect(() => {
    if (!categoryId) { setSubcategories([]); setSubcategoryId(''); return; }
    supabase.from('subcategories').select('*').eq('category_id', categoryId).order('name').then(({ data }) => {
      const subs = data || [];
      setSubcategories(subs);
      setSubcategoryId(subs[0]?.id || '');
    });
  }, [categoryId]);

  const handlePaymentStatusChange = (status: PaymentStatus) => {
    setPaymentStatus(status);
    if (status === 'paid') setPaidAmount(formData.amount);
    else if (status === 'unpaid') setPaidAmount('');
  };

  const handleAmountChange = (val: string) => {
    setFormData({ ...formData, amount: val });
    if (paymentStatus === 'paid') setPaidAmount(val);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', imageFile);
      fd.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
      fd.append('folder', 'ittige-factory');
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: fd }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Upload failed');
      return json.secure_url as string;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Image upload failed. Expense will be saved without image.');
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!categoryId) { alert('Please select a category'); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const totalAmount = parseFloat(formData.amount);
      const paid_amount_value = paymentStatus === 'paid'
        ? totalAmount
        : paymentStatus === 'partial'
          ? Math.min(parseFloat(paidAmount) || 0, totalAmount)
          : 0;

      const image_url = await uploadImage();

      const { data: newExpense, error } = await supabase.from('expenses').insert([{
        user_id: user.id,
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        amount: totalAmount,
        paid_amount: paid_amount_value,
        description: formData.description,
        expense_date: formData.expense_date,
        ...(image_url ? { image_url } : {}),
      }]).select().single();

      if (error) throw error;

      if (paid_amount_value > 0 && newExpense) {
        await supabase.from('payments').insert({
          expense_id: newExpense.id,
          user_id: user.id,
          amount: paid_amount_value,
          payment_date: formData.expense_date,
          note: 'Initial payment',
        });
      }

      setFormData({ amount: '', description: '', expense_date: localToday() });
      setPaymentStatus('unpaid');
      setPaidAmount('');
      removeImage();
      onExpenseAdded();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error adding expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">Add Expense</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Category + Subcategory */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Category</label>
            <div className="relative">
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={SEL}>
                {categories.length === 0 && <option value="">No categories</option>}
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Subcategory</label>
            <div className="relative">
              <select
                value={subcategoryId}
                onChange={e => setSubcategoryId(e.target.value)}
                disabled={subcategories.length === 0}
                className={`${SEL} disabled:opacity-50`}
              >
                {subcategories.length === 0 && <option value="">None</option>}
                {subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </div>

        {categories.length === 0 && (
          <p className="text-xs text-orange-500 font-medium">
            No categories found. <a href="/dashboard/categories" className="underline font-semibold">Add categories first →</a>
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Amount (₹)</label>
          <input
            type="number" step="0.01" inputMode="decimal"
            value={formData.amount}
            onChange={e => handleAmountChange(e.target.value)}
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 text-lg font-semibold placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="0" required
          />
        </div>

        {/* Payment Status */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Payment Status</label>
          <div className="grid grid-cols-3 gap-2">
            {(['unpaid', 'partial', 'paid'] as PaymentStatus[]).map(status => (
              <button
                key={status}
                type="button"
                onClick={() => handlePaymentStatusChange(status)}
                className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  paymentStatus === status
                    ? status === 'paid'
                      ? 'bg-green-500 text-white shadow-sm'
                      : status === 'partial'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-red-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {status === 'unpaid' ? 'Unpaid' : status === 'partial' ? 'Partial' : 'Paid'}
              </button>
            ))}
          </div>
        </div>

        {paymentStatus === 'partial' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Amount Paid (₹)</label>
            <input
              type="number" step="0.01" inputMode="decimal"
              value={paidAmount}
              onChange={e => setPaidAmount(e.target.value)}
              className="w-full px-4 py-3.5 border border-amber-300 dark:border-amber-700 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-lg font-semibold placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="0" required
            />
            {formData.amount && paidAmount && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                ₹{Math.max(0, parseFloat(formData.amount) - parseFloat(paidAmount)).toFixed(0)} remaining
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Optional note"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Date</label>
          <div className="overflow-hidden rounded-xl">
            <input
              type="date"
              value={formData.expense_date}
              onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
              className="w-full min-w-0 px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700"
            />
          </div>
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Receipt / Photo (optional)</label>
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-gray-200 dark:border-gray-600" />
              <button type="button" onClick={removeImage} className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow">×</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-gray-400 dark:text-gray-500 text-sm font-medium hover:border-orange-500 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Attach photo
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>

        <div className="flex gap-3 pt-1">
          {onCancel && (
            <button type="button" onClick={onCancel} className="flex-1 py-4 rounded-xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || imageUploading || !categoryId}
            className="flex-1 bg-orange-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {imageUploading ? 'Uploading...' : loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
