import { supabase, errorMessage, DEMO } from './supabase';
import { demoBlobs } from '@/demo/server';
import type { FileRef } from './types';

export type PublicBucket = 'avatars' | 'gig-media' | 'portfolio';
export type PrivateBucket = 'chat-files' | 'deliveries' | 'payment-proofs' | 'verification-docs';

const MAX: Record<string, number> = {
  avatars: 5, 'gig-media': 25, portfolio: 50, 'chat-files': 50, deliveries: 200, 'payment-proofs': 10, 'verification-docs': 10,
};

function safeName(name: string) {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const base = name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'file';
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base}${ext ? '.' + ext : ''}`;
}

/** Uploads to `<folder>/<uniqueName>`. Folder must match the bucket's storage policy. */
export async function uploadFile(bucket: PublicBucket | PrivateBucket, folder: string, file: File | Blob, name?: string): Promise<FileRef> {
  const fileName = name ?? (file instanceof File ? file.name : 'file');
  if (file.size > MAX[bucket] * 1048576) throw new Error(`That file is too large — the maximum is ${MAX[bucket]} MB.`);
  const path = `${folder}/${safeName(fileName)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(errorMessage(error));
  return { path, name: fileName, size: file.size, mime: file.type };
}

export function publicUrl(bucket: PublicBucket, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Resizes big photos and converts them to WebP in the browser (much smaller, same visible quality).
    GIFs, SVGs, small files and anything the browser can't decode are uploaded unchanged. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 250 * 1024 || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } catch { return file; }
}

export async function uploadPublic(bucket: PublicBucket, userId: string, file: File) {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Only images or videos are allowed');
  if (file.type.startsWith('image/')) file = await compressImage(file, bucket === 'avatars' ? 512 : 1600);
  const ref = await uploadFile(bucket, userId, file);
  if (DEMO) return demoBlobs.get(`${bucket}/${ref.path}`) ?? publicUrl(bucket, ref.path);
  return publicUrl(bucket, ref.path);
}

const signedCache = new Map<string, { url: string; exp: number }>();
/** Short-lived (10 min) signed URL for private files. */
export async function signedUrl(bucket: PrivateBucket, path: string): Promise<string> {
  const key = `${bucket}/${path}`;
  if (DEMO) { const b = demoBlobs.get(key); if (b) return b; throw new Error('Sample file — not available in the preview'); }
  const hit = signedCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data) throw new Error(errorMessage(error));
  signedCache.set(key, { url: data.signedUrl, exp: Date.now() + 540_000 });
  return data.signedUrl;
}

export async function openPrivateFile(bucket: PrivateBucket, path: string) {
  const url = await signedUrl(bucket, path);
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click();
}
