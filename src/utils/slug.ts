export function slugify(text?: string): string {
  if (!text) return 'toko-saya';
  return (
    text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'toko-saya'
  );
}

export async function generateUniqueSlug(
  storeName: string,
  supabase: any,
  currentUserId?: string,
): Promise<string> {
  let slug = slugify(storeName);
  if (!slug) slug = 'toko-saya';

  let counter = 0;
  let candidate = slug;
  let isUnique = false;

  while (!isUnique) {
    if (counter > 0) {
      candidate = slug + '-' + counter;
    }

    let query = supabase
      .from('users')
      .select('id')
      .eq('store_slug', candidate)
      .maybeSingle();

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data: existing } = await query;

    if (!existing) {
      isUnique = true;
    } else {
      counter++;
      if (counter > 100) {
        const suffix = Math.random().toString(36).substring(2, 6);
        candidate = slug + '-' + suffix;
        break;
      }
    }
  }

  return candidate;
}
