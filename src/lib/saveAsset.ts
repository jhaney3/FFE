import { supabase } from './supabase';

async function copyPhotoToAssets(photoUrl: string): Promise<string | null> {
  const marker = '/inventory_photos/';
  const idx = photoUrl.indexOf(marker);
  if (idx === -1) return null;

  const sourcePath = photoUrl.slice(idx + marker.length);
  const filename = sourcePath.split('/').pop() || 'photo';
  const destPath = `assets/${crypto.randomUUID()}-${filename}`;

  const { error } = await supabase.storage
    .from('inventory_photos')
    .copy(sourcePath, destPath);

  if (error) return null;

  const { data } = supabase.storage
    .from('inventory_photos')
    .getPublicUrl(destPath);

  return data.publicUrl;
}

export async function saveAssetIfNew({
  name,
  item_type_id,
  photo_url,
  attributes,
  notes,
}: {
  name: string;
  item_type_id: string;
  photo_url?: string | null;
  attributes: string[];
  notes?: string;
}): Promise<'saved' | 'duplicate'> {
  const sorted = [...attributes].sort();

  // Fetch existing assets with the same type for this user
  const { data: existing } = await supabase
    .from('Assets')
    .select('id, attributes')
    .eq('item_type_id', item_type_id);

  if (existing) {
    const isDuplicate = existing.some(a => {
      const other = [...(a.attributes || [])].sort();
      return JSON.stringify(sorted) === JSON.stringify(other);
    });
    if (isDuplicate) return 'duplicate';
  }

  // Copy the photo into the assets/ subfolder so it has an independent lifecycle
  const assetPhotoUrl = photo_url
    ? (await copyPhotoToAssets(photo_url)) ?? photo_url
    : null;

  await supabase.from('Assets').insert([{
    name,
    item_type_id,
    photo_url: assetPhotoUrl,
    attributes: sorted,
    notes: notes || '',
  }]);

  return 'saved';
}
