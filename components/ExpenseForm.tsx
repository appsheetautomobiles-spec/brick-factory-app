'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['raw_materials', 'labor', 'utilities', 'maintenance', 'transport', 'other'];

const CATEGORY_LABELS: Record<string, string> = {
  raw_materials: 'Raw Materials',
  labor: 'Labor',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  transport: 'Transport',
  other: 'Other',
};

interface Props {
  onExpenseAdded: () => void;
  onCancel?: () => void;
}

export default function ExpenseForm({ onExpenseAdded, onCancel }: Props) {
  const [formData, setFormData] = useState({
    category: 'raw_materials',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
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
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      return url as string;
    } catch {
      alert('Image upload failed. Expense will be saved without image.');
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const image_url = await uploadImage();

      const { error } = await supabase.from('expenses').insert([{
        user_id: user.id,
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
        expense_date: formData.expense_date,
        ...(image_url ? { image_url } : {}),
      }]);

      if (error) throw error;
      setFormData({ category: 'raw_materials', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] });
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
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFormData({ ...formData, category: cat })}
                className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                  formData.category === cat
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 text-lg font-semibold placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="0"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Description</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Optional note"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Date</label>
          <input
            type="date"
            value={formData.expense_date}
            onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
            className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-gray-100 focus:outline-none focus:border-orange-500 bg-gray-50 dark:bg-gray-700"
          />
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Receipt / Photo (optional)</label>
          {imagePreview ? (
            <div className="relative">
              <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-gray-200 dark:border-gray-600" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow"
              >
                ×
              </button>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        <div className="flex gap-3 pt-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 rounded-xl font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 active:scale-95 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading || imageUploading}
            className="flex-1 bg-orange-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-orange-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {imageUploading ? 'Uploading...' : loading ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
