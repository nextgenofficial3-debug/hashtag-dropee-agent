import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Search, MapPin, Phone, Mail, Trash2, Edit2, X, Save, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  contact_person: string | null;
  notes: string | null;
  total_orders: number;
}

export default function VendorsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", contact_person: "", notes: "" });
  const [loading, setLoading] = useState(true);

  const fetchVendors = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("vendors")
      .select("*")
      .eq("agent_user_id", user.id)
      .order("created_at", { ascending: false });
    setVendors((data as Vendor[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchVendors(); }, [user]);

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    const payload = {
      agent_user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      contact_person: form.contact_person.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editId) {
      const { error } = await supabase.from("vendors").update(payload).eq("id", editId);
      if (error) { toast({ title: "Update failed", variant: "destructive" }); return; }
      toast({ title: "Vendor updated ✓" });
    } else {
      const { error } = await supabase.from("vendors").insert(payload);
      if (error) { toast({ title: "Failed to add", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Vendor added ✓" });
    }
    resetForm();
    fetchVendors();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("vendors").delete().eq("id", id);
    toast({ title: "Vendor removed" });
    fetchVendors();
  };

  const startEdit = (v: Vendor) => {
    setEditId(v.id);
    setForm({ name: v.name, phone: v.phone || "", email: v.email || "", address: v.address || "", contact_person: v.contact_person || "", notes: v.notes || "" });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", phone: "", email: "", address: "", contact_person: "", notes: "" });
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search) ||
    v.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 py-4 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground flex-1">Vendors</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="p-2 rounded-xl bg-primary/15 text-primary">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..."
          className="w-full bg-secondary rounded-xl pl-9 pr-3 py-3 text-sm text-foreground outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground" />
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">{editId ? "Edit" : "New"} Vendor</p>
            <button onClick={resetForm}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          {[
            { key: "name", placeholder: "Business name *", type: "text" },
            { key: "contact_person", placeholder: "Contact person", type: "text" },
            { key: "phone", placeholder: "Phone", type: "tel" },
            { key: "email", placeholder: "Email", type: "email" },
            { key: "address", placeholder: "Address", type: "text" },
            { key: "notes", placeholder: "Notes", type: "text" },
          ].map(f => (
            <input key={f.key} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder} type={f.type}
              className="w-full bg-secondary rounded-xl px-3 py-3 text-sm text-foreground outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground" />
          ))}
          <button onClick={handleSave} disabled={!form.name.trim()}
            className={cn("w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2",
              form.name.trim() ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
            <Save className="w-4 h-4" /> {editId ? "Update" : "Save"}
          </button>
        </motion.div>
      )}

      <div className="space-y-2">
        {filtered.map(v => (
          <div key={v.id} className="glass rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-bold text-foreground">{v.name}</p>
                  {v.contact_person && <p className="text-[10px] text-muted-foreground">{v.contact_person}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(v)} className="p-1.5 rounded-lg bg-secondary"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </div>
            </div>
            {v.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{v.phone}</p>}
            {v.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{v.email}</p>}
            {v.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{v.address}</p>}
            {v.notes && <p className="text-[10px] text-muted-foreground italic">{v.notes}</p>}
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">No vendors yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
