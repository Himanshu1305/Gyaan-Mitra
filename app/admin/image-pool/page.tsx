"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import { useAuth } from "@/lib/auth-context";

interface DiagramTopic {
  id: number;
  topic_key: string;
  topic_name: string;
  subject: string;
  class_number: number;
  chapter_number: number;
  chapter_name: string;
  question_types: string[];
  keywords: string[];
  image_count: number;
}

interface DiagramImage {
  id: number;
  topic_key: string;
  image_url: string;
  source_url: string;
  variant: string;
  license: string | null;
  usage_count: number;
}

interface MissingLog {
  id: number;
  topic_key: string;
  topic_name: string;
  class_number: number;
  subject: string;
  chapter_number: number;
  request_count: number;
  last_requested_at: string;
}

function dotColor(count: number): string {
  if (count === 0) return "bg-red-500";
  if (count <= 2) return "bg-yellow-400";
  return "bg-green-500";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ImagePoolPage() {
  const router = useRouter();
  const { user, session, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<"pool" | "missing">("pool");
  const [topics, setTopics] = useState<DiagramTopic[]>([]);
  const [missing, setMissing] = useState<MissingLog[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<DiagramTopic | null>(null);
  const [topicImages, setTopicImages] = useState<DiagramImage[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [addForm, setAddForm] = useState({ image_url: "", source_url: "", variant: "labeled", license: "" });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    if (user.email !== "usdvisionai@gmail.com") { router.push("/dashboard"); return; }
    loadTopics();
    loadMissing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  function token() {
    return session?.access_token ?? "";
  }

  async function loadTopics() {
    setDataLoading(true);
    const res = await fetch("/api/admin/image-pool?action=topics", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const json = await res.json();
    setTopics(json.topics ?? []);
    setDataLoading(false);
  }

  async function loadMissing() {
    const res = await fetch("/api/admin/image-pool?action=missing", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const json = await res.json();
    setMissing(json.missing ?? []);
  }

  async function loadTopicImages(topicKey: string) {
    setImagesLoading(true);
    setTopicImages([]);
    const res = await fetch(`/api/admin/image-pool?action=images&topic_key=${encodeURIComponent(topicKey)}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const json = await res.json();
    setTopicImages(json.images ?? []);
    setImagesLoading(false);
  }

  function selectTopic(topic: DiagramTopic) {
    setSelectedTopic(topic);
    setAddForm({ image_url: "", source_url: "", variant: "labeled", license: "" });
    setAddError("");
    loadTopicImages(topic.topic_key);
  }

  async function handleAddImage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTopic) return;
    setAddError("");
    setAddLoading(true);
    const res = await fetch("/api/admin/image-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({
        action: "add_image",
        topic_key: selectedTopic.topic_key,
        image_url: addForm.image_url.trim(),
        source_url: addForm.source_url.trim(),
        variant: addForm.variant,
        license: addForm.license.trim() || null,
      }),
    });
    const json = await res.json();
    setAddLoading(false);
    if (json.error) { setAddError(json.error); return; }
    setAddForm({ image_url: "", source_url: "", variant: "labeled", license: "" });
    await loadTopicImages(selectedTopic.topic_key);
    await loadTopics();
  }

  async function handleRemoveImage(imageId: number) {
    if (!confirm("Remove this image from the pool?")) return;
    setRemoveLoading(imageId);
    await fetch("/api/admin/image-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ action: "remove_image", image_id: imageId }),
    });
    setRemoveLoading(null);
    if (selectedTopic) await loadTopicImages(selectedTopic.topic_key);
    await loadTopics();
  }

  const topicsWithZero = topics.filter(t => t.image_count === 0).length;
  const topicsWithFew = topics.filter(t => t.image_count >= 1 && t.image_count <= 2).length;
  const topicsWithGood = topics.filter(t => t.image_count >= 3).length;

  const byChapter: Record<string, DiagramTopic[]> = {};
  for (const t of topics) {
    const key = `${t.chapter_number}|||${t.chapter_name}`;
    if (!byChapter[key]) byChapter[key] = [];
    byChapter[key].push(t);
  }

  if (loading) return <div>Loading...</div>;
  if (!user || user.email !== "usdvisionai@gmail.com") return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-1 py-10 px-4">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold" style={{ color: "#1B3A6B" }}>Image Pool</h1>
              <p className="mt-1 text-sm text-gray-500">Manage diagram images for exam paper generation</p>
            </div>
            <a href="/admin" className="text-sm font-semibold text-gray-500 hover:text-gray-800">
              ← Admin Dashboard
            </a>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200">
            {(["pool", "missing"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[#1B3A6B] text-[#1B3A6B]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "pool"
                  ? "Image Pool"
                  : `Missing Diagrams${missing.length ? ` (${missing.length})` : ""}`}
              </button>
            ))}
          </div>

          {/* ── TAB: Image Pool ── */}
          {activeTab === "pool" && (
            <>
              {/* Stats bar */}
              {!dataLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-2xl font-extrabold text-gray-800">{topics.length}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Total Topics</div>
                  </div>
                  <div className="rounded-xl border bg-green-50 border-green-200 p-4">
                    <div className="text-2xl font-extrabold text-green-700">{topicsWithGood}</div>
                    <div className="text-xs text-green-600 mt-0.5">3+ images</div>
                  </div>
                  <div className="rounded-xl border bg-yellow-50 border-yellow-200 p-4">
                    <div className="text-2xl font-extrabold text-yellow-700">{topicsWithFew}</div>
                    <div className="text-xs text-yellow-600 mt-0.5">1–2 images</div>
                  </div>
                  <div className="rounded-xl border bg-red-50 border-red-200 p-4">
                    <div className="text-2xl font-extrabold text-red-700">{topicsWithZero}</div>
                    <div className="text-xs text-red-600 mt-0.5">0 images — needs content</div>
                  </div>
                </div>
              )}

              {/* Two-panel layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Left: topic list */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-y-auto max-h-[700px]">
                  {dataLoading ? (
                    <div className="p-4 space-y-2 animate-pulse">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-8 bg-gray-100 rounded" />
                      ))}
                    </div>
                  ) : (
                    Object.entries(byChapter)
                      .sort(([a], [b]) => {
                        const na = parseInt(a.split("|||")[0], 10);
                        const nb = parseInt(b.split("|||")[0], 10);
                        return na - nb;
                      })
                      .map(([key, chTopics]) => {
                        const [chNum, chName] = key.split("|||");
                        return (
                          <div key={key}>
                            <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 z-10">
                              Ch. {chNum} · {chName}
                            </div>
                            {chTopics.map(topic => (
                              <button
                                key={topic.topic_key}
                                onClick={() => selectTopic(topic)}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-gray-50 hover:bg-blue-50/50 transition-colors ${
                                  selectedTopic?.topic_key === topic.topic_key ? "bg-blue-50" : ""
                                }`}
                              >
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor(topic.image_count)}`} />
                                <span className="flex-1 text-sm font-medium text-gray-700 truncate">{topic.topic_name}</span>
                                <span className="text-xs text-gray-400 flex-shrink-0">{topic.image_count}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Right: detail panel */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  {!selectedTopic ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                      <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">Select a topic to manage its images</p>
                    </div>
                  ) : (
                    <div className="space-y-6">

                      {/* Topic header */}
                      <div>
                        <h2 className="text-lg font-bold" style={{ color: "#1B3A6B" }}>{selectedTopic.topic_name}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Class {selectedTopic.class_number} · {selectedTopic.subject} · Ch. {selectedTopic.chapter_number}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {selectedTopic.question_types.map(qt => (
                            <span key={qt} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{qt}</span>
                          ))}
                        </div>
                      </div>

                      {/* Image grid */}
                      {imagesLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                          {[1, 2, 3].map(i => <div key={i} className="aspect-[4/3] bg-gray-100 rounded-xl" />)}
                        </div>
                      ) : topicImages.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm">
                          No images yet — add one below
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {topicImages.map(img => (
                            <div key={img.id} className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.image_url}
                                alt={img.variant}
                                className="w-full aspect-[4/3] object-contain p-2"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect width='200' height='150' fill='%23f3f4f6'/%3E%3Ctext x='100' y='75' text-anchor='middle' fill='%239ca3af' font-size='12'%3EImage unavailable%3C/text%3E%3C/svg%3E";
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-white font-medium">{img.variant}</span>
                                  <span className="text-xs text-white/70">{img.usage_count}x used</span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveImage(img.id)}
                                disabled={removeLoading === img.id}
                                title="Remove image"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold leading-none"
                              >
                                {removeLoading === img.id ? "…" : "×"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add image form */}
                      <div className="border-t border-gray-100 pt-5">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">Add New Image</h3>
                        <form onSubmit={handleAddImage} className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Image URL *</label>
                            <input
                              type="url"
                              value={addForm.image_url}
                              onChange={e => setAddForm(f => ({ ...f, image_url: e.target.value }))}
                              placeholder="https://upload.wikimedia.org/..."
                              required
                              className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
                            />
                            {addForm.image_url && (
                              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 max-h-48 overflow-hidden flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={addForm.image_url} alt="Preview" className="max-h-44 object-contain" />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Source URL *</label>
                            <input
                              type="url"
                              value={addForm.source_url}
                              onChange={e => setAddForm(f => ({ ...f, source_url: e.target.value }))}
                              placeholder="https://commons.wikimedia.org/wiki/..."
                              required
                              className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Variant *</label>
                              <select
                                value={addForm.variant}
                                onChange={e => setAddForm(f => ({ ...f, variant: e.target.value }))}
                                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
                              >
                                <option value="labeled">labeled</option>
                                <option value="unlabeled">unlabeled</option>
                                <option value="numbered">numbered</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">License</label>
                              <input
                                type="text"
                                value={addForm.license}
                                onChange={e => setAddForm(f => ({ ...f, license: e.target.value }))}
                                placeholder="CC BY-SA 4.0"
                                className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]/30"
                              />
                            </div>
                          </div>

                          {addError && <p className="text-xs text-red-500">{addError}</p>}

                          <button
                            type="submit"
                            disabled={addLoading}
                            className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: "#1B3A6B" }}
                          >
                            {addLoading ? "Adding…" : "Add to Pool"}
                          </button>
                        </form>
                      </div>

                    </div>
                  )}
                </div>

              </div>
            </>
          )}

          {/* ── TAB: Missing Diagrams ── */}
          {activeTab === "missing" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {missing.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  No missing diagram requests yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic Key</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Chapter</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Requests</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Seen</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Search</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {missing.map(row => (
                        <tr key={row.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.topic_key}</td>
                          <td className="px-4 py-3 text-gray-600">{row.class_number}</td>
                          <td className="px-4 py-3 text-gray-600">{row.subject}</td>
                          <td className="px-4 py-3 text-gray-600">{row.chapter_number}</td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${row.request_count > 5 ? "text-red-600" : "text-gray-700"}`}>
                              {row.request_count}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{relativeTime(row.last_requested_at)}</td>
                          <td className="px-4 py-3">
                            <a
                              href={`https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(row.topic_key.replace(/_/g, " "))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                              Wikimedia ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <Footer />
    </div>
  );
}
