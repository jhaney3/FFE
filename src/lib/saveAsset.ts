import { supabase } from './supabase';

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

  await supabase.from('Assets').insert([{
    name,
    item_type_id,
    photo_url,
    attributes: sorted,
    notes: notes || '',
  }]);

  return 'saved';
}
