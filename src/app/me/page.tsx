"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Pencil, Trash2, Plus, LogOut, Save, Eye, EyeOff, Bold, Italic, Code, Link2, List, Heading, Quote, Upload, Copy, X } from "lucide-react";
import { marked } from "marked";

type Item = {
  id: string;
  category: string;
  title: string;
  description: string;
  year: number;
  tech: string[];
  link?: string;
  repo?: string;
  live?: string;
  notes?: string;
  sort_order: number;
};

type RawItem = Omit<Item, "tech"> & { tech: string };

type SiteConfig = {
  description: string[];
  socials: Record<string, string>;
};

type ArticleData = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  banner_url: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type RawArticle = Omit<ArticleData, "tags" | "published"> & { tags: string; published: number };

type UploadMeta = {
  id: string;
  filename: string;
  mime_type: string;
  created_at: string;
};

const TABS = [
  { key: "articles", label: "Articles" },
  { key: "projects", label: "Projects" },
  { key: "hobbies", label: "Hobbies" },
  { key: "in-development", label: "In Development" },
  { key: "site-config", label: "Site Config" },
] as const;

function parseItem(raw: RawItem): Item {
  return { ...raw, tech: JSON.parse(raw.tech) };
}

function parseArticle(raw: RawArticle): ArticleData {
  return { ...raw, tags: JSON.parse(raw.tags), published: raw.published === 1 };
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ───────── Confirm Modal ───────── */

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-black border border-white/20 p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
        <p className="text-sm text-white">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-sm hover:bg-white/10 px-4 py-1.5 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="bg-red-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-red-500 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Split text into lines by word count ───────── */

function splitIntoLines(text: string, wordsPerLine = 10): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(" "));
  }
  return lines;
}

