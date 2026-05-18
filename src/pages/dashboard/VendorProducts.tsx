import { useState, useEffect, useCallback, type Dispatch, type SetStateAction, type FormEvent } from 'react';
import { Plus, Search, Pencil, Trash2, Power, Package, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { EmptyState } from '../../components/ui/EmptyState';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import type { Product } from '../../types';

const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Health', 'Food', 'Books', 'Other'];
const PER_PAGE = 20;
const emptyForm = { name: '', description: '', price: '', mrp: '', stock: '', category: 'Electronics' };

type ProductFormState = typeof emptyForm;

function VendorProductField({
  label,
  name,
  type = 'text',
  el,
  form,
  setForm,
  errors,
}: {
  label: string;
  name: keyof ProductFormState;
  type?: string;
  el?: 'textarea' | 'select';
  form: ProductFormState;
  setForm: Dispatch<SetStateAction<ProductFormState>>;
  errors: Record<string, string>;
}) {
  const value = form[name];
  return (
    <div>
      <label className="block text-sm font-medium text-navy-700 mb-1">{label}</label>
      {el === 'textarea' ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => setForm((prev) => ({ ...prev, [name]: e.target.value }))}
          className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
        />
      ) : el === 'select' ? (
        <select
          value={value}
          onChange={(e) => setForm((prev) => ({ ...prev, [name]: e.target.value }))}
          className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => setForm((prev) => ({ ...prev, [name]: e.target.value }))}
          className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm text-navy-900 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"
        />
      )}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );
}

export function VendorProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalPages = Math.ceil(total / PER_PAGE);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('vendor_id', user.id)
      .order('created_at', { ascending: false });
    if (search.trim()) query = query.ilike('name', `%${search.trim()}%`);
    const from = (page - 1) * PER_PAGE;
    query = query.range(from, from + PER_PAGE - 1);
    const { data, count, error } = await query;
    if (error) toast(error.message, 'error');
    setProducts((data as Product[]) || []);
    setTotal(count || 0);
    setLoading(false);
  }, [user, search, page, toast]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.price || Number(form.price) <= 0) e.price = 'Price must be greater than 0';
    if (!form.mrp || Number(form.mrp) <= 0) e.mrp = 'MRP must be greater than 0';
    if (form.stock === '' || Number(form.stock) < 0) e.stock = 'Stock must be 0 or more';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setErrors({}); setModalOpen(true); };
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), mrp: String(p.mrp), stock: String(p.stock), category: p.category });
    setErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || !user) return;
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      mrp: Number(form.mrp),
      stock: Number(form.stock),
      category: form.category,
      vendor_id: user.id,
    };
    const { error } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert(payload);
    setSubmitting(false);
    if (error) { toast(error.message, 'error'); return; }
    toast(editingId ? 'Product updated' : 'Product added', 'success');
    setModalOpen(false);
    fetchProducts();
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) { toast(error.message, 'error'); return; }
    toast(p.is_active ? 'Product deactivated' : 'Product activated', 'success');
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Product deleted', 'success');
    fetchProducts();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-900">My Products</h1>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
        <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-navy-200 text-sm text-navy-900 placeholder:text-navy-400 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={6} /></div>
        ) : products.length === 0 ? (
          <EmptyState icon={<Package className="w-8 h-8 text-navy-300" />} title="No products yet" description="Add your first product to start selling." action={<button onClick={openAdd} className="text-sm font-medium text-accent-500 hover:text-accent-600">Add Product</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-50 text-left text-navy-600">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">MRP</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy-900 max-w-[200px] truncate">{p.name}</td>
                    <td className="px-4 py-3 text-navy-700">{formatINR(p.price)}</td>
                    <td className="px-4 py-3 text-navy-700">{formatINR(p.mrp)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        {p.stock}
                        {p.stock < 10 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">
                            <AlertTriangle className="w-3 h-3" /> Low
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.is_active ? 'bg-green-50 text-green-600' : 'bg-navy-100 text-navy-500'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} title="Edit" className="p-1.5 rounded-lg hover:bg-navy-100 text-navy-500 hover:text-accent-500 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleActive(p)} title={p.is_active ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg hover:bg-navy-100 text-navy-500 hover:text-accent-500 transition-colors">
                          <Power className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-navy-500 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Product' : 'Add Product'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <VendorProductField label="Product Name" name="name" form={form} setForm={setForm} errors={errors} />
          <VendorProductField label="Description" name="description" el="textarea" form={form} setForm={setForm} errors={errors} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <VendorProductField label="Base Price" name="price" type="number" form={form} setForm={setForm} errors={errors} />
            <VendorProductField label="MRP" name="mrp" type="number" form={form} setForm={setForm} errors={errors} />
            <VendorProductField label="Stock" name="stock" type="number" form={form} setForm={setForm} errors={errors} />
          </div>
          <VendorProductField label="Category" name="category" el="select" form={form} setForm={setForm} errors={errors} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-navy-200 text-sm font-medium text-navy-700 hover:bg-navy-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {submitting ? 'Saving...' : editingId ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
