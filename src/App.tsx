import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import AdminDashboard from "./components/AdminDashboard";
import {
  Globe,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Cloud,
  Search,
  Lock,
  ArrowRight,
  Shield,
  Clock,
  Activity,
  LogOut,
  ExternalLink,
  ChevronRight,
  Heart,
  Settings,
  Pencil,
  X,
  Zap,
} from "lucide-react";
import { DnsRecord, Subdomain } from "./types";

const ALL_DNS_TYPES = [
  "A",
  "AAAA",
  "CAA",
  "CERT",
  "CNAME",
  "DNSKEY",
  "DS",
  "HTTPS",
  "LOC",
  "MX",
  "NAPTR",
  "NS",
  "PTR",
  "SMIMEA",
  "SPF",
  "SRV",
  "SSHFP",
  "SVCB",
  "TLSA",
  "TXT",
  "URI",
];
const PROXIED_TYPES = ["A", "AAAA", "CNAME"];

export default function App() {
  if (window.location.pathname === "/v1") {
    return <AdminDashboard />;
  }
  const [activeTab, setActiveTab] = useState<"home" | "register" | "manage">(
    "home",
  );

  // Home State
  const [searchSubdomain, setSearchSubdomain] = useState("");
  const [searchResult, setSearchResult] = useState<{
    searched: boolean;
    available: boolean;
    message: string;
  } | null>(null);
  const [searchDualResult, setSearchDualResult] = useState<{
    searched: boolean;
    valid: boolean;
    error?: string;
    subdomain: string;
    results: Array<{
      domainName: string;
      fullName: string;
      available: boolean;
    }>;
  } | null>(null);
  const [stats, setStats] = useState<{
    totalRegistered: number;
    recent: Array<{
      subdomain: string;
      createdAt: string;
      description: string;
      domain: string;
    }>;
  }>({ totalRegistered: 0, recent: [] });

  // Registration State
  const [regSubdomain, setRegSubdomain] = useState("");
  const [regSelectedDomain, setRegSelectedDomain] = useState("cmnty.qzz.io");
  const [regEmail, setRegEmail] = useState("");
  const [regDescription, setRegDescription] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState<{
    subdomain: string;
    domain: string;
    token: string;
  } | null>(null);

  // Client Fingerprinting & Existing Subdomain checks
  const [fingerprint, setFingerprint] = useState("");
  const [existingRegSubdomain, setExistingRegSubdomain] = useState("");

  // Management State
  const [manageSubdomain, setManageSubdomain] = useState("");
  const [manageDomain, setManageDomain] = useState("cmnty.qzz.io");
  const [manageLoginDomain, setManageLoginDomain] = useState("cmnty.qzz.io");
  const [manageToken, setManageToken] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  // Recover Token State
  const [showRecoverForm, setShowRecoverForm] = useState(false);
  const [recoverSubdomain, setRecoverSubdomain] = useState("");
  const [recoverDomain, setRecoverDomain] = useState("cmnty.qzz.io");

  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState("");
  const [recoverSuccessToken, setRecoverSuccessToken] = useState<string | null>(
    null,
  );

  // DNS Records State
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");

  // Cloudflare Interface states
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  // Edit Record Form State
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editRecType, setEditRecType] = useState("A");
  const [editRecName, setEditRecName] = useState("");
  const [editRecContent, setEditRecContent] = useState("");
  const [editRecTtl, setEditRecTtl] = useState(1);
  const [editRecProxied, setEditRecProxied] = useState(false);
  const [editRecPriority, setEditRecPriority] = useState(10);
  const [updatingRecord, setUpdatingRecord] = useState(false);
  const [updateRecordError, setUpdateRecordError] = useState("");

  // Add Record Form State
  const [newRecType, setNewRecType] = useState("A");
  const [newRecName, setNewRecName] = useState("@"); // @ means root subdomain
  const [newRecContent, setNewRecContent] = useState("");
  const [newRecTtl, setNewRecTtl] = useState(1); // 1 = Auto
  const [newRecProxied, setNewRecProxied] = useState(false);
  const [newRecPriority, setNewRecPriority] = useState(10);
  const [addingRecord, setAddingRecord] = useState(false);
  const [addRecordError, setAddRecordError] = useState("");

  // Copy status helper
  const [copyStatus, setCopyStatus] = useState<{ [key: string]: boolean }>({});

  // DNS Propagation check state
  const [dnsStatuses, setDnsStatuses] = useState<{
    [key: string]: {
      loading: boolean;
      resolved: boolean;
      errMsg?: string;
      values?: string[];
    };
  }>({});

  // Loading stats on mount
  useEffect(() => {
    fetchStats();

    // Generate or fetch client fingerprint
    let fp = localStorage.getItem("client_fingerprint");
    if (!fp) {
      fp =
        "fp_" +
        Math.random().toString(36).substring(2) +
        Date.now().toString(36);
      localStorage.setItem("client_fingerprint", fp);
    }
    setFingerprint(fp);

    // Check if there is already a registered subdomain on this browser
    const mySub = localStorage.getItem("my_registered_subdomain");
    if (mySub) {
      setExistingRegSubdomain(mySub);
    }

    // Try to auto-login from LocalStorage
    const savedSub = localStorage.getItem("cf_subdomain");
    const savedToken = localStorage.getItem("cf_token");
    const savedDomain = localStorage.getItem("cf_domain") || "cmnty.qzz.io";
    if (savedSub && savedToken) {
      setManageSubdomain(savedSub);
      setManageToken(savedToken);
      setManageDomain(savedDomain);
      verifyCredentials(savedSub, savedToken, savedDomain);
    }
  }, []);

  // Sync DNS records when verified status is true, and auto-poll every 15 seconds for live status
  useEffect(() => {
    if (isVerified && manageSubdomain && manageToken) {
      fetchDnsRecords(manageSubdomain, manageToken);

      const interval = setInterval(() => {
        fetchDnsRecords(manageSubdomain, manageToken);
      }, 15000);

      return () => clearInterval(interval);
    }
  }, [isVerified, manageSubdomain, manageToken]);

  const checkDnsPropagation = async (
    recordName: string,
    recordType: string,
    recordId: string,
  ) => {
    setDnsStatuses((prev) => ({
      ...prev,
      [recordId]: { loading: true, resolved: false },
    }));
    try {
      const res = await fetch(
        `/api/dns/check?name=${encodeURIComponent(recordName)}&type=${recordType}`,
      );
      const data = await res.json();
      if (data.success) {
        if (data.resolved) {
          setDnsStatuses((prev) => ({
            ...prev,
            [recordId]: { loading: false, resolved: true, values: data.values },
          }));
        } else {
          setDnsStatuses((prev) => ({
            ...prev,
            [recordId]: {
              loading: false,
              resolved: false,
              errMsg: data.message,
            },
          }));
        }
      } else {
        setDnsStatuses((prev) => ({
          ...prev,
          [recordId]: {
            loading: false,
            resolved: false,
            errMsg: "Gagal memverifikasi",
          },
        }));
      }
    } catch (e) {
      setDnsStatuses((prev) => ({
        ...prev,
        [recordId]: {
          loading: false,
          resolved: false,
          errMsg: "Saluran offline",
        },
      }));
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error("Gagal memuat statistik", e);
    }
  };

  const handleSearchCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchSubdomain.trim()) return;

    try {
      const cleanSub = searchSubdomain.trim().toLowerCase();
      const res = await fetch(
        `/api/subdomains/check-dual/${encodeURIComponent(cleanSub)}`,
      );
      const data = await res.json();

      if (data.success) {
        if (!data.valid) {
          setSearchDualResult({
            searched: true,
            valid: false,
            error: data.error,
            subdomain: cleanSub,
            results: [],
          });
        } else {
          setSearchDualResult({
            searched: true,
            valid: true,
            subdomain: data.subdomain,
            results: data.results,
          });
        }
      } else {
        setSearchDualResult({
          searched: true,
          valid: false,
          error: "Terjadi kesalahan saat memeriksa domain.",
          subdomain: cleanSub,
          results: [],
        });
      }
    } catch (e) {
      setSearchDualResult({
        searched: true,
        valid: false,
        error:
          "Gagal mendeteksi status server. Silakan coba beberapa saat lagi.",
        subdomain: searchSubdomain,
        results: [],
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegLoading(true);

    try {
      const res = await fetch("/api/subdomains/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain: regSubdomain,
          domain: regSelectedDomain,
          email: regEmail,
          description: regDescription,
          fingerprint: fingerprint, // Send client fingerprint to enforce 1 domain limit
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setRegError(data.error || "Gagal mendaftarkan subdomain.");
      } else {
        setRegSuccess(data);
        // Save to state for easy transition to manage tab
        setManageSubdomain(data.subdomain);
        setManageToken(data.token);
        const resolvedDom = regSelectedDomain;
        setManageDomain(resolvedDom);
        // Save to local storage for persistent login
        localStorage.setItem("cf_subdomain", data.subdomain);
        localStorage.setItem("cf_token", data.token);
        localStorage.setItem("cf_domain", resolvedDom);
        // Record registration in local storage to prevent registering again
        localStorage.setItem(
          "my_registered_subdomain",
          `${data.subdomain}.${resolvedDom}`,
        );
        setExistingRegSubdomain(`${data.subdomain}.${resolvedDom}`);
        // Reload stats
        fetchStats();
      }
    } catch (err: any) {
      setRegError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setRegLoading(false);
    }
  };

  const verifyCredentials = async (sub: string, tok: string, dom: string) => {
    setVerifyError("");
    setVerifyLoading(true);

    try {
      const res = await fetch("/api/subdomains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: sub, token: tok, domain: dom }),
      });
      const data = await res.json();

      if (data.success && data.verified) {
        setIsVerified(true);
        const resolvedDom = data.domain || dom;
        setManageDomain(resolvedDom);
        localStorage.setItem("cf_subdomain", sub);
        localStorage.setItem("cf_token", tok);
        localStorage.setItem("cf_domain", resolvedDom);
        fetchDnsRecords(sub, tok);
      } else {
        setIsVerified(false);
        setVerifyError(data.error || "Subdomain atau token tidak valid.");
      }
    } catch (e) {
      setVerifyError("Gagal memverifikasi kredensial.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageSubdomain || !manageToken) {
      setVerifyError("Masukkan subdomain dan token Anda");
      return;
    }
    verifyCredentials(
      manageSubdomain.trim(),
      manageToken.trim(),
      manageLoginDomain,
    );
  };

  const handleLogout = () => {
    setIsVerified(false);
    setRecords([]);
    setManageSubdomain("");
    setManageToken("");
    localStorage.removeItem("cf_subdomain");
    localStorage.removeItem("cf_token");
    localStorage.removeItem("cf_domain");
  };

  const handleRecoverToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverSubdomain) {
      setRecoverError("Subdomain harus diisi.");
      return;
    }
    setRecoverError("");
    setRecoverSuccessToken(null);
    setRecoverLoading(true);

    try {
      const { googleSignIn } = await import("./lib/auth");
      const result = await googleSignIn();
      if (!result || !result.accessToken) {
        setRecoverError("Gagal masuk dengan Google.");
        setRecoverLoading(false);
        return;
      }

      const res = await fetch("/api/subdomains/forgot-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subdomain: recoverSubdomain.trim().toLowerCase(),
          targetDomain: recoverDomain,
          accessToken: result.accessToken
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Token pemulihan telah dikirim ke email Gmail Anda.");
        setRecoverSuccessToken("Token dikirim ke Email!"); // visual feedback
        setShowRecoverForm(false);
      } else {
        setRecoverError(
          data.error || "Gagal memulihkan token. Pastikan Anda masuk dengan email pendaftar.",
        );
      }
    } catch (err: any) {
      console.error(err);
      setRecoverError("Terjadi kesalahan atau otorisasi dibatalkan.");
    } finally {
      setRecoverLoading(false);
    }
  };

  const fetchDnsRecords = async (sub: string, tok: string) => {
    setRecordsLoading(true);
    setRecordsError("");
    try {
      const res = await fetch(`/api/subdomains/${sub}/records`, {
        headers: {
          Authorization: `Bearer ${tok}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
      } else {
        setRecordsError(data.error || "Gagal memuat DNS records.");
      }
    } catch (e) {
      setRecordsError("Gagal menghubungi server untuk memuat records.");
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddRecordError("");
    setAddingRecord(true);

    // Build the full record name
    let finalName = "";
    const cleanSubInput = newRecName.trim().toLowerCase();
    const baseSuffix = `.${manageSubdomain}.${manageDomain}`;
    const fullBaseDomain = `${manageSubdomain}.${manageDomain}`;

    if (cleanSubInput === "@" || cleanSubInput === "") {
      finalName = fullBaseDomain;
    } else {
      // Allow user to write 'halo' -> 'halo.budi.cmnty.qzz.io' or 'halo.budi.cmty.dpdns.org'
      if (cleanSubInput.endsWith(baseSuffix)) {
        finalName = cleanSubInput;
      } else {
        finalName = `${cleanSubInput}${baseSuffix}`;
      }
    }

    try {
      const res = await fetch(`/api/subdomains/${manageSubdomain}/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${manageToken}`,
        },
        body: JSON.stringify({
          type: newRecType,
          name: finalName,
          content: newRecContent,
          ttl: Number(newRecTtl),
          proxied: newRecProxied,
          priority: newRecType === "MX" ? Number(newRecPriority) : undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // Reset form
        setNewRecName("@");
        setNewRecContent("");
        setNewRecProxied(false);
        // Refresh records
        fetchDnsRecords(manageSubdomain, manageToken);
      } else {
        setAddRecordError(data.error || "Gagal menambahkan record.");
      }
    } catch (e) {
      setAddRecordError("Terjadi kesalahan koneksi sistem.");
    } finally {
      setAddingRecord(false);
    }
  };

  const startEditing = (record: DnsRecord) => {
    let displayPrefix = record.name;
    const suffix = `.${manageSubdomain}.${manageDomain}`;
    const fullDomain = `${manageSubdomain}.${manageDomain}`;

    if (record.name.toLowerCase() === fullDomain.toLowerCase()) {
      displayPrefix = "@";
    } else if (record.name.toLowerCase().endsWith(suffix.toLowerCase())) {
      displayPrefix = record.name.slice(0, -suffix.length);
    }

    setEditingRecordId(record.id);
    setEditRecType(record.type);
    setEditRecName(displayPrefix);
    setEditRecContent(record.content);
    setEditRecTtl(record.ttl);
    setEditRecProxied(!!record.proxied);
    setEditRecPriority(record.priority || 10);
  };

  const handleUpdateRecord = async (id: string) => {
    setUpdateRecordError("");
    setUpdatingRecord(true);

    let finalName = editRecName.trim().toLowerCase();
    const suffix = `.${manageSubdomain}.${manageDomain}`;
    const fullDomain = `${manageSubdomain}.${manageDomain}`;

    if (finalName === "@" || finalName === "") {
      finalName = fullDomain;
    } else if (!finalName.endsWith(suffix) && finalName !== fullDomain) {
      finalName = `${finalName}${suffix}`;
    }

    try {
      const res = await fetch(
        `/api/subdomains/${manageSubdomain}/records/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${manageToken}`,
          },
          body: JSON.stringify({
            type: editRecType,
            name: finalName,
            content: editRecContent.trim(),
            ttl: Number(editRecTtl),
            proxied: Boolean(editRecProxied),
            priority:
              editRecType === "MX" ? Number(editRecPriority) : undefined,
          }),
        },
      );
      const data = await res.json();

      if (data.success) {
        setEditingRecordId(null);
        fetchDnsRecords(manageSubdomain, manageToken);
      } else {
        setUpdateRecordError(data.error || "Gagal memperbarui record.");
        alert(data.error || "Gagal memperbarui record.");
      }
    } catch (e) {
      setUpdateRecordError("Terjadi kesalahan koneksi sistem.");
      alert("Terjadi kesalahan koneksi sistem.");
    } finally {
      setUpdatingRecord(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus record DNS ini?")) return;

    try {
      const res = await fetch(
        `/api/subdomains/${manageSubdomain}/records/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${manageToken}`,
          },
        },
      );
      const data = await res.json();

      if (data.success) {
        fetchDnsRecords(manageSubdomain, manageToken);
      } else {
        alert(data.error || "Gagal menghapus record.");
      }
    } catch (e) {
      alert("Gagal menghapus record DNS.");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopyStatus((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col selection:bg-pink-400 selection:text-black font-sans">
      {/* Dynamic Navbar */}
      <nav
        id="navbar"
        className="sticky top-0 z-50 bg-white border-b-[3px] border-black"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setActiveTab("home")}
            >
              <div className="p-2 bg-yellow-400 neo-box !shadow-[2px_2px_0px_0px_#000] !rounded-lg text-black">
                <Globe className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-extrabold text-black text-xl tracking-tight uppercase">
                  CMNTY
                </span>
                <span className="text-[10px] block text-black font-extrabold uppercase tracking-widest -mt-1">
                  Free DNS
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                id="nav-home"
                onClick={() => setActiveTab("home")}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold uppercase transition-all ${
                  activeTab === "home"
                    ? "border-b-[3px] border-black text-black"
                    : "text-black hover:bg-yellow-200"
                }`}
              >
                Beranda
              </button>

              {isVerified ? (
                <button
                  id="nav-manage-dashboard"
                  onClick={() => setActiveTab("manage")}
                  className="neo-btn neo-btn-primary px-3 sm:px-4 py-2 text-xs sm:text-sm uppercase flex items-center gap-1.5"
                >
                  <Settings className="h-4 w-4 animate-spin-slow shrink-0 stroke-[2.5]" />
                  <span>
                    <span className="hidden sm:inline">
                      Dashboard ({manageSubdomain})
                    </span>
                    <span className="sm:hidden">Panel</span>
                  </span>
                </button>
              ) : (
                <button
                  id="nav-manage-login"
                  onClick={() => setActiveTab("manage")}
                  className={`neo-btn neo-btn-secondary px-3 sm:px-4 py-2 text-xs sm:text-sm uppercase ${
                    activeTab === "manage" ? "bg-yellow-400" : ""
                  }`}
                >
                  <span className="hidden sm:inline">Kelola DNS</span>
                  <span className="sm:hidden">Kelola</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {/* TAB 1: HOME PANEL */}
          {activeTab === "home" && (
            <motion.div
              key="home-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-12"
            >
              {/* Hero Banner Section */}
              <div className="text-center max-w-3xl mx-auto space-y-6 py-6 sm:py-10">
                <div className="neo-badge inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-black text-[10px] sm:text-xs">
                  <Activity className="h-3.5 w-3.5 stroke-[3]" />
                  <span>Platform Subdomain Gratis Selamanya</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-black tracking-tight leading-tight uppercase relative inline-block">
                  Buat Subdomain{" "}
                  <span className="bg-pink-400 neo-box !shadow-[4px_4px_0_0_#000] !rounded-md px-2 py-1 mx-1 transform -rotate-2 inline-block">
                    Gratis
                  </span>{" "}
                  Sendiri!
                </h1>

                <p className="text-base sm:text-xl text-black font-bold max-w-2xl mx-auto leading-relaxed border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
                  Gunakan untuk VPS, hosting, blog, portofolio, atau server game
                  kamu. Instan online dengan{" "}
                  <span className="underline decoration-4 decoration-yellow-400 break-words">
                    cmnty.qzz.io
                  </span>{" "}
                  &{" "}
                  <span className="underline decoration-4 decoration-yellow-400 break-words">
                    cmty.dpdns.org
                  </span>
                  .
                </p>

                {/* Subdomain Search Availability Checker */}
                <form
                  id="checker-form"
                  onSubmit={handleSearchCheck}
                  className="max-w-xl mx-auto p-1.5 bg-white neo-box flex items-center gap-1 sm:gap-2 mt-10"
                >
                  <div className="flex-1 flex items-center pl-2 sm:pl-3 min-w-0">
                    <Search className="h-5 w-5 sm:h-6 sm:w-6 text-black mr-1 sm:mr-2 shrink-0 stroke-[3]" />
                    <input
                      type="text"
                      placeholder="Masukkan nama subdomain..."
                      className="w-full text-black focus:outline-none font-bold placeholder:text-gray-500 bg-transparent py-2 sm:py-3 text-sm sm:text-lg min-w-0"
                      value={searchSubdomain}
                      onChange={(e) => {
                        setSearchSubdomain(e.target.value);
                        setSearchDualResult(null);
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="neo-btn neo-btn-primary py-2 sm:py-3 px-4 sm:px-8 text-sm sm:text-lg shrink-0 cursor-pointer uppercase tracking-wider"
                  >
                    Periksa
                  </button>
                </form>

                {/* Availability Alert Response */}
                <AnimatePresence>
                  {searchDualResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="max-w-2xl mx-auto space-y-4"
                    >
                      {!searchDualResult.valid ? (
                        <div className="bg-red-400 border-[3px] border-black text-black p-4 rounded-lg text-center text-sm font-bold shadow-[4px_4px_0_0_#000]">
                          {searchDualResult.error ||
                            "Format nama subdomain tidak valid."}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {searchDualResult.results.map((res) => (
                            <div
                              key={res.domainName}
                              className={`p-5 rounded-lg border-[3px] border-black text-left flex flex-col justify-between transition-all shadow-[4px_4px_0_0_#000] ${
                                res.available ? "bg-white" : "bg-gray-200"
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  {res.available ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border-2 border-black text-[10px] font-black bg-emerald-400 text-black uppercase tracking-widest">
                                      Tersedia
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border-2 border-black text-[10px] font-black bg-red-400 text-black uppercase tracking-widest">
                                      Terdaftar
                                    </span>
                                  )}
                                </div>
                                <span className="font-black text-black text-base sm:text-xl block tracking-tight">
                                  {searchDualResult.subdomain}.
                                  <span className="text-black font-extrabold underline decoration-2">
                                    {res.domainName}
                                  </span>
                                </span>
                                <p className="text-gray-800 text-xs mt-2 font-bold leading-relaxed">
                                  {res.available
                                    ? `Subdomain ini bebas untuk didaftarkan secara gratis.`
                                    : `Subdomain ini telah digunakan oleh pengguna lain.`}
                                </p>
                              </div>

                              {res.available && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRegSubdomain(searchDualResult.subdomain);
                                    setRegSelectedDomain(res.domainName);
                                    setActiveTab("register");
                                    setSearchDualResult(null);
                                  }}
                                  className="mt-4 w-full neo-btn neo-btn-success py-2 px-3 uppercase tracking-wider text-center cursor-pointer text-xs"
                                >
                                  Daftar Sekarang
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bento Grid Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-yellow-100 neo-box p-6 sm:p-8 hover:-translate-y-1 transition-transform group">
                  <div className="p-3 bg-white border-[3px] border-black rounded-lg text-black w-fit mb-6 shadow-[4px_4px_0_0_#000]">
                    <Cloud className="h-6 w-6 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xl font-black text-black mb-2 uppercase">
                    DNS Anycast
                  </h3>
                  <p className="text-black font-semibold text-sm leading-relaxed">
                    Setiap record akan diperbarui langsung secara real-time ke
                    infrastruktur server DNS Anycast Global. Sangat aman, cepat,
                    dan reliabel.
                  </p>
                </div>

                <div className="bg-emerald-100 neo-box p-6 sm:p-8 hover:-translate-y-1 transition-transform group">
                  <div className="p-3 bg-white border-[3px] border-black rounded-lg text-black w-fit mb-6 shadow-[4px_4px_0_0_#000]">
                    <Shield className="h-6 w-6 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xl font-black text-black mb-2 uppercase">
                    Multi Record
                  </h3>
                  <p className="text-black font-semibold text-sm leading-relaxed">
                    Tambahkan A, AAAA, CNAME, TXT, MX, NS, SRV, dan semua type
                    DNS lainnya. Dukung juga pembuatan proxy terenkripsi
                    (layanan pelindung DDoS dan performa tinggi).
                  </p>
                </div>

                <div className="bg-pink-100 neo-box p-6 sm:p-8 hover:-translate-y-1 transition-transform group">
                  <div className="p-3 bg-white border-[3px] border-black rounded-lg text-black w-fit mb-6 shadow-[4px_4px_0_0_#000]">
                    <Lock className="h-6 w-6 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xl font-black text-black mb-2 uppercase">
                    Keamanan
                  </h3>
                  <p className="text-black font-semibold text-sm leading-relaxed">
                    Setiap subdomain diberikan token pengelolaan unik. Tidak
                    akan ada orang lain yang bisa memanipulasi DNS Anda secara
                    ilegal.
                  </p>
                </div>
              </div>

              {/* Stats & Activity Banner */}
              <div className="bg-white neo-box p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center border-[4px] border-black">
                <div className="space-y-3 lg:border-r-[3px] lg:border-black lg:pr-8">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-black stroke-[3]" />
                    <span className="font-black uppercase text-xs tracking-wider text-black bg-cyan-200 border-2 border-black px-2 py-0.5">
                      Statistik Platform
                    </span>
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-black">
                    {stats.totalRegistered} Subdomain
                  </div>
                  <p className="text-gray-900 font-bold text-xs sm:text-sm leading-relaxed">
                    Telah aktif didaftarkan oleh komunitas developer, pehobi
                    teknologi, dan admin sistem.
                  </p>
                  <button
                    onClick={() => {
                      setRegSubdomain("");
                      setActiveTab("register");
                    }}
                    className="inline-flex items-center gap-1.5 text-black font-black text-xs hover:text-indigo-800 uppercase tracking-widest mt-2 border-b-2 border-black pb-0.5"
                  >
                    Dapatkan milikmu{" "}
                    <ChevronRight className="h-4 w-4 stroke-[3]" />
                  </button>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-wider text-black border-b-[3px] border-black inline-block pb-1">
                    Registrasi Terbaru
                  </h4>
                  {stats.recent.length === 0 ? (
                    <p className="text-gray-500 font-bold text-sm">
                      Belum ada subdomain terdaftar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
                      {stats.recent.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-white neo-box !rounded-md !shadow-[3px_3px_0_0_#000] p-3 flex items-center justify-between text-xs transition-colors hover:-translate-y-0.5"
                        >
                          <div className="space-y-0.5 truncate pr-2">
                            <span className="font-black text-black block truncate text-sm">
                              {item.domain}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-gray-700 block line-clamp-1">
                              {item.description || "Subdomain gratis baru"}
                            </span>
                          </div>
                          <span className="text-[10px] neo-badge bg-yellow-200 px-2 py-0.5 rounded-sm text-black whitespace-nowrap">
                            <Clock className="h-3 w-3 inline-block mr-1 -mt-0.5 stroke-[2.5]" />
                            {new Date(item.createdAt).toLocaleDateString(
                              "id-ID",
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Panduan & FAQ Section */}
              <div className="bg-cyan-200 neo-box p-6 sm:p-8 space-y-6">
                <div className="border-b-[3px] border-black pb-4 flex items-center gap-2">
                  <div className="p-2 bg-white border-2 border-black rounded-sm text-black shadow-[2px_2px_0_0_#000]">
                    <Shield className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-black uppercase">
                      Panduan & QNA
                    </h3>
                    <p className="text-sm text-gray-800 font-bold">
                      Informasi penting untuk pemula & profesional.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-2 bg-white p-4 border-[3px] border-black rounded-lg shadow-[4px_4px_0_0_#000]">
                    <h4 className="font-black text-black flex items-center gap-1.5 uppercase">
                      <span className="text-pink-500 text-lg">Q.</span>{" "}
                      Hubungkan VPS?
                    </h4>
                    <p className="text-gray-900 font-bold text-xs sm:text-sm leading-relaxed">
                      Daftarkan subdomain, masuk ke <strong>Kelola DNS</strong>,
                      lalu buat record tipe <strong>A</strong> dengan nama{" "}
                      <strong>@</strong> dan masukkan IP Publik IPv4 VPS. Klik
                      simpan, lalu tunggu propagasi.
                    </p>
                  </div>

                  <div className="space-y-2 bg-white p-4 border-[3px] border-black rounded-lg shadow-[4px_4px_0_0_#000]">
                    <h4 className="font-black text-black flex items-center gap-1.5 uppercase">
                      <span className="text-pink-500 text-lg">Q.</span> Waktu
                      Propagasi?
                    </h4>
                    <p className="text-gray-900 font-bold text-xs sm:text-sm leading-relaxed">
                      Anycast DNS kami memiliki sinkronisasi instan. Biasanya
                      perubahan akan aktif di seluruh dunia dalam{" "}
                      <strong>1 - 3 menit</strong> saja. Gunakan tombol{" "}
                      <strong>Cek Live</strong> untuk mengetes.
                    </p>
                  </div>

                  <div className="space-y-2 bg-white p-4 border-[3px] border-black rounded-lg shadow-[4px_4px_0_0_#000]">
                    <h4 className="font-black text-black flex items-center gap-1.5 uppercase">
                      <span className="text-pink-500 text-lg">Q.</span> Lupa
                      Token?
                    </h4>
                    <p className="text-gray-900 font-bold text-xs sm:text-sm leading-relaxed">
                      Selama mengisi email saat mendaftar, pergi ke{" "}
                      <strong>Kelola DNS</strong>, klik{" "}
                      <strong>Lupa Token?</strong> untuk memulihkannya dalam
                      hitungan detik.
                    </p>
                  </div>

                  <div className="space-y-2 bg-white p-4 border-[3px] border-black rounded-lg shadow-[4px_4px_0_0_#000]">
                    <h4 className="font-black text-black flex items-center gap-1.5 uppercase">
                      <span className="text-pink-500 text-lg">Q.</span> Batas 1
                      Subdomain?
                    </h4>
                    <p className="text-gray-900 font-bold text-xs sm:text-sm leading-relaxed">
                      Kami membatasi 1 subdomain per browser/device untuk
                      mencegah spammer dan robot, demi performa optimal untuk
                      seluruh pengguna.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: REGISTER PANEL */}
          {activeTab === "register" && (
            <motion.div
              key="register-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white border-[4px] border-black rounded-xl shadow-[8px_8px_0_0_#000] overflow-hidden">
                <div className="bg-purple-400 p-6 sm:p-8 text-black border-b-[4px] border-black relative">
                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Globe className="h-32 w-32 -mr-10 -mt-10 stroke-black text-black" />
                  </div>
                  <h2 className="text-3xl font-black uppercase">
                    Daftar Subdomain Gratis
                  </h2>
                  <p className="text-black text-sm mt-2 font-bold max-w-sm">
                    Lengkapi form di bawah untuk langsung mendaftarkan subdomain
                    Anda secara gratis di bawah domain utama kami.
                  </p>
                </div>

                {existingRegSubdomain ? (
                  <div className="p-8 sm:p-10 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center shadow-sm border border-amber-100">
                      <Shield className="h-8 w-8 text-amber-500" />
                    </div>
                    <div className="space-y-2 max-w-md mx-auto">
                      <h3 className="text-xl font-bold text-slate-800">
                        Batas Domain Tercapai
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Anda telah mendaftarkan subdomain{" "}
                        <span className="font-extrabold text-indigo-600 font-mono">
                          {existingRegSubdomain.includes(".")
                            ? existingRegSubdomain
                            : `${existingRegSubdomain}.cmnty.qzz.io`}
                        </span>{" "}
                        pada browser ini. Setiap pengguna hanya diperbolehkan
                        membuat maksimal{" "}
                        <span className="font-semibold text-slate-700">
                          1 subdomain gratis
                        </span>
                        .
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl max-w-sm mx-auto flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-400">Status Browser:</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-100 animate-pulse">
                        1 Subdomain Aktif
                      </span>
                    </div>

                    <div className="pt-4 max-w-xs mx-auto">
                      <button
                        onClick={() => {
                          const fullSub = existingRegSubdomain;
                          let parsedSub = fullSub;
                          let parsedDom = "cmnty.qzz.io";
                          if (fullSub.includes(".")) {
                            parsedSub = fullSub.split(".")[0];
                            parsedDom = fullSub.substring(parsedSub.length + 1);
                          }
                          setManageSubdomain(parsedSub);
                          setManageDomain(parsedDom);
                          setManageLoginDomain(parsedDom);
                          const savedToken =
                            localStorage.getItem("cf_token") || "";
                          setManageToken(savedToken);
                          setIsVerified(!!savedToken);
                          setActiveTab("manage");
                          if (savedToken) {
                            fetchDnsRecords(parsedSub, savedToken);
                          }
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200/40 transition-all text-center flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        Kelola Subdomain Anda <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : !regSuccess ? (
                  <form
                    onSubmit={handleRegister}
                    className="p-6 sm:p-8 space-y-6"
                  >
                    {regError && (
                      <div className="bg-red-50 border border-red-100 text-red-150 p-4 rounded-xl flex items-start gap-2.5 text-sm">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block">
                            Gagal mendaftar
                          </span>
                          {regError}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-black text-black block uppercase tracking-wider">
                        Subdomain yang Diinginkan
                      </label>
                      <div className="flex items-center neo-input bg-white overflow-hidden">
                        <input
                          type="text"
                          required
                          placeholder="namakamu"
                          className="w-full py-3 px-3 text-black bg-transparent focus:outline-none font-black placeholder:text-gray-400 text-sm sm:text-base min-w-0"
                          value={regSubdomain}
                          onChange={(e) =>
                            setRegSubdomain(e.target.value.toLowerCase())
                          }
                        />
                        <select
                          className="text-black font-black bg-yellow-200 hover:bg-yellow-300 py-3 px-2 sm:px-4 border-l-[3px] border-black text-xs sm:text-sm shrink-0 outline-none h-full cursor-pointer transition-colors"
                          value={regSelectedDomain}
                          onChange={(e) => setRegSelectedDomain(e.target.value)}
                        >
                          <option value="cmnty.qzz.io">.cmnty.qzz.io</option>
                          <option value="cmty.dpdns.org">
                            .cmty.dpdns.org
                          </option>
                        </select>
                      </div>
                      <p className="text-[11px] text-gray-800 font-bold leading-normal">
                        Gunakan 3-20 karakter. Hanya diperbolehkan huruf kecil
                        (a-z), angka (0-9), dan tanda strip (-).
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-black text-black block uppercase tracking-wider">
                        Email Pemilik (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="pemilik@gmail.com"
                        className="neo-input w-full px-4 py-3 text-black bg-white focus:outline-none font-bold placeholder:text-gray-400"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                      />
                      <p className="text-[11px] text-gray-800 font-bold leading-normal">
                        Hanya digunakan untuk pemulihan token jika Anda
                        kehilangan akses.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-black text-black block uppercase tracking-wider">
                        Deskripsi Singkat (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Gunakan untuk server Minecraft / blog portofolio budi..."
                        className="neo-input w-full px-4 py-3 text-black bg-white focus:outline-none font-bold placeholder:text-gray-400 resize-none"
                        value={regDescription}
                        onChange={(e) => setRegDescription(e.target.value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full neo-btn neo-btn-primary py-4 uppercase text-lg flex items-center justify-center gap-2"
                    >
                      {regLoading ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin stroke-[3]" />
                          <span>Mendaftarkan...</span>
                        </>
                      ) : (
                        <span>Daftarkan Subdomain</span>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="p-6 sm:p-8 space-y-6">
                    <div className="neo-box border-emerald-400 bg-white p-6 rounded-lg text-center space-y-3 shadow-[4px_4px_0_0_#34d399]">
                      <div className="mx-auto w-12 h-12 bg-emerald-400 font-bold text-black border-2 border-black rounded-sm flex items-center justify-center shadow-[4px_4px_0_0_#000]">
                        <Check className="h-6 w-6 stroke-[3]" />
                      </div>
                      <h3 className="text-xl font-black uppercase text-black">
                        Pendaftaran Berhasil!
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-800 font-bold max-w-md mx-auto">
                        Subdomain Anda aktif seketika. Simpan informasi di bawah
                        dengan aman untuk mengelola DNS Record Anda.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-100 p-4 border-[3px] border-black rounded-lg space-y-1.5 relative overflow-hidden group shadow-[4px_4px_0_0_#000]">
                        <span className="text-[10px] text-gray-800 uppercase font-black tracking-wider">
                          Subdomain Anda
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-black text-lg">
                            {regSuccess.domain}
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(regSuccess.domain, "domain")
                            }
                            className="text-black bg-white border-2 border-black p-1 hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000] active:shadow-none transition-all"
                            title="Salin domain"
                          >
                            {copyStatus["domain"] ? (
                              <Check className="h-5 w-5 text-emerald-500 stroke-[3]" />
                            ) : (
                              <Copy className="h-5 w-5 stroke-[2.5]" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-purple-100 p-4 border-[3px] border-black rounded-lg space-y-1.5 relative overflow-hidden group shadow-[4px_4px_0_0_#000]">
                        <span className="text-[10px] text-purple-700 uppercase font-black tracking-wider flex items-center gap-1">
                          <Lock className="h-3 w-3 stroke-[3]" /> Token
                          Pengelolaan (SECRET)
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-black text-black text-xs sm:text-base break-all bg-white px-2 py-1 border-2 border-black">
                            {regSuccess.token}
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(regSuccess.token, "token")
                            }
                            className="text-black bg-white border-2 border-black p-1 hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000] active:shadow-none transition-all shrink-0"
                            title="Salin token rahasia"
                          >
                            {copyStatus["token"] ? (
                              <Check className="h-5 w-5 text-emerald-500 stroke-[3]" />
                            ) : (
                              <Copy className="h-5 w-5 stroke-[2.5]" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-amber-200 border-[3px] border-black text-black p-3.5 rounded-lg text-xs leading-normal flex items-start gap-2 shadow-[4px_4px_0_0_#000] font-bold">
                        <AlertCircle className="h-5 w-5 text-black shrink-0 stroke-[2.5] mt-0.5" />
                        <span>
                          <strong>PERHATIAN:</strong> Simpan token di atas
                          sekarang. Kami tidak menampilkan token ini kembali
                          demi alasan keamanan.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => {
                          setRegSuccess(null);
                          setRegSubdomain("");
                          setIsVerified(true);
                          setActiveTab("manage");
                        }}
                        className="flex-1 neo-btn neo-btn-primary py-3 px-4 uppercase flex items-center justify-center gap-1.5"
                      >
                        Kelola DNS Sekarang{" "}
                        <ArrowRight className="h-5 w-5 stroke-[3]" />
                      </button>
                      <button
                        onClick={() => {
                          setRegSuccess(null);
                          setRegSubdomain("");
                          setActiveTab("home");
                        }}
                        className="neo-btn neo-btn-secondary px-6 py-3 uppercase"
                      >
                        Beranda
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 3: MANAGE DNS PANEL */}
          {activeTab === "manage" && (
            <motion.div
              key="manage-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {!isVerified ? (
                // Sign in to Subdomain Form / Recover Token Form
                <div className="max-w-md mx-auto bg-white border-[4px] border-black rounded-xl shadow-[8px_8px_0_0_#000] overflow-hidden">
                  <div className="bg-yellow-400 p-6 text-black border-b-[4px] border-black text-center space-y-1">
                    <Lock className="mx-auto h-10 w-10 text-black stroke-[2.5] mb-2" />
                    <h2 className="text-2xl font-black uppercase tracking-tight">
                      {showRecoverForm
                        ? "Pemulihan Token"
                        : "Verifikasi Subdomain"}
                    </h2>
                    <p className="text-black text-sm font-bold opacity-80 leading-snug">
                      {showRecoverForm
                        ? "Ambil kembali token Anda menggunakan nama subdomain dan alamat email terdaftar."
                        : "Masukkan subdomain dan token Anda untuk mengakses manajemen DNS."}
                    </p>
                  </div>

                  {showRecoverForm ? (
                    <form
                      onSubmit={handleRecoverToken}
                      className="p-6 space-y-4"
                    >
                      <div className="text-center space-y-1 mb-2">
                        <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                          Informasi Pemulihan
                        </span>
                        <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-normal mt-1.5">
                          Klik tombol di bawah untuk masuk dengan akun Google Anda. 
                          Token akan dikirimkan ke kotak masuk Email Anda.
                        </p>
                      </div>

                      {recoverError && (
                        <div className="bg-red-50 border border-red-100 text-red-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs">
                          <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                          <span>{recoverError}</span>
                        </div>
                      )}

                      {recoverSuccessToken && (
                        <div className="bg-emerald-100 border-[3px] border-black p-4 rounded-lg space-y-3 shadow-[4px_4px_0_0_#000]">
                          <div className="flex items-center gap-1.5 text-black font-black text-xs uppercase">
                            <Check className="h-5 w-5 bg-emerald-400 text-black border-2 border-black rounded-sm p-0.5 stroke-[3]" />
                            <span>Token Berhasil Dipulihkan!</span>
                          </div>

                          <div className="bg-white p-2.5 rounded-sm border-2 border-black flex items-center justify-between gap-1.5 font-mono text-[11px] font-black text-black select-all select-text break-all">
                            <span>{recoverSuccessToken}</span>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(
                                  recoverSuccessToken,
                                  "recovered-tok",
                                )
                              }
                              className="text-black hover:bg-yellow-200 p-1 bg-white border-2 border-black rounded shadow-[2px_2px_0_0_#000]"
                            >
                              {copyStatus["recovered-tok"] ? (
                                <Check className="h-4 w-4 text-emerald-500 stroke-[3]" />
                              ) : (
                                <Copy className="h-4 w-4 stroke-[2.5]" />
                              )}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setManageToken(recoverSuccessToken);
                              setShowRecoverForm(false);
                            }}
                            className="w-full text-center neo-btn neo-btn-success py-2 text-xs uppercase"
                          >
                            Gunakan Token Ini Untuk Masuk
                          </button>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-black block uppercase tracking-wider">
                          Subdomain Anda
                        </label>
                        <div className="flex items-center neo-input bg-white overflow-hidden">
                          <input
                            type="text"
                            required
                            placeholder="namakamu"
                            className="w-full py-2.5 px-3 text-black bg-transparent focus:outline-none font-black placeholder:text-gray-400 text-sm min-w-0"
                            value={recoverSubdomain}
                            onChange={(e) =>
                              setRecoverSubdomain(e.target.value.toLowerCase())
                            }
                          />
                          <select
                            className="text-black font-black bg-yellow-200 hover:bg-yellow-300 py-3 px-2 border-l-[3px] border-black text-[10px] sm:text-xs shrink-0 outline-none h-full cursor-pointer transition-colors"
                            value={recoverDomain}
                            onChange={(e) => setRecoverDomain(e.target.value)}
                          >
                            <option value="cmnty.qzz.io">.cmnty.qzz.io</option>
                            <option value="cmty.dpdns.org">
                              .cmty.dpdns.org
                            </option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={recoverLoading}
                        className="w-full neo-btn neo-btn-primary py-3 uppercase flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {recoverLoading ? (
                          <>
                            <RefreshCw className="h-5 w-5 animate-spin stroke-[3]" />
                            <span>Memproses...</span>
                          </>
                        ) : (
                          <span>Verifikasi dengan Google Account</span>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={handleLogin}
                      className="p-6 space-y-4 bg-white"
                    >
                      {verifyError && (
                        <div className="bg-red-400 border-[3px] border-black text-black p-3.5 rounded-lg flex items-start gap-2.5 text-xs font-bold shadow-[4px_4px_0_0_#000]">
                          <AlertCircle className="h-5 w-5 text-black shrink-0 mt-0.5 stroke-[2.5]" />
                          <span>{verifyError}</span>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-black block uppercase tracking-wider">
                          Subdomain Anda
                        </label>
                        <div className="flex items-center neo-input bg-white overflow-hidden">
                          <input
                            type="text"
                            required
                            placeholder="namakamu"
                            className="w-full py-2.5 px-3 text-black bg-transparent focus:outline-none font-black placeholder:text-gray-400 text-sm min-w-0"
                            value={manageSubdomain}
                            onChange={(e) =>
                              setManageSubdomain(e.target.value.toLowerCase())
                            }
                          />
                          <select
                            className="text-black font-black bg-yellow-200 hover:bg-yellow-300 py-3 px-2 border-l-[3px] border-black text-[10px] sm:text-xs shrink-0 outline-none h-full cursor-pointer transition-colors"
                            value={manageLoginDomain}
                            onChange={(e) =>
                              setManageLoginDomain(e.target.value)
                            }
                          >
                            <option value="cmnty.qzz.io">.cmnty.qzz.io</option>
                            <option value="cmty.dpdns.org">
                              .cmty.dpdns.org
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-black block uppercase tracking-wider">
                          Token Pengelolaan
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="tok_..."
                          className="w-full neo-input px-3 py-2.5 text-black font-mono focus:outline-none font-bold text-sm placeholder:text-gray-400 placeholder:font-sans"
                          value={manageToken}
                          onChange={(e) => setManageToken(e.target.value)}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={verifyLoading}
                        className="w-full neo-btn neo-btn-primary py-3 uppercase flex items-center justify-center gap-2 cursor-pointer mt-4"
                      >
                        {verifyLoading ? (
                          <>
                            <RefreshCw className="h-5 w-5 animate-spin stroke-[3]" />
                            <span>Memverifikasi akses...</span>
                          </>
                        ) : (
                          <span>Masuk ke Dashboard</span>
                        )}
                      </button>
                    </form>
                  )}

                  <div className="border-t-[4px] border-black p-4 bg-gray-100 text-center text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecoverForm(!showRecoverForm);
                        setRecoverError("");
                        setRecoverSuccessToken(null);
                      }}
                      className="text-black font-black transition-all cursor-pointer hover:bg-yellow-400 uppercase border-2 border-transparent hover:border-black hover:shadow-[2px_2px_0_0_#000] px-3 py-1 rounded"
                    >
                      {showRecoverForm
                        ? "← Kembali ke Masuk"
                        : "Lupa Token Pengelolaan?"}
                    </button>
                  </div>
                </div>
              ) : (
                // Dashboard for verified users
                <div className="space-y-8">
                  {/* Dashboard Header Banner */}
                  <div className="bg-white neo-box p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-[4px] border-black">
                    <div className="flex items-start gap-4">
                      <div className="p-3.5 bg-yellow-400 border-2 border-black rounded-sm shadow-[3px_3px_0_0_#000]">
                        <Globe className="h-6 w-6 stroke-[3] text-black" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight uppercase">
                            {manageSubdomain}.{manageDomain}
                          </h2>
                          <div className="bg-emerald-400 border-2 border-black text-black text-[10px] font-black px-2.5 py-1 rounded-sm uppercase tracking-wider flex items-center gap-1 shadow-[2px_2px_0_0_#000]">
                            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
                            Aktif
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-800 font-bold leading-normal">
                          Mengatur DNS record untuk subdomain utama dan segala
                          sub-rekord turunannya.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full md:w-auto self-stretch md:self-auto shrink-0 mt-4 md:mt-0">
                      <button
                        onClick={() =>
                          fetchDnsRecords(manageSubdomain, manageToken)
                        }
                        disabled={recordsLoading}
                        className="p-3 bg-white border-2 border-black hover:bg-yellow-200 text-black rounded-lg transition-all active:translate-y-[2px] shadow-[3px_3px_0_0_#000] active:shadow-none relative flex items-center justify-center flex-1 sm:flex-initial"
                        title="Segarkan DNS Records"
                      >
                        <RefreshCw
                          className={`h-4.5 w-4.5 stroke-[3] ${recordsLoading ? "animate-spin" : ""}`}
                        />
                        <span className="sm:hidden font-black text-xs ml-1.5 uppercase">
                          Segarkan
                        </span>
                      </button>

                      <button
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-pink-400 hover:bg-pink-500 text-black border-2 border-black shadow-[3px_3px_0_0_#000] hover:-translate-y-[1px] active:shadow-none active:translate-y-[3px] font-black text-xs sm:text-sm rounded-lg transition-all flex-1 sm:flex-initial uppercase"
                      >
                        <LogOut className="h-4 w-4 stroke-[3]" />
                        <span>Keluar Sesi</span>
                      </button>
                    </div>
                  </div>{" "}
                  {/* Cloudflare Style Management Dashboard Panel */}
                  <div className="bg-white neo-box border-[4px] border-black overflow-hidden min-w-0 w-full transition-shadow">
                    {/* Toolbar Header of DNS Zone Desk */}
                    <div className="border-b-[4px] border-black bg-purple-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Settings className="h-24 w-24 -mr-6 -mt-6 stroke-[3]" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-xl font-black text-black flex items-center gap-2 uppercase">
                          <Settings className="h-6 w-6 text-black animate-spin-slow stroke-[3]" />
                          <span>DNS Manajemen</span>
                        </h3>
                        <p className="text-xs font-bold text-gray-800 mt-1">
                          Kelola DNS record dan lintasan proxy untuk{" "}
                          <span className="font-black text-black">
                            {manageSubdomain}.{manageDomain}
                          </span>
                          .
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 relative z-10">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddForm(!showAddForm);
                            setAddRecordError("");
                          }}
                          className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-md text-xs font-black uppercase transition-all shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:shadow-none active:translate-y-[4px] cursor-pointer border-[3px] border-black ${
                            showAddForm
                              ? "bg-gray-300 text-black"
                              : "bg-emerald-400 text-black"
                          }`}
                        >
                          {showAddForm ? (
                            <X className="h-4 w-4 stroke-[3]" />
                          ) : (
                            <Plus className="h-4 w-4 stroke-[3]" />
                          )}
                          <span>
                            {showAddForm ? "Batal Tambah" : "Add Record"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Add Record Form Grid */}
                    {showAddForm && (
                      <div className="border-b-[4px] border-black bg-emerald-200 p-6 md:p-8 animate-fadeIn">
                        <div className="max-w-4xl mx-auto space-y-6 bg-white border-[4px] border-black p-6 shadow-[8px_8px_0_0_#000]">
                          <div className="flex items-center justify-between border-b-[3px] border-black pb-3">
                            <span className="text-sm font-black text-black uppercase tracking-wider">
                              Buat Record Baru
                            </span>
                            <span className="text-[10px] text-black font-black uppercase bg-yellow-200 border-2 border-black px-2 py-0.5">
                              Zona: {manageSubdomain}.{manageDomain}
                            </span>
                          </div>

                          {addRecordError && (
                            <div className="bg-red-400 border-[3px] border-black text-black p-3.5 rounded-lg flex items-start gap-2 text-xs font-bold shadow-[4px_4px_0_0_#000]">
                              <AlertCircle className="h-5 w-5 text-black shrink-0 mt-0.5 stroke-[3]" />
                              <span>{addRecordError}</span>
                            </div>
                          )}

                          <form
                            onSubmit={handleAddRecord}
                            className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end"
                          >
                            {/* Type */}
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[11px] font-black text-black block uppercase">
                                Type
                              </label>
                              <select
                                className="w-full neo-input bg-yellow-200 hover:bg-yellow-300 px-2 py-2.5 text-xs font-black outline-none text-black transition-colors cursor-pointer"
                                value={newRecType}
                                onChange={(e) => {
                                  setNewRecType(e.target.value);
                                  setAddRecordError("");
                                }}
                              >
                                {ALL_DNS_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Name */}
                            <div className="space-y-1.5 md:col-span-3">
                              <label className="text-[11px] font-black text-black block uppercase">
                                Name (Host)
                              </label>
                              <div className="flex items-center neo-input bg-white pr-3 overflow-hidden">
                                <input
                                  type="text"
                                  required
                                  placeholder="contoh: halo / @ "
                                  className="w-full py-2 px-3 text-xs font-black focus:outline-none text-black bg-transparent placeholder-gray-400"
                                  value={newRecName}
                                  onChange={(e) =>
                                    setNewRecName(e.target.value.toLowerCase())
                                  }
                                />
                                <span className="text-gray-800 font-bold text-[10px] shrink-0">
                                  .{manageSubdomain}.{manageDomain}...
                                </span>
                              </div>
                            </div>

                            {/* IPv4 / Target */}
                            <div className="space-y-1.5 md:col-span-4">
                              <label className="text-[11px] font-black text-black block uppercase">
                                {newRecType === "A" && "IPv4 Address"}
                                {newRecType === "AAAA" && "IPv6 Address"}
                                {newRecType === "CNAME" && "Target Domain"}
                                {newRecType === "TXT" && "TXT Content"}
                                {newRecType === "MX" && "Mail Server Domain"}
                                {newRecType === "NS" && "Nameserver Server"}
                                {newRecType === "SPF" && "SPF Content"}
                                {PROXIED_TYPES.includes(newRecType) === false &&
                                  !["TXT", "MX", "NS", "SPF"].includes(
                                    newRecType,
                                  ) &&
                                  "Data Content"}
                              </label>
                              <input
                                type="text"
                                required
                                placeholder={
                                  newRecType === "A"
                                    ? "e.g. 103.111.42.1"
                                    : newRecType === "AAAA"
                                      ? "e.g. 2001:db8::1"
                                      : newRecType === "CNAME"
                                        ? "e.g. app.vercel.app"
                                        : newRecType === "TXT" ||
                                            newRecType === "SPF"
                                          ? "e.g. v=spf1 include:_spf.google.com ~all"
                                          : newRecType === "MX"
                                            ? "mail.server.com"
                                            : newRecType === "NS"
                                              ? "ns1.server.com"
                                              : "Raw data/content"
                                }
                                className="w-full neo-input px-3 py-2 text-xs font-mono outline-none text-black bg-white"
                                value={newRecContent}
                                onChange={(e) =>
                                  setNewRecContent(e.target.value)
                                }
                              />
                            </div>

                            {/* TTL */}
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[11px] font-black text-black block uppercase">
                                TTL
                              </label>
                              <select
                                className="w-full neo-input bg-white px-2 py-2.5 text-xs font-black outline-none text-black transition-colors cursor-pointer"
                                value={newRecTtl}
                                onChange={(e) =>
                                  setNewRecTtl(Number(e.target.value))
                                }
                              >
                                <option value={1}>Auto</option>
                                <option value={60}>1 Menit</option>
                                <option value={300}>5 Menit</option>
                                <option value={1800}>30 Menit</option>
                                <option value={3600}>1 Jam</option>
                                <option value={86400}>24 Jam</option>
                              </select>
                            </div>

                            {/* MX Priority if MX */}
                            {newRecType === "MX" && (
                              <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[11px] font-black text-black block uppercase">
                                  Priority
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="65535"
                                  className="w-full neo-input bg-white px-3 py-2 text-xs font-black outline-none text-black"
                                  value={newRecPriority}
                                  onChange={(e) =>
                                    setNewRecPriority(Number(e.target.value))
                                  }
                                />
                              </div>
                            )}

                            {/* Save Actions Button */}
                            <div className="md:col-span-1 border-t-[3px] border-black border-dashed md:border-none pt-3 md:pt-0">
                              <button
                                type="submit"
                                disabled={addingRecord}
                                className="w-full bg-cyan-400 hover:bg-cyan-500 disabled:bg-gray-300 text-black font-black uppercase text-xs py-2.5 px-3 rounded-md transition-all border-[3px] border-black shadow-[4px_4px_0_0_#000] hover:-translate-y-0.5 active:shadow-none active:translate-y-[4px] flex items-center justify-center cursor-pointer"
                                title="Klik untuk menyimpan record DNS ini"
                              >
                                {addingRecord ? (
                                  <RefreshCw className="h-4 w-4 animate-spin stroke-[3]" />
                                ) : (
                                  <span>Simpan</span>
                                )}
                              </button>
                            </div>
                          </form>

                          {/* Proxied toggle description block */}
                          {PROXIED_TYPES.includes(newRecType) && (
                            <div className="mt-2 bg-pink-200 border-[3px] border-black text-black rounded-lg p-4 flex flex-col sm:flex-row items-center gap-4 sm:justify-between shadow-[4px_4px_0_0_#000]">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-1.5 border-2 border-black rounded-sm shrink-0 ${newRecProxied ? "bg-amber-400 text-black" : "bg-white text-gray-500"}`}
                                >
                                  <Cloud className="h-5 w-5 stroke-[2.5]" />
                                </div>
                                <div>
                                  <span className="text-xs font-black uppercase tracking-wide text-black block">
                                    Proxy Status & Pelindung CDN
                                  </span>
                                  <span className="text-[10px] text-gray-800 font-bold block leading-tight">
                                    {newRecProxied
                                      ? "Terhubung ke proxy Cloudflare: server dilindungi, caching aktif (hanya IP resolusi HTTP/S)."
                                      : "Bypass langsung: Hanya resolusi nama host bypass (DNS-only)."}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setNewRecProxied(!newRecProxied)}
                                className={`w-12 h-6 shrink-0 flex items-center rounded-full p-0.5 cursor-pointer transition-colors border-2 border-black ${
                                  newRecProxied ? "bg-amber-400" : "bg-white"
                                }`}
                              >
                                <div
                                  className={`border-2 border-black bg-white w-5 h-5 rounded-full shadow-[2px_2px_0_0_#000] transform transition-transform ${
                                    newRecProxied
                                      ? "translate-x-5"
                                      : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          )}

                          <p className="text-[10px] text-gray-800 font-bold leading-normal border-l-[3px] border-black pl-3 ml-1">
                            *Gunakan <strong className="text-black">@</strong>{" "}
                            untuk memetakan langsung subdomain utama Anda{" "}
                            <code className="bg-white px-1 py-0.5 rounded-sm border-2 border-black font-mono font-black text-black">
                              {manageSubdomain}.{manageDomain}
                            </code>
                            . Misalnya, masukan nama{" "}
                            <strong className="text-black">blog</strong> akan
                            menciptakan rekor{" "}
                            <code className="bg-white px-1 py-0.5 rounded-sm border-2 border-black font-mono text-black">
                              blog.{manageSubdomain}.{manageDomain}
                            </code>
                            .
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Filter, Searching and Summary Information Belt */}
                    <div className="p-4 sm:p-6 bg-pink-200 border-b-[4px] border-black flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Input searching */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                        <div className="flex items-center neo-input bg-white pl-3 hover:-translate-y-0.5 active:translate-y-0 transition-transform flex-1 max-w-md">
                          <Search className="h-5 w-5 text-black mr-2 shrink-0 stroke-[3]" />
                          <input
                            type="text"
                            placeholder="Cari DNS record berdasarkan nama atau isi tujuan..."
                            className="w-full py-2.5 pr-3 focus:outline-none text-xs font-black text-black bg-transparent placeholder-gray-400"
                            value={filterQuery}
                            onChange={(e) => setFilterQuery(e.target.value)}
                          />
                          {filterQuery && (
                            <button
                              type="button"
                              onClick={() => setFilterQuery("")}
                              className="p-1 px-2.5 font-bold text-black hover:bg-yellow-200 uppercase text-xs shrink-0 border-l-[3px] border-black h-full"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Mid: Filter Selector badges */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0 border-[3px] border-black bg-white p-1 rounded-sm shadow-[3px_3px_0_0_#000]">
                          <span className="text-[10px] uppercase text-black font-black tracking-wider px-2 hidden sm:inline">
                            Tipe:
                          </span>
                          <div className="inline-flex">
                            {["ALL", ...ALL_DNS_TYPES].map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setFilterType(opt)}
                                className={`px-3 py-1 text-[10px] font-black rounded-sm uppercase tracking-wider transition-all cursor-pointer border-2 border-transparent ${
                                  filterType === opt
                                    ? "bg-yellow-300 text-black border-black border-2"
                                    : "text-gray-600 hover:text-black hover:bg-gray-200"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right: counter display badge */}
                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0 text-black text-xs font-black uppercase">
                        <span>Menampilkan</span>
                        <span className="bg-white border-2 border-black text-black font-black px-2 py-0.5 rounded-sm text-[10px] font-mono shadow-[2px_2px_0_0_#000]">
                          {
                            records.filter((record) => {
                              const matchesQuery =
                                record.name
                                  .toLowerCase()
                                  .includes(filterQuery.toLowerCase()) ||
                                record.content
                                  .toLowerCase()
                                  .includes(filterQuery.toLowerCase());
                              const matchesType =
                                filterType === "ALL" ||
                                record.type.toUpperCase() ===
                                  filterType.toUpperCase();
                              return matchesQuery && matchesType;
                            }).length
                          }{" "}
                          / {records.length}
                        </span>
                        <span>DNS records</span>
                      </div>
                    </div>

                    {/* Table View of cloudflare dns records */}
                    {recordsError && (
                      <div className="m-6 bg-red-50 border border-red-150 text-red-800 p-4 rounded-xl flex items-start gap-2.5 text-xs">
                        <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <span>{recordsError}</span>
                      </div>
                    )}

                    {recordsLoading && records.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
                        <RefreshCw className="h-8 w-8 animate-spin text-[#0051c3]" />
                        <span className="text-sm font-semibold tracking-wide">
                          Menghubungi Cloudflare API Sync...
                        </span>
                      </div>
                    ) : records.length === 0 ? (
                      <div className="m-6 flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-4 text-center px-4">
                        <div className="p-4 bg-white border border-slate-100 rounded-full text-slate-400 shadow-xs animate-bounce-slow">
                          <Cloud className="h-10 w-10 stroke-[1.5]" />
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-800 block text-sm">
                            Gagal Sinkronisasi atau Belum Ada DNS Record
                          </span>
                          <span className="text-xs text-slate-400 max-w-xs block mx-auto mt-1 leading-normal">
                            Gunakan tombol{" "}
                            <strong className="text-slate-600">
                              Add Record
                            </strong>{" "}
                            di atas untuk menambahkan entri record DNS baru
                            untuk domain Anda.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        id="cloudflare-table"
                        className="overflow-x-auto w-full min-w-0 bg-white"
                      >
                        <table className="min-w-[890px] md:min-w-full divide-y-[3px] divide-black align-middle table-fixed">
                          <thead>
                            <tr className="bg-cyan-200 border-b-[4px] border-black text-left text-[11px] uppercase font-black text-black tracking-wider">
                              <th className="py-4 px-4 w-[90px] md:w-[100px] border-r-[3px] border-black">
                                Type
                              </th>
                              <th className="py-4 px-4 w-[160px] md:w-[180px] border-r-[3px] border-black">
                                Name
                              </th>
                              <th className="py-4 px-4 w-[200px] md:w-[280px] border-r-[3px] border-black">
                                Content
                              </th>
                              <th className="py-4 px-4 w-[120px] md:w-[140px] text-center border-r-[3px] border-black">
                                ProxyStatus
                              </th>
                              <th className="py-4 px-4 w-[90px] md:w-[100px] text-center border-r-[3px] border-black">
                                TTL
                              </th>
                              <th className="py-4 px-4 w-[120px] md:w-[130px] text-center border-r-[3px] border-black">
                                Cek Live
                              </th>
                              <th className="py-4 px-4 w-[110px] text-right">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-[3px] divide-black text-xs text-black bg-white">
                            {records
                              .filter((record) => {
                                const matchesQuery =
                                  record.name
                                    .toLowerCase()
                                    .includes(filterQuery.toLowerCase()) ||
                                  record.content
                                    .toLowerCase()
                                    .includes(filterQuery.toLowerCase());
                                const matchesType =
                                  filterType === "ALL" ||
                                  record.type.toUpperCase() ===
                                    filterType.toUpperCase();
                                return matchesQuery && matchesType;
                              })
                              .map((record) => {
                                const isEditingThisRecord =
                                  editingRecordId === record.id;

                                if (isEditingThisRecord) {
                                  {
                                    /* --- INLINE EDITING FORM FOR RECORD ROW --- */
                                  }
                                  return (
                                    <tr
                                      key={record.id}
                                      className="bg-yellow-200 border-y-[3px] border-black animate-fadeIn font-black"
                                    >
                                      {/* Type */}
                                      <td className="py-4 px-4 align-middle border-r-[3px] border-black">
                                        <select
                                          value={editRecType}
                                          onChange={(e) =>
                                            setEditRecType(e.target.value)
                                          }
                                          className="w-full neo-input bg-white p-1.5 focus:ring-0 text-black text-xs cursor-pointer"
                                        >
                                          {ALL_DNS_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                              {t}
                                            </option>
                                          ))}
                                        </select>
                                      </td>

                                      {/* Name */}
                                      <td className="py-4 px-4 align-middle border-r-[3px] border-black">
                                        <div className="flex items-center neo-input bg-white pr-2 overflow-hidden">
                                          <input
                                            type="text"
                                            value={editRecName}
                                            onChange={(e) =>
                                              setEditRecName(e.target.value)
                                            }
                                            className="w-full py-1.5 px-2 bg-transparent focus:outline-none focus:ring-0 font-black text-xs text-black placeholder-gray-400"
                                            placeholder="@"
                                          />
                                          <span className="text-gray-800 font-black text-[9px] shrink-0 font-mono">
                                            ..
                                          </span>
                                        </div>
                                      </td>

                                      {/* Content */}
                                      <td className="py-4 px-4 align-middle border-r-[3px] border-black">
                                        <div className="flex flex-col gap-1 w-full min-w-0">
                                          <input
                                            type="text"
                                            value={editRecContent}
                                            onChange={(e) =>
                                              setEditRecContent(e.target.value)
                                            }
                                            className="w-full neo-input py-1.5 px-2 bg-white font-mono text-xs focus:ring-0 text-black placeholder-gray-400"
                                            placeholder="Value / Server IP / Target"
                                          />
                                          {editRecType === "MX" && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                              <span className="text-[10px] text-black font-black uppercase">
                                                Priority:
                                              </span>
                                              <input
                                                type="number"
                                                min="0"
                                                className="w-16 neo-input bg-white px-1.5 py-0.5 text-xs text-black focus:ring-0"
                                                value={editRecPriority}
                                                onChange={(e) =>
                                                  setEditRecPriority(
                                                    Number(e.target.value),
                                                  )
                                                }
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </td>

                                      {/* Proxy status */}
                                      <td className="py-4 px-4 align-middle text-center border-r-[3px] border-black">
                                        {PROXIED_TYPES.includes(editRecType) ? (
                                          <div className="flex flex-col items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditRecProxied(
                                                  !editRecProxied,
                                                )
                                              }
                                              className={`w-12 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors border-2 border-black ${
                                                editRecProxied
                                                  ? "bg-amber-400"
                                                  : "bg-white"
                                              }`}
                                            >
                                              <div
                                                className={`bg-white border-2 border-black w-5 h-5 rounded-full shadow-[2px_2px_0_0_#000] transform transition-transform ${
                                                  editRecProxied
                                                    ? "translate-x-5"
                                                    : "translate-x-0"
                                                }`}
                                              />
                                            </button>
                                            <span className="text-[9px] font-black text-black tracking-wide uppercase">
                                              {editRecProxied
                                                ? "Proxied"
                                                : "DNS Only"}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-black font-bold uppercase text-[10px] bg-white border-2 border-dashed border-black px-1.5 py-0.5">
                                            Not Supported
                                          </span>
                                        )}
                                      </td>

                                      {/* TTL */}
                                      <td className="py-4 px-4 align-middle text-center border-r-[3px] border-black">
                                        <select
                                          value={editRecTtl}
                                          onChange={(e) =>
                                            setEditRecTtl(
                                              Number(e.target.value),
                                            )
                                          }
                                          className="neo-input bg-white p-1.5 focus:ring-0 text-black text-xs outline-none max-w-[80px] mx-auto block cursor-pointer"
                                        >
                                          <option value={1}>Auto</option>
                                          <option value={60}>1 min</option>
                                          <option value={300}>5 min</option>
                                          <option value={1800}>30 min</option>
                                          <option value={3600}>1 hr</option>
                                          <option value={86400}>24 hr</option>
                                        </select>
                                      </td>

                                      {/* Gap spacer for propagation check cells */}
                                      <td className="py-4 px-4 align-middle text-center text-black font-black uppercase text-[10px] border-r-[3px] border-black bg-pink-200 border-y-[3px] border-y-black">
                                        Menunggu...
                                      </td>

                                      {/* Save and Cancel trigger cells */}
                                      <td className="py-4 px-4 align-middle text-right bg-white">
                                        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdateRecord(record.id)
                                            }
                                            disabled={updatingRecord}
                                            className="px-2.5 py-1.5 w-full sm:w-auto bg-cyan-400 hover:bg-cyan-500 text-black font-black uppercase rounded-sm text-[10px] flex items-center justify-center gap-1 border-2 border-black shadow-[3px_3px_0_0_#000] active:shadow-none hover:-translate-y-[2px] active:translate-y-0 transition-all cursor-pointer"
                                            title="Konfirmasi pembaruan record"
                                          >
                                            {updatingRecord ? (
                                              <RefreshCw className="h-3 w-3 animate-spin stroke-[3]" />
                                            ) : (
                                              <>
                                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                <span>Save</span>
                                              </>
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingRecordId(null)
                                            }
                                            className="px-2.5 py-1.5 w-full sm:w-auto bg-white border-2 border-black hover:bg-gray-100 text-black font-black uppercase rounded-sm text-[10px] flex items-center justify-center gap-1 shadow-[3px_3px_0_0_#000] active:shadow-none hover:-translate-y-[2px] active:translate-y-0 transition-all cursor-pointer"
                                            title="Batalkan perubahan"
                                          >
                                            <X className="h-3.5 w-3.5 stroke-[3]" />
                                            <span>Batal</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                {
                                  /* --- STANDARD STATIC CLOUDFLARE ROW DISPLAY --- */
                                }
                                return (
                                  <tr
                                    key={record.id}
                                    className="hover:bg-yellow-100 border-b-[3px] border-black transition-colors group"
                                  >
                                    {/* Type Tag */}
                                    <td className="py-3 px-4 align-middle border-r-[3px] border-black font-black">
                                      <span
                                        className={`inline-block text-[11px] font-black px-2 py-1 rounded-sm uppercase tracking-wider text-center min-w-[55px] border-2 border-black shadow-[2px_2px_0_0_#000] text-black ${
                                          record.type === "A"
                                            ? "bg-amber-300"
                                            : record.type === "AAAA"
                                              ? "bg-sky-300"
                                              : record.type === "CNAME"
                                                ? "bg-emerald-300"
                                                : record.type === "TXT"
                                                  ? "bg-purple-300"
                                                  : record.type === "SRV"
                                                    ? "bg-indigo-300"
                                                    : record.type === "NS"
                                                      ? "bg-red-300"
                                                      : "bg-pink-300"
                                        }`}
                                      >
                                        {record.type}
                                      </span>
                                    </td>

                                    {/* Subdomain Name with Small Cloudflare Detail */}
                                    <td
                                      className="py-3 px-4 align-middle font-black text-black truncate border-r-[3px] border-black"
                                      title={record.name}
                                    >
                                      <span className="text-black bg-white px-1 border-2 border-black mr-1 py-0.5">
                                        {record.name.endsWith(
                                          `.${manageSubdomain}.${manageDomain}`,
                                        )
                                          ? record.name.slice(
                                              0,
                                              -`.${manageSubdomain}.${manageDomain}`
                                                .length,
                                            ) || "@"
                                          : record.name ===
                                              `${manageSubdomain}.${manageDomain}`
                                            ? "@"
                                            : record.name}
                                      </span>
                                      <span className="text-gray-700 font-black text-[9px] uppercase">
                                        .{manageSubdomain}.${manageDomain}
                                      </span>
                                    </td>

                                    {/* Value destination text */}
                                    <td
                                      className="py-3 px-4 align-middle font-mono font-bold text-black truncate text-[11px] border-r-[3px] border-black"
                                      title={record.content}
                                    >
                                      {record.type === "MX" &&
                                      record.priority !== undefined ? (
                                        <span className="bg-indigo-300 border-2 border-black text-black px-1.5 py-0.5 rounded-sm font-sans text-[9px] mr-1 w-fit font-black uppercase">
                                          Prio {record.priority}
                                        </span>
                                      ) : null}
                                      {record.content}
                                    </td>

                                    {/* Double Cloud Indicator Badge styling */}
                                    <td className="py-3 px-4 align-middle text-center border-r-[3px] border-black">
                                      {record.proxied ? (
                                        <div className="inline-flex items-center gap-1 text-black bg-amber-400 border-2 border-black px-2 py-0.5 rounded-sm text-[9px] font-black tracking-wide uppercase shadow-[2px_2px_0_0_#000]">
                                          <Cloud className="h-3 w-3 fill-white stroke-black stroke-[3] shrink-0" />
                                          <span>Proxied</span>
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1 text-black bg-gray-200 border-2 border-black px-2 py-0.5 rounded-sm text-[9px] font-black tracking-wide uppercase shadow-[2px_2px_0_0_#000]">
                                          <Cloud className="h-3 w-3 text-black stroke-[3] shrink-0" />
                                          <span>DNS only</span>
                                        </div>
                                      )}
                                    </td>

                                    {/* TTL rendering translation */}
                                    <td className="py-3 px-4 align-middle text-center font-black text-black text-[11px] border-r-[3px] border-black uppercase">
                                      {record.ttl === 1
                                        ? "Auto"
                                        : record.ttl >= 3600
                                          ? `${record.ttl / 3600} hr`
                                          : `${record.ttl / 60} min`}
                                    </td>

                                    {/* DNS check live button */}
                                    <td className="py-3 px-4 align-middle text-center border-r-[3px] border-black">
                                      {dnsStatuses[record.id] ? (
                                        dnsStatuses[record.id].loading ? (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-black uppercase bg-yellow-200 px-2 py-0.5 border-2 border-black">
                                            <RefreshCw className="h-2.5 w-2.5 animate-spin stroke-[3]" />
                                            Cek...
                                          </span>
                                        ) : dnsStatuses[record.id].resolved ? (
                                          <div className="flex flex-col items-center justify-center gap-0.5">
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black border-2 border-black text-black bg-emerald-400 px-1.5 py-0.5 uppercase tracking-wide">
                                              <span className="w-1 h-1 bg-black rounded-full animate-ping"></span>
                                              Aktif
                                            </span>
                                            <span
                                              className="text-[8px] font-black text-black font-mono truncate max-w-[80px] bg-white border-2 border-black px-1"
                                              title={dnsStatuses[
                                                record.id
                                              ].values?.join(", ")}
                                            >
                                              {
                                                dnsStatuses[record.id]
                                                  .values?.[0]
                                              }
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center gap-0.5">
                                            <span className="inline-flex items-center gap-1 text-[8px] font-black bg-red-400 border-2 border-black text-black px-1 py-0.5 uppercase tracking-wide">
                                              Gagal
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                checkDnsPropagation(
                                                  record.name,
                                                  record.type,
                                                  record.id,
                                                )
                                              }
                                              className="text-[8px] text-black hover:underline font-black cursor-pointer uppercase bg-yellow-200 border-2 border-black px-1"
                                            >
                                              Cek lagi
                                            </button>
                                          </div>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            checkDnsPropagation(
                                              record.name,
                                              record.type,
                                              record.id,
                                            )
                                          }
                                          className="text-[10px] uppercase text-black bg-cyan-300 border-2 border-black px-2 py-0.5 rounded-sm font-black flex items-center justify-center mx-auto shadow-[2px_2px_0_0_#000] active:shadow-none hover:-translate-y-[1px] active:translate-y-0 transition-all cursor-pointer"
                                        >
                                          Cek Live
                                        </button>
                                      )}
                                    </td>

                                    {/* Action items: edit & delete */}
                                    <td className="py-3 px-4 align-middle text-right">
                                      <div className="flex items-center justify-end gap-1.5 opacity-85 group-hover:opacity-100 transition-opacity">
                                        <button
                                          type="button"
                                          onClick={() => startEditing(record)}
                                          className="p-1.5 bg-yellow-300 border-2 border-black hover:-translate-y-[2px] active:translate-y-0 text-black rounded-sm transition-all cursor-pointer shadow-[2px_2px_0_0_#000] active:shadow-none"
                                          title="Edit DNS record ini secara langsung"
                                        >
                                          <Pencil className="h-3.5 w-3.5 stroke-[3]" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            copyToClipboard(
                                              record.content,
                                              record.id,
                                            )
                                          }
                                          className="p-1.5 bg-cyan-300 border-2 border-black hover:-translate-y-[2px] active:translate-y-0 text-black rounded-sm transition-all cursor-pointer shadow-[2px_2px_0_0_#000] active:shadow-none"
                                          title="Salin data isi record"
                                        >
                                          {copyStatus[record.id] ? (
                                            <Check className="h-3.5 w-3.5 text-black stroke-[3]" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5 stroke-[3]" />
                                          )}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteRecord(record.id)
                                          }
                                          className="p-1.5 bg-red-400 border-2 border-black hover:-translate-y-[2px] active:translate-y-0 text-black rounded-sm transition-all cursor-pointer shadow-[2px_2px_0_0_#000] active:shadow-none"
                                          title="Hapus record DNS permanen"
                                        >
                                          <Trash2 className="h-3.5 w-3.5 stroke-[3]" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Segment */}
      <footer className="bg-yellow-400 border-t-[4px] border-black py-8 mt-12 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left relative z-10 w-full">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white border-2 border-black text-black rounded-sm shadow-[2px_2px_0_0_#000]">
              <Globe className="h-5 w-5 stroke-[3]" />
            </div>
            <span className="text-xs sm:text-sm text-black font-black uppercase">
              CMNTY Domains — Free subdomain & DNS record powered by Cloudflare
            </span>
          </div>
        </div>

        {/* Background Decorative */}
        <div className="absolute -bottom-10 -right-10 opacity-10 pointer-events-none">
          <Zap className="w-64 h-64 text-black stroke-[3]" />
        </div>
      </footer>
    </div>
  );
}
