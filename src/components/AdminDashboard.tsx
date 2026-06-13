import React, { useState, useEffect } from "react";
import { Trash2, Trash, RefreshCw, AlertCircle, Shield, Globe } from "lucide-react";
import { Subdomain } from "../types";

export default function AdminDashboard() {
  const [subdomains, setSubdomains] = useState<Subdomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubdomains();
  }, []);

  const fetchSubdomains = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/subdomains");
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSubdomains(data.subdomains || []);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data subdomain.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (subdomain: string, domain?: string) => {
    if (!window.confirm(`Yakin ingin menghapus ${subdomain}.${domain || "cmnty.qzz.io"} secara permanen? DNS record juga akan dihapus.`)) return;

    setDeletingId(subdomain);
    try {
      const targetDomain = domain || "cmnty.qzz.io";
      const res = await fetch(`/api/admin/subdomains/${encodeURIComponent(subdomain)}?domain=${encodeURIComponent(targetDomain)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      // Update local state
      setSubdomains(subdomains.filter(s => s.subdomain !== subdomain || (s.domain || "cmnty.qzz.io") !== targetDomain));
      alert("Subdomain dan record Cloudflare berhasil dihapus.");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-yellow-400 flex items-center justify-center font-sans p-6 text-black">
        <RefreshCw className="h-8 w-8 animate-spin stroke-[3]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-400 text-black font-sans p-6 lg:p-12 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-[4px] border-black pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-10 w-10 stroke-[3]" />
              <h1 className="text-4xl font-black uppercase">Admin Panel</h1>
            </div>
            <p className="text-lg font-bold">Kelola dan hapus subdomain yang didaftarkan pengguna.</p>
          </div>
          <button 
            onClick={fetchSubdomains}
            className="flex items-center gap-2 bg-white border-[3px] border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:shadow-none active:translate-y-[4px] px-4 py-2 font-black uppercase transition-all"
          >
            <RefreshCw className="h-5 w-5 stroke-[3]" /> Segarkan Data
          </button>
        </div>

        {error && (
          <div className="bg-red-400 border-[4px] border-black p-4 shadow-[4px_4px_0_0_#000] font-black flex items-center gap-2">
            <AlertCircle className="h-6 w-6 stroke-[3]" />
            {error}
          </div>
        )}

        <div className="bg-white border-[4px] border-black shadow-[8px_8px_0_0_#000] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-cyan-300 border-b-[4px] border-black">
                  <th className="p-4 border-r-[3px] border-black font-black uppercase tracking-wider text-sm">Target Domain</th>
                  <th className="p-4 border-r-[3px] border-black font-black uppercase tracking-wider text-sm">Subdomain</th>
                  <th className="p-4 border-r-[3px] border-black font-black uppercase tracking-wider text-sm">Client Info</th>
                  <th className="p-4 border-r-[3px] border-black font-black uppercase tracking-wider text-sm">Created At</th>
                  <th className="p-4 font-black uppercase tracking-wider text-sm text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {subdomains.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-bold text-gray-500">
                      Tidak ada subdomain terdaftar.
                    </td>
                  </tr>
                ) : (
                  subdomains.map((s, idx) => {
                    const fullDomain = `${s.subdomain}.${s.domain || "cmnty.qzz.io"}`;
                    return (
                      <tr key={idx} className="border-b-[3px] border-black hover:bg-yellow-100 transition-colors">
                        <td className="p-4 border-r-[3px] border-black font-black uppercase text-sm">{s.domain || "cmnty.qzz.io"}</td>
                        <td className="p-4 border-r-[3px] border-black">
                          <div className="font-black text-lg">{s.subdomain}</div>
                          <div className="bg-emerald-300 bg-opacity-30 border-2 border-black inline-block px-1 mt-1 text-[10px] font-mono leading-none py-0.5">{s.token}</div>
                        </td>
                        <td className="p-4 border-r-[3px] border-black font-bold text-xs space-y-1">
                          <div className="bg-gray-100 border-2 border-black p-1 inline-block">IP: {s.ip || "Unknown"}</div>
                          {s.email && <div className="text-gray-600 block mt-1 truncate max-w-xs">{s.email}</div>}
                          {s.description && <div className="text-gray-500 italic truncate max-w-xs block mt-0.5">{s.description}</div>}
                        </td>
                        <td className="p-4 border-r-[3px] border-black font-bold text-xs whitespace-nowrap">
                          {new Date(s.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDelete(s.subdomain, s.domain)}
                            disabled={deletingId === s.subdomain}
                            className="bg-red-400 hover:bg-red-500 w-full text-black border-2 border-black shadow-[3px_3px_0_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none p-2 font-black uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                          >
                            {deletingId === s.subdomain ? (
                              <RefreshCw className="h-4 w-4 animate-spin stroke-[3]" />
                            ) : (
                              <Trash2 className="h-4 w-4 stroke-[3]" />
                            )}
                            Hapus
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