const inputClass = "w-full bg-black border border-white/20 px-3 py-2 outline-none focus:border-white/40 text-sm text-white placeholder:text-white/40";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [activeTab, setActiveTab] = useState("articles");

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_key");
    if (stored) {
      setAdminKey(stored);
      setAuthed(true);
    }
  }, []);

  const handleLogin = async () => {
    setAuthError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput }),
    });
    if (res.ok) {
      setAdminKey(passwordInput);
      sessionStorage.setItem("admin_key", passwordInput);
      setAuthed(true);
    } else {
      setAuthError("Wrong password.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_key");
    setAdminKey("");
    setAuthed(false);
    setPasswordInput("");
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-full max-w-sm flex flex-col gap-4 px-4">
          <h1 className="text-xl font-semibold text-center">Admin</h1>
          <input
            type="password"
            placeholder="Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-black border border-white/20 px-4 py-2 outline-none focus:border-white/40 text-white placeholder:text-white/40"
            autoFocus
          />
          {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
          <button onClick={handleLogin} className="w-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 transition-colors">
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Content Manager</h1>
          <button onClick={handleLogout} className="inline-flex items-center gap-2 text-sm hover:bg-white/10 px-3 py-1.5 transition-colors">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>

        <div className="flex gap-0 mb-6 border-b border-white/10 overflow-x-auto">
          {TABS.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveTab(c.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === c.key ? "border-white text-white" : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {activeTab === "articles" && <ArticlesPanel adminKey={adminKey} />}
        {activeTab === "site-config" && <SiteConfigPanel adminKey={adminKey} />}
        {activeTab !== "articles" && activeTab !== "site-config" && (
          <CategoryPanel category={activeTab} adminKey={adminKey} />
        )}
      </div>
    </div>
  );
}

/* ───────── Articles Panel ───────── */

function ArticlesPanel({ adminKey }: { adminKey: string }) {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ArticleData | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/articles?all=1");
    const rows: RawArticle[] = await res.json();
    setArticles(rows.map(parseArticle));
    setLoading(false);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const allExistingTags = useMemo(() => {
    const s = new Set<string>();
    articles.forEach((a) => a.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  const handleDelete = async (slug: string) => {
    await fetch(`/api/articles/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    setDeleteTarget(null);
    fetchArticles();
  };

  const handleSave = async (article: ArticleData, isNew: boolean) => {
    if (isNew) {
      await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(article),
      });
    } else {
      await fetch(`/api/articles/${encodeURIComponent(article.slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(article),
      });
    }
    setEditing(null);
    setAdding(false);
    fetchArticles();
  };

  if (loading) return <p className="text-white/60">Loading...</p>;

  if (editing) {
    return (
      <ArticleEditor
        article={editing}
        adminKey={adminKey}
        existingTags={allExistingTags}
        onSave={(a) => handleSave(a, false)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  if (adding) {
    return (
      <ArticleEditor
        adminKey={adminKey}
        existingTags={allExistingTags}
        onSave={(a) => handleSave(a, true)}
        onCancel={() => setAdding(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {deleteTarget && (
        <ConfirmModal
          message="Are you sure you want to delete this article? This action cannot be undone."
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <button
        className="self-start inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
        onClick={() => setAdding(true)}
      >
        <Plus className="h-4 w-4" /> New Article
      </button>
      {articles.length === 0 && <p className="text-white/60">No articles yet.</p>}
      {articles.map((article) => (
        <div key={article.slug} className="border border-white/10 p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{article.title}</h3>
              <span className={`px-2 py-0.5 text-xs ${article.published ? "text-green-400 border border-green-400/30" : "text-yellow-400 border border-yellow-400/30"}`}>
                {article.published ? "Published" : "Draft"}
              </span>
            </div>
            <p className="text-sm text-white/70 mt-1">{article.excerpt}</p>
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {article.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 text-xs border border-white/15 text-white/80">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button className="inline-flex items-center justify-center size-9 hover:bg-white/10 transition-colors" onClick={() => setEditing(article)}>
              <Pencil className="h-4 w-4" />
            </button>
            <button className="inline-flex items-center justify-center size-9 hover:bg-white/10 transition-colors" onClick={() => setDeleteTarget(article.slug)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────── Article Editor ───────── */

function ArticleEditor({
  article,
  adminKey,
  existingTags,
  onSave,
  onCancel,
}: {
  article?: ArticleData;
  adminKey: string;
  existingTags: string[];
  onSave: (article: ArticleData) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [bannerUrl, setBannerUrl] = useState(article?.banner_url ?? "");
  const [tagsStr, setTagsStr] = useState(article?.tags.join(", ") ?? "");
  const [published, setPublished] = useState(article?.published ?? false);
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState<UploadMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const tagsInputRef = useRef<HTMLInputElement>(null);

  const isNew = !article;
  const articleSlug = isNew ? slugify(title) : article.slug;

  const currentTagsList = tagsStr.split(",").map((s) => s.trim()).filter(Boolean);
  const suggestedTags = existingTags.filter((t) => !currentTagsList.includes(t));

  const addTag = (tag: string) => {
    if (currentTagsList.includes(tag)) return;
    const next = currentTagsList.length > 0 ? tagsStr.trimEnd().replace(/,?\s*$/, "") + ", " + tag : tag;
    setTagsStr(next);
    tagsInputRef.current?.focus();
  };

  // Fetch uploads for this article
  const fetchUploads = useCallback(async () => {
    if (!articleSlug) return;
    const res = await fetch(`/api/uploads?article_slug=${encodeURIComponent(articleSlug)}`, {
      headers: { "x-admin-key": adminKey },
    });
    if (res.ok) {
      const rows: UploadMeta[] = await res.json();
      setUploads(rows);
    }
  }, [articleSlug, adminKey]);

  useEffect(() => {
    if (articleSlug) fetchUploads();
  }, [articleSlug, fetchUploads]);

  const renderedContent = useMemo(() => {
    return marked.parse(content) as string;
  }, [content]);

  const uploadFile = async (file: File, isBanner: boolean) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("article_slug", articleSlug);
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "x-admin-key": adminKey },
      body: fd,
    });
    if (res.ok) {
      const { url } = await res.json();
      if (isBanner) {
        setBannerUrl(url);
      } else {
        // Insert markdown image at cursor
        const ta = textareaRef.current;
        if (ta) {
          const pos = ta.selectionStart;
          const md = `![${file.name}](${url})`;
          setContent(content.substring(0, pos) + md + content.substring(pos));
        }
      }
      fetchUploads();
    }
    setUploading(false);
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, true);
    e.target.value = "";
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, false);
    e.target.value = "";
  };

  const insertMarkdown = (prefix: string, suffix = "", placeholder = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const text = selected || placeholder;
    const newContent = content.substring(0, start) + prefix + text + suffix + content.substring(end);
    setContent(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      const cursorPos = start + prefix.length + text.length;
      ta.setSelectionRange(
        selected ? cursorPos + suffix.length : start + prefix.length,
        selected ? cursorPos + suffix.length : start + prefix.length + text.length
      );
    });
  };

  const insertUploadedImage = (upload: UploadMeta) => {
    const url = `/api/uploads/${upload.id}`;
    const ta = textareaRef.current;
    if (ta) {
      const pos = ta.selectionStart;
      const md = `![${upload.filename}](${url})`;
      setContent(content.substring(0, pos) + md + content.substring(pos));
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(pos + md.length, pos + md.length);
      });
    }
  };

  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);

  const deleteUpload = async (id: string) => {
    const res = await fetch(`/api/uploads/${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    if (res.ok) {
      setUploads((prev) => prev.filter((u) => u.id !== id));
      if (bannerUrl === `/api/uploads/${id}`) setBannerUrl("");
    }
    setDeletingUploadId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;

    // Calculate text position from drop coordinates
    const ta = e.currentTarget;
    const dropPos = getDropPosition(ta, e.clientX, e.clientY);

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("article_slug", articleSlug);
    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: { "x-admin-key": adminKey },
      body: fd,
    });
    if (res.ok) {
      const { url } = await res.json();
      const md = `![${file.name}](${url})`;
      setContent((prev) => prev.substring(0, dropPos) + md + prev.substring(dropPos));
      fetchUploads();
    }
    setUploading(false);
  };

  const getDropPosition = (ta: HTMLTextAreaElement, clientX: number, clientY: number): number => {
    const rect = ta.getBoundingClientRect();
    const style = getComputedStyle(ta);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
    const charWidth = parseFloat(style.fontSize) * 0.6; // monospace approximation
    const paddingTop = parseFloat(style.paddingTop);
    const paddingLeft = parseFloat(style.paddingLeft);

    const relY = clientY - rect.top - paddingTop + ta.scrollTop;
    const relX = clientX - rect.left - paddingLeft;
    const lineIdx = Math.max(0, Math.floor(relY / lineHeight));
    const colIdx = Math.max(0, Math.floor(relX / charWidth));

    const lines = ta.value.split("\n");
    let pos = 0;
    for (let i = 0; i < Math.min(lineIdx, lines.length); i++) {
      pos += lines[i].length + 1;
    }
    if (lineIdx < lines.length) {
      pos += Math.min(colIdx, lines[lineIdx].length);
    }
    return Math.min(pos, ta.value.length);
  };

  const handleSubmit = () => {
    if (!title || !excerpt || !content) return;
    setSaving(true);
    onSave({
      slug: articleSlug,
      title,
      excerpt,
      content,
      banner_url: bannerUrl || null,
      tags: currentTagsList,
      published,
      published_at: article?.published_at ?? null,
      created_at: article?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const toolbarBtn = "inline-flex items-center justify-center size-8 hover:bg-white/10 transition-colors text-white/60 hover:text-white";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{isNew ? "New Article" : "Edit Article"}</h3>
        <button onClick={onCancel} className="text-sm hover:bg-white/10 px-3 py-1.5 transition-colors">Cancel</button>
      </div>

      {/* Meta fields */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs text-white/60 mb-1 block">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
          {isNew && title && <p className="text-xs text-white/40 mt-1">Slug: {slugify(title)}</p>}
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Excerpt</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={inputClass} rows={2} required placeholder="Short description shown in the article list..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Banner image</label>
            <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-white/60 hover:text-white"
              >
                <Upload className="h-4 w-4" />
                {bannerUrl ? "Change banner" : "Upload banner"}
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => setBannerUrl("")}
                  className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white px-2 transition-colors"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
            {bannerUrl && (
              <div className="mt-2 border border-white/10 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bannerUrl} alt="Banner preview" className="w-full max-h-32 object-cover" />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Tags (comma-separated)</label>
            <input ref={tagsInputRef} value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} className={inputClass} placeholder="rust, web, tutorial" />
            {suggestedTags.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-white/40 mb-1">Existing tags:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedTags.map((t) => (
                    <button key={t} type="button" onClick={() => addTag(t)} className="px-2 py-0.5 text-xs border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-side editor + preview */}
      <div className="grid grid-cols-2 gap-4" style={{ minHeight: "500px" }}>
        {/* Left: Editor */}
        <div className="flex flex-col min-h-0">
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 border border-white/20 border-b-0 px-2 py-1 shrink-0">
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("## ", "\n", "heading")} title="Heading">
              <Heading className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("**", "**", "bold")} title="Bold">
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("*", "*", "italic")} title="Italic">
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("`", "`", "code")} title="Inline code">
              <Code className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("[", "](url)", "link text")} title="Link">
              <Link2 className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("- ", "\n", "list item")} title="List">
              <List className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("> ", "\n", "quote")} title="Blockquote">
              <Quote className="h-4 w-4" />
            </button>
            <button type="button" className={toolbarBtn} onClick={() => insertMarkdown("```\n", "\n```\n", "code block")} title="Code block">
              <Code className="h-4 w-4" /><Code className="h-3 w-3 -ml-1.5" />
            </button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button type="button" className={toolbarBtn} onClick={() => imageInputRef.current?.click()} title="Upload image">
              <Upload className="h-4 w-4" />
            </button>
            {uploading && <span className="text-xs text-white/40 ml-2">Uploading...</span>}
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 bg-black border border-white/20 px-4 py-3 outline-none focus:border-white/40 text-sm text-white placeholder:text-white/40 font-mono leading-relaxed resize-none"
            placeholder="Write your article in markdown..."
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const ta = e.currentTarget;
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                setContent(content.substring(0, start) + "  " + content.substring(end));
                requestAnimationFrame(() => {
                  ta.selectionStart = ta.selectionEnd = start + 2;
                });
              }
            }}
          />
          {/* Uploaded images for this article */}
          {uploads.length > 0 && (
            <div className="border border-white/20 border-t-0 px-3 py-2">
              {deletingUploadId && (
                <ConfirmModal
                  message="Delete this image? It will be removed from storage and any references in your article will break."
                  onConfirm={() => deleteUpload(deletingUploadId)}
                  onCancel={() => setDeletingUploadId(null)}
                />
              )}
              <p className="text-xs text-white/40 mb-2">Uploaded images ({uploads.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {uploads.map((u) => (
                  <div key={u.id} className="shrink-0 group relative border border-white/10 hover:border-white/30 transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${u.id}`} alt={u.filename} className="h-16 w-auto object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => insertUploadedImage(u)}
                        className="p-1 hover:bg-white/20 transition-colors"
                        title="Insert image"
                      >
                        <Copy className="h-3 w-3 text-white" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingUploadId(u.id)}
                        className="p-1 hover:bg-white/20 transition-colors"
                        title="Delete image"
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="border border-white/20 p-6 overflow-y-auto">
          <p className="text-xs text-white/40 mb-4">Preview</p>
          {content ? (
            <div className="prose-custom" dangerouslySetInnerHTML={{ __html: renderedContent }} />
          ) : (
            <p className="text-sm text-white/20">Start writing to see the preview...</p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving || !title || !excerpt || !content}
          className="inline-flex items-center gap-2 bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving..." : isNew ? "Create Article" : "Save Article"}
        </button>
        <button
          type="button"
          onClick={() => setPublished(!published)}
          className={`inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium transition-colors border ${
            published ? "border-green-400/30 text-green-400 hover:bg-green-400/10" : "border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
          }`}
        >
          {published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {published ? "Published" : "Draft"}
        </button>
        <div className="ml-auto text-xs text-white/40">
          {content.split(/\s+/).filter(Boolean).length} words
        </div>
      </div>
    </div>
  );
}

/* ───────── Site Config Panel ───────── */

function SiteConfigPanel({ adminKey }: { adminKey: string }) {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [descText, setDescText] = useState("");
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/config");
    const data: SiteConfig = await res.json();
    setConfig(data);
    setDescText(data.description.join("\n"));
    setSocials(data.socials);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    const lines = splitIntoLines(descText);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ description: lines, socials }),
    });
    setSaving(false);
    setStatus("Saved!");
    setTimeout(() => setStatus(""), 2000);
  };

  if (loading || !config) return <p className="text-white/60">Loading...</p>;

  const previewLines = splitIntoLines(descText);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="font-semibold mb-3">Homepage Description</h3>
        <p className="text-xs text-white/50 mb-3">Write your description as a single block of text. It will be automatically split into animated lines (~10 words each).</p>
        <textarea value={descText} onChange={(e) => setDescText(e.target.value)} className={inputClass} rows={5} placeholder="Write your homepage description here..." />
        {previewLines.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-white/50 mb-2">Preview ({previewLines.length} lines):</p>
            <div className="border border-white/10 p-3 text-sm text-white/70">
              {previewLines.map((line, i) => (<div key={i}>{line}</div>))}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold mb-3">Social Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {["github", "linkedin", "x", "email", "instagram", "youtube", "website"].map((key) => (
            <div key={key}>
              <label className="text-xs text-white/60 mb-1 block">{key}</label>
              <input value={socials[key] ?? ""} onChange={(e) => setSocials({ ...socials, [key]: e.target.value })} placeholder={key === "email" ? "you@example.com" : "https://..."} className={inputClass} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Config"}
        </button>
        {status && <span className="text-sm text-green-400">{status}</span>}
      </div>
    </div>
  );
}

/* ───────── Category Items Panel ───────── */

function CategoryPanel({ category, adminKey }: { category: string; adminKey: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const [catRes, allRes] = await Promise.all([
      fetch(`/api/items?category=${category}`),
      fetch("/api/items"),
    ]);
    const rows: RawItem[] = await catRes.json();
    const allRows: RawItem[] = await allRes.json();
    setItems(rows.map(parseItem));
    const tags = new Set<string>();
    allRows.forEach((r) => { JSON.parse(r.tech).forEach((t: string) => tags.add(t)); });
    setAllTags(Array.from(tags).sort((a, b) => a.localeCompare(b)));
    setLoading(false);
  }, [category]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-admin-key": adminKey } });
    setDeleteTarget(null);
    fetchItems();
  };

  const handleSave = async (item: Item, isNew: boolean) => {
    if (isNew) {
      await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-key": adminKey }, body: JSON.stringify(item) });
    } else {
      await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "PUT", headers: { "Content-Type": "application/json", "x-admin-key": adminKey }, body: JSON.stringify(item) });
    }
    setEditing(null);
    setAdding(false);
    fetchItems();
  };

  if (loading) return <p className="text-white/60">Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      {deleteTarget && (
        <ConfirmModal message="Are you sure you want to delete this item? This action cannot be undone." onConfirm={() => handleDelete(deleteTarget)} onCancel={() => setDeleteTarget(null)} />
      )}
      {editing && <ItemForm item={editing} category={category} existingTags={allTags} itemCount={items.length} onSave={(item) => handleSave(item, false)} onCancel={() => setEditing(null)} />}
      {adding && <ItemForm category={category} existingTags={allTags} itemCount={items.length} onSave={(item) => handleSave(item, true)} onCancel={() => setAdding(false)} />}
      {!editing && !adding && (
        <>
          <button className="self-start inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 transition-colors" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add Item
          </button>
          {items.length === 0 && <p className="text-white/60">No items yet.</p>}
          {items.map((item) => (
            <div key={item.id} className="border border-white/10 p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-white/70 mt-1">{item.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tech.map((t) => (<span key={t} className="px-2 py-0.5 text-xs border border-white/15 text-white/80">{t}</span>))}
                </div>
                {item.notes && <p className="text-xs text-white/50 mt-2 italic">{item.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button className="inline-flex items-center justify-center size-9 hover:bg-white/10 transition-colors" onClick={() => setEditing(item)}><Pencil className="h-4 w-4" /></button>
                <button className="inline-flex items-center justify-center size-9 hover:bg-white/10 transition-colors" onClick={() => setDeleteTarget(item.id)}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ───────── Item Form ───────── */

function ItemForm({
  item, category, existingTags, itemCount, onSave, onCancel,
}: {
  item?: Item; category: string; existingTags: string[]; itemCount: number; onSave: (item: Item) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [year, setYear] = useState(item?.year ?? new Date().getFullYear());
  const [techStr, setTechStr] = useState(item?.tech.join(", ") ?? "");
  const [link, setLink] = useState(item?.link ?? "");
  const [repo, setRepo] = useState(item?.repo ?? "");
  const [live, setLive] = useState(item?.live ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const techInputRef = useRef<HTMLInputElement>(null);
  const isNew = !item;
  const currentTechList = techStr.split(",").map((s) => s.trim()).filter(Boolean);
  const suggestedTags = existingTags.filter((t) => !currentTechList.includes(t));

  const addTag = (tag: string) => {
    if (currentTechList.includes(tag)) return;
    const next = currentTechList.length > 0 ? techStr.trimEnd().replace(/,?\s*$/, "") + ", " + tag : tag;
    setTechStr(next);
    techInputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: isNew ? slugify(title) : item.id,
      category, title, description, year,
      tech: currentTechList,
      link: link || undefined, repo: repo || undefined, live: live || undefined, notes: notes || undefined,
      sort_order: isNew ? itemCount : item.sort_order,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-white/20 p-5 flex flex-col gap-3">
      <h3 className="font-semibold mb-1">{isNew ? "New Item" : "Edit Item"}</h3>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
        {isNew && title && <p className="text-xs text-white/40 mt-1">ID: {slugify(title)}</p>}
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={3} required />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Year</label>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass} required />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Tech (comma-separated)</label>
        <input ref={techInputRef} value={techStr} onChange={(e) => setTechStr(e.target.value)} className={inputClass} />
        {suggestedTags.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-white/40 mb-1">Existing tags:</p>
            <div className="flex flex-wrap gap-1">
              {suggestedTags.map((t) => (
                <button key={t} type="button" onClick={() => addTag(t)} className="px-2 py-0.5 text-xs border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-colors">+ {t}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Link</label><input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Repo</label><input value={repo} onChange={(e) => setRepo(e.target.value)} className={inputClass} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Live URL</label><input value={live} onChange={(e) => setLive(e.target.value)} className={inputClass} /></div>
      </div>
      <div><label className="text-xs text-white/60 mb-1 block">Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></div>
      <div className="flex gap-2 mt-2">
        <button type="submit" className="bg-white text-black px-4 py-1.5 text-sm font-medium hover:bg-white/90 transition-colors">{isNew ? "Create" : "Save"}</button>
        <button type="button" onClick={onCancel} className="text-sm hover:bg-white/10 px-4 py-1.5 transition-colors">Cancel</button>
      </div>
    </form>
  );
}
