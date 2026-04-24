import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Search, MapPin, Phone, Mail, Trash2, Edit2, X, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  plus_code: string | null;
  notes: string | null;
  total_orders: number;
  isOrderDerived?: boolean;
}

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "", plus_code: "" };

export default function CustomersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCustomers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [{ data: customerRows, error: customerError }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .eq("agent_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("customer_name, customer_phone, customer_address, plus_code")
          .eq("agent_user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (customerError) throw customerError;
      if (orderError) throw orderError;

      const map = new Map<string, Customer>();

      for (const customer of (customerRows as Customer[]) || []) {
        map.set(customer.phone || customer.id, customer);
      }

      for (const order of orderRows || []) {
        const key = order.customer_phone || `${order.customer_name}:${order.customer_address}`;
        const existing = map.get(key);
        if (existing) {
          existing.total_orders = Math.max(existing.total_orders || 0, 1);
          continue;
        }

        map.set(key, {
          id: `order:${key}`,
          name: order.customer_name,
          phone: order.customer_phone,
          email: null,
          address: order.customer_address,
          latitude: null,
          longitude: null,
          plus_code: order.plus_code,
          notes: null,
          total_orders: 1,
          isOrderDerived: true,
        });
      }

      setCustomers(Array.from(map.values()));
    } catch (error: any) {
      toast({ title: "Failed to load customers", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [user]);

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);

    const payload = {
      agent_user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      plus_code: form.plus_code.trim() || null,
    };

    const request = editId
      ? supabase.from("customers").update(payload).eq("id", editId)
      : supabase.from("customers").insert(payload);

    const { error } = await request;
    setSaving(false);

    if (error) {
      toast({ title: editId ? "Update failed" : "Failed to add", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editId ? "Customer updated" : "Customer added" });
    resetForm();
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("order:")) {
      toast({
        title: "Cannot delete order-derived customer",
        description: "This customer is visible because they have an assigned order.",
      });
      return;
    }

    setDeletingId(id);
    const { error } = await supabase.from("customers").delete().eq("id", id);
    setDeletingId(null);

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Customer removed" });
    fetchCustomers();
  };

  const startEdit = (c: Customer) => {
    setEditId(c.isOrderDerived ? null : c.id);
    setForm({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      notes: c.notes || "",
      plus_code: c.plus_code || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 py-4 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground flex-1">Customers</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="p-2 rounded-xl bg-primary/15 text-primary">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
          className="w-full bg-secondary rounded-xl pl-9 pr-3 py-3 text-sm text-foreground outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground" />
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">{editId ? "Edit" : "New"} Customer</p>
            <button onClick={resetForm}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          {[
            { key: "name", placeholder: "Name *", type: "text" },
            { key: "phone", placeholder: "Phone", type: "tel" },
            { key: "email", placeholder: "Email", type: "email" },
            { key: "address", placeholder: "Address", type: "text" },
            { key: "plus_code", placeholder: "Google Plus Code", type: "text" },
            { key: "notes", placeholder: "Notes", type: "text" },
          ].map(f => (
            <input key={f.key} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder} type={f.type}
              className="w-full bg-secondary rounded-xl px-3 py-3 text-sm text-foreground outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground" />
          ))}
          <button onClick={handleSave} disabled={!form.name.trim() || saving}
            className={cn("w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2",
              form.name.trim() && !saving ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            <Save className="w-4 h-4" /> {saving ? "Saving..." : editId ? "Update" : "Save"}
          </button>
        </motion.div>
      )}

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} className="glass rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{c.name}</p>
                {c.total_orders > 0 && <span className="text-[10px] text-primary font-medium">{c.total_orders} orders</span>}
                {c.isOrderDerived && <span className="ml-2 text-[10px] text-muted-foreground">from orders</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg bg-secondary"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="p-1.5 rounded-lg bg-destructive/10 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </div>
            </div>
            {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</p>}
            {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</p>}
            {c.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{c.address}</p>}
            {c.plus_code && <p className="text-[10px] text-primary/70 font-mono">Plus Code: {c.plus_code}</p>}
            {c.notes && <p className="text-[10px] text-muted-foreground italic">{c.notes}</p>}
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No customers yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
