import "server-only";

import { buildArticleDraft, parseArticleDraft } from "./article-draft";
import { requireAdminServer } from "./auth-server";
import { assertSafeSegment, contentsUrl, rawUrl } from "./github-paths";
import {
  getThemeImageVariant,
  parseThemeImageName,
  stripThemeImageSuffix,
} from "./theme-images";

export interface OperatorImageAsset {
  darkFilename?: string;
  darkSha?: string;
  darkUrl?: string;
  displayName: string;
  filename: string;
  markdownPath: string;
  sha: string;
  themeManaged: boolean;
  url: string;
}

interface OperatorDirectoryEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function requireWriteToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "Set GITHUB_TOKEN with repository write access to use the operator editor."
    );
  }
  return token;
}

function reportGithubError(operation: string, status: number): never {
  console.error(`[operator-content] GitHub ${operation} failed with status ${status}`);
  throw new Error(`GitHub ${operation} failed. Check your token permissions.`);
}

async function pathExists(...segments: string[]) {
  const response = await fetch(contentsUrl(...segments), {
    headers: githubHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    reportGithubError("request", response.status);
  }

  return true;
}

async function getFileContentEntry(...segments: string[]) {
  const response = await fetch(contentsUrl(...segments), {
    headers: githubHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    reportGithubError("request", response.status);
  }

  const data = await response.json();
  return Array.isArray(data) ? null : data;
}

async function getDirectoryEntries(...segments: string[]) {
  const response = await fetch(contentsUrl(...segments), {
    headers: githubHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    reportGithubError("request", response.status);
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as OperatorDirectoryEntry[]) : [];
}

async function putContent({
  encodedContent,
  message,
  pathSegments,
  sha,
}: {
  encodedContent: string;
  message: string;
  pathSegments: string[];
  sha?: string;
}) {
  requireWriteToken();

  const response = await fetch(contentsUrl(...pathSegments), {
    method: "PUT",
    headers: githubHeaders(),
    cache: "no-store",
    body: JSON.stringify({
      content: encodedContent,
      message,
      sha,
    }),
  });

  if (!response.ok) {
    reportGithubError("write", response.status);
  }

  const data = await response.json();
  return {
    sha: data.content?.sha as string | undefined,
  };
}

async function deleteContent({
  allowMissing = false,
  message,
  pathSegments,
  sha,
}: {
  allowMissing?: boolean;
  message: string;
  pathSegments: string[];
  sha: string;
}) {
  requireWriteToken();

  const response = await fetch(contentsUrl(...pathSegments), {
    method: "DELETE",
    headers: githubHeaders(),
    cache: "no-store",
    body: JSON.stringify({
      message,
      sha,
    }),
  });

  if (allowMissing && response.status === 404) {
    return;
  }

  if (!response.ok) {
    reportGithubError("delete", response.status);
  }
}

export function operatorArticlePreviewBaseUrlByPath(pathSegments: string[]) {
  return rawUrl(...pathSegments);
}

export async function getOperatorArticleDraftByPath(pathSegments: string[]) {
  const entry = await getFileContentEntry(...pathSegments, "notes.md");
  if (!entry?.content || !entry.sha) {
    return null;
  }

  const raw = Buffer.from(entry.content, "base64").toString("utf8");
  const fallbackTitle = pathSegments[pathSegments.length - 1] ?? "Untitled";
  return {
    parsed: parseArticleDraft(raw, fallbackTitle),
    raw,
    sha: entry.sha as string,
  };
}

export async function getOperatorImageAssetsByPath(
  pathSegments: string[]
): Promise<OperatorImageAsset[]> {
  const entries = await getDirectoryEntries(...pathSegments, "images");
  const imageEntries = entries
    .filter(
      (entry) =>
        entry.type === "file" &&
        /\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const entryMap = new Map(
    imageEntries.map((entry) => [entry.name as string, entry])
  );

  const assets: OperatorImageAsset[] = [];

  for (const entry of imageEntries) {
    const filename = entry.name as string;
    const parsed = parseThemeImageName(filename);

    if (parsed?.mode === "dark") {
      const lightFilename = getThemeImageVariant(filename, "light");
      if (entryMap.has(lightFilename)) {
        continue;
      }
    }

    if (parsed?.mode === "light") {
      const darkFilename = getThemeImageVariant(filename, "dark");
      const darkEntry = entryMap.get(darkFilename);

      if (darkEntry) {
        assets.push({
          darkFilename,
          darkSha: darkEntry.sha as string,
          darkUrl: rawUrl(...pathSegments, "images", darkFilename),
          displayName: stripThemeImageSuffix(filename),
          filename,
          markdownPath: `images/${filename}`,
          sha: entry.sha as string,
          themeManaged: true,
          url: rawUrl(...pathSegments, "images", filename),
        });
        continue;
      }
    }

    assets.push({
      displayName: filename,
      filename,
      markdownPath: `images/${filename}`,
      sha: entry.sha as string,
      themeManaged: false,
      url: rawUrl(...pathSegments, "images", filename),
    });
  }

  return assets;
}

export async function createOperatorArticleByPath({
  slug,
  content,
  prerequisites,
  title,
}: {
  slug: string;
  content?: string;
  prerequisites?: string[];
  title?: string;
}) {
  await requireAdminServer();
  const trimmedSlug = slug.trim();

  if (!trimmedSlug) {
    throw new Error("Article name is required.");
  }

  try {
    assertSafeSegment(trimmedSlug);
  } catch {
    throw new Error("Article name cannot contain slashes or path traversal.");
  }

  if (await pathExists(trimmedSlug)) {
    throw new Error("An article with that name already exists.");
  }

  const raw = buildArticleDraft({
    content,
    prerequisites,
    title: title?.trim() || trimmedSlug,
  });

  await putContent({
    encodedContent: Buffer.from(raw, "utf8").toString("base64"),
    message: `Create article ${trimmedSlug}`,
    pathSegments: [trimmedSlug, "notes.md"],
  });

  return { slug: trimmedSlug };
}

const ALLOWED_UPLOAD_TYPES = /^image\/(png|jpe?g|gif|webp)$/;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function detectImageMime(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function uploadOperatorImageByPath({
  articlePath,
  data,
  filename,
  mimeType,
}: {
  articlePath: string[];
  data: string;
  filename: string;
  mimeType: string;
}) {
  await requireAdminServer();
  const normalizedPath = articlePath.map((s) => s.trim()).filter(Boolean);

  if (normalizedPath.length === 0) {
    throw new Error("Article path is required.");
  }

  for (const segment of normalizedPath) {
    assertSafeSegment(segment);
  }

  if (!ALLOWED_UPLOAD_TYPES.test(mimeType)) {
    throw new Error("Unsupported image format.");
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(data, "base64");
  } catch {
    throw new Error("Invalid image data.");
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 10 MB size limit.");
  }

  const detected = detectImageMime(buffer);
  if (!detected || detected !== mimeType) {
    throw new Error("Image content does not match its declared type.");
  }

  const safeName =
    filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^\.+/, "").slice(0, 100) ||
    "upload";
  const imagePath = [...normalizedPath, "images"];

  const result = await putContent({
    encodedContent: data,
    message: `Upload ${safeName} to ${normalizedPath[normalizedPath.length - 1]}`,
    pathSegments: [...imagePath, safeName],
  });

  return {
    displayName: safeName,
    filename: safeName,
    markdownPath: `images/${safeName}`,
    sha: result.sha ?? "",
    themeManaged: false,
    url: rawUrl(...normalizedPath, "images", safeName),
  } satisfies OperatorImageAsset;
}

async function deleteTree(pathSegments: string[], label: string) {
  const entries = await getDirectoryEntries(...pathSegments);
  const directories = entries
    .filter((entry) => entry.type === "dir")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const files = entries
    .filter((entry) => entry.type === "file")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  for (const directory of directories) {
    await deleteTree([...pathSegments, directory.name], label);
  }

  for (const file of files) {
    await deleteContent({
      allowMissing: true,
      message: `Delete ${file.name} from ${label}`,
      pathSegments: [...pathSegments, file.name],
      sha: file.sha,
    });
  }
}

export async function saveOperatorArticleByPath({
  pathSegments,
  raw,
  sha,
}: {
  pathSegments: string[];
  raw: string;
  sha?: string;
}) {
  await requireAdminServer();
  const normalizedPath = pathSegments.map((segment) => segment.trim()).filter(Boolean);
  const trimmedRaw = raw.replace(/\r\n/g, "\n");

  if (normalizedPath.length === 0) {
    throw new Error("Article path is required.");
  }

  for (const segment of normalizedPath) {
    assertSafeSegment(segment);
  }

  if (!trimmedRaw.trim()) {
    throw new Error("Article content cannot be empty.");
  }

  const fallbackTitle = normalizedPath[normalizedPath.length - 1] ?? "Untitled";
  const parsed = parseArticleDraft(trimmedRaw, fallbackTitle);
  if (!parsed.title.trim()) {
    throw new Error("Article title cannot be empty.");
  }

  const result = await putContent({
    encodedContent: Buffer.from(
      trimmedRaw.endsWith("\n") ? trimmedRaw : `${trimmedRaw}\n`,
      "utf8"
    ).toString("base64"),
    message: `Update article ${fallbackTitle}`,
    pathSegments: [...normalizedPath, "notes.md"],
    sha,
  });

  return {
    sha: result.sha,
    title: parsed.title,
  };
}

export async function deleteOperatorArticleByPath(pathSegments: string[]) {
  await requireAdminServer();
  const normalizedPath = pathSegments.map((segment) => segment.trim()).filter(Boolean);

  if (normalizedPath.length === 0) {
    throw new Error("Article path is required.");
  }

  for (const segment of normalizedPath) {
    assertSafeSegment(segment);
  }

  await deleteTree(normalizedPath, `article ${normalizedPath[normalizedPath.length - 1]}`);
}

function sanitizeAssetSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

function parsePngDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Drawing must be exported as a PNG image.");
  }

  const approximateBytes = Math.ceil(match[1].length * 0.75);
  if (approximateBytes > MAX_IMAGE_BYTES) {
    throw new Error("Drawing exceeds the 10 MB size limit.");
  }

  return match[1];
}

export async function createOperatorDrawingAssetByPath({
  articlePath,
  darkDataUrl,
  lightDataUrl,
  name,
}: {
  articlePath: string[];
  darkDataUrl: string;
  lightDataUrl: string;
  name?: string;
}) {
  await requireAdminServer();
  const normalizedPath = articlePath.map((segment) => segment.trim()).filter(Boolean);

  if (normalizedPath.length === 0) {
    throw new Error("Article path is required.");
  }

  for (const segment of normalizedPath) {
    assertSafeSegment(segment);
  }

  const encodedLightContent = parsePngDataUrl(lightDataUrl);
  const encodedDarkContent = parsePngDataUrl(darkDataUrl);
  const baseName = sanitizeAssetSegment(name || "drawing") || "drawing";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sharedName = `${baseName}-${stamp}`;
  const lightFilename = `${sharedName}-light.png`;
  const darkFilename = `${sharedName}-dark.png`;
  const imagePath = [...normalizedPath, "images"];

  const lightResult = await putContent({
    encodedContent: encodedLightContent,
    message: `Add drawing ${lightFilename} to ${normalizedPath[normalizedPath.length - 1]}`,
    pathSegments: [...imagePath, lightFilename],
  });

  let darkResult: Awaited<ReturnType<typeof putContent>>;

  try {
    darkResult = await putContent({
      encodedContent: encodedDarkContent,
      message: `Add drawing ${darkFilename} to ${normalizedPath[normalizedPath.length - 1]}`,
      pathSegments: [...imagePath, darkFilename],
    });
  } catch (error) {
    if (lightResult.sha) {
      try {
        await deleteContent({
          message: `Rollback drawing ${lightFilename} after dark variant save failed`,
          pathSegments: [...imagePath, lightFilename],
          sha: lightResult.sha,
        });
      } catch {
        // Keep the original write error; rollback is best-effort.
      }
    }

    throw error;
  }

  return {
    darkFilename,
    darkSha: darkResult.sha ?? "",
    darkUrl: rawUrl(...normalizedPath, "images", darkFilename),
    displayName: `${sharedName}.png`,
    filename: lightFilename,
    markdownPath: `images/${lightFilename}`,
    sha: lightResult.sha ?? "",
    themeManaged: true,
    url: rawUrl(...normalizedPath, "images", lightFilename),
  };
}

export async function deleteOperatorImageAssetByPath({
  articlePath,
  darkFilename,
  darkSha,
  filename,
  sha,
}: {
  articlePath: string[];
  darkFilename?: string;
  darkSha?: string;
  filename: string;
  sha: string;
}) {
  await requireAdminServer();
  const normalizedPath = articlePath.map((segment) => segment.trim()).filter(Boolean);
  const trimmedFilename = filename.trim();
  const imagePath = [...normalizedPath, "images"];

  if (normalizedPath.length === 0 || !trimmedFilename || !sha) {
    throw new Error("Article path, filename, and sha are required.");
  }

  for (const segment of normalizedPath) {
    assertSafeSegment(segment);
  }
  assertSafeSegment(trimmedFilename);
  if (darkFilename?.trim()) {
    assertSafeSegment(darkFilename.trim());
  }

  if (darkFilename?.trim() && darkSha) {
    await deleteContent({
      allowMissing: true,
      message: `Delete image ${darkFilename.trim()} from ${normalizedPath[normalizedPath.length - 1]}`,
      pathSegments: [...imagePath, darkFilename.trim()],
      sha: darkSha,
    });
  }

  await deleteContent({
    allowMissing: true,
    message: `Delete image ${trimmedFilename} from ${normalizedPath[normalizedPath.length - 1]}`,
    pathSegments: [...imagePath, trimmedFilename],
    sha,
  });
}
