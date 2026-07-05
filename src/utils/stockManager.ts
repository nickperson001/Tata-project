import supabase from '../config/supabase';
import { addLog, getIO } from '../config/state';
import { recordSale } from './transactionRecorder';
import { withTransaction } from './db';
import type { PoolClient } from 'pg';

// ── Helpers ──
function formatQty(qty: number, unit: string): string {
  const num = parseFloat(String(qty)) || 0;
  if (['kg', 'liter', 'gram', 'ml'].includes(unit)) {
    return num.toFixed(2).replace(/\.?0+$/, '');
  }
  return Math.floor(num).toString();
}

// ── Product Management ──

interface AddProductData {
  sku: string;
  name: string;
  category?: string;
  unit?: string;
  priceBuy?: number;
  priceSell?: number;
  stockInitial?: number;
  stockMin?: number;
  description?: string;
}

interface UpdateProductData {
  name?: string;
  category?: string;
  unit?: string;
  price_buy?: number;
  price_sell?: number;
  stock_min?: number;
  description?: string;
  is_active?: boolean;
}

interface ListFilters {
  active?: boolean;
  category?: string;
  lowStock?: boolean;
}

interface StockMovementData {
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdBy?: string;
}

interface Result {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

async function addProduct(
  userId: string,
  data: AddProductData,
): Promise<{ success: boolean; product?: unknown; error?: string }> {
  const { sku, name, category, unit, priceBuy, priceSell, stockInitial, stockMin, description } = data;
  if (!sku || !name) {
    return { success: false, error: 'SKU dan nama produk wajib diisi.' };
  }
  try {
    return await withTransaction(async (client) => {
      const prod = await client.query(
        `INSERT INTO products (user_id, sku, name, category, unit, price_buy, price_sell, stock_current, stock_min, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId,
          sku.toUpperCase(),
          name,
          category || 'Umum',
          unit || 'pcs',
          priceBuy || 0,
          priceSell || 0,
          stockInitial || 0,
          stockMin || 0,
          description || null,
        ],
      );
      const product = prod.rows[0];
      const initialStock = stockInitial || 0;
      if (initialStock > 0) {
        await client.query(
          `INSERT INTO stock_movements (user_id, product_id, type, quantity, stock_before, stock_after, reference_type, note, created_by)
           VALUES ($1, $2, 'in', $3, 0, $3, 'initial', 'Stock awal saat produk ditambahkan', 'system')`,
          [userId, product.id, initialStock],
        );
      }
      return { success: true, product, error: undefined };
    });
  } catch (err: any) {
    if (err?.code === '23505' || (err.message && err.message.includes('duplicate key'))) {
      addLog('warn', `[STOCK] addProduct: SKU "${sku}" sudah digunakan`);
      return { success: false, error: `SKU "${sku}" sudah digunakan. Gunakan SKU lain.` };
    }
    addLog('error', '[STOCK] addProduct error: ' + (err.message || err));
    return { success: false, error: err.message || err };
  }
}

async function updateProduct(
  userId: string,
  productId: string,
  updates: UpdateProductData,
): Promise<{ success: boolean; product?: unknown; error?: string }> {
  try {
    const allowed = ['name', 'category', 'unit', 'price_buy', 'price_sell', 'stock_min', 'description', 'is_active'];
    const payload: Record<string, unknown> = {};
    Object.keys(updates).forEach((k) => {
      if (allowed.includes(k)) payload[k] = (updates as any)[k];
    });
    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'Tidak ada data yang diupdate.' };
    }
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return { success: true, product: data, error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function deleteProduct(userId: string, productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId)
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true, error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getProduct(
  userId: string,
  skuOrId: string,
): Promise<{ success: boolean; product?: unknown; error?: string }> {
  try {
    let query = supabase.from('products').select('*').eq('user_id', userId);
    if (isNaN(Number(skuOrId))) {
      query = (query as any).eq('sku', skuOrId.toUpperCase());
    } else {
      query = (query as any).eq('id', parseInt(skuOrId));
    }
    const { data, error } = await (query as any).single();
    if (error) throw error;
    return { success: true, product: data, error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function listProducts(
  userId: string,
  filters: ListFilters = {},
): Promise<{ success: boolean; products?: unknown[]; error?: string }> {
  try {
    let query: any = supabase.from('products').select('*').eq('user_id', userId);
    if (filters.active !== undefined) query = query.eq('is_active', filters.active);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.lowStock) query = query.filter('stock_current', 'lt', 'stock_min');
    query = query.order('name', { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, products: data || [], error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Smart Product Search ──

async function searchProductByName(
  userId: string,
  query: string,
): Promise<{ success: boolean; products: unknown[]; error?: string }> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: false, products: [], error: 'Kata kunci pencarian minimal 2 karakter.' };
    }
    const searchTerm = query.trim();
    const safeTerm = searchTerm.replace(/[%_]/g, '\\$&');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .ilike('name', `%${safeTerm}%`)
      .order('name', { ascending: true });
    if (error) throw error;
    return { success: true, products: data || [], error: undefined };
  } catch (err: any) {
    addLog('error', '[STOCK] searchProductByName error: ' + err.message);
    return { success: false, products: [], error: err.message };
  }
}

// ── Execute Sale ──

async function executeSale(
  userId: string,
  productId: string,
  quantity: number,
  channel = 'Offline',
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data: product, error: prodErr } = (await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()) as any;
    if (prodErr || !product) {
      return { success: false, error: 'Produk tidak ditemukan atau tidak aktif.' };
    }
    const qty = parseFloat(String(quantity));
    const priceSell = parseFloat(product.price_sell) || 0;
    const priceBuy = parseFloat(product.price_buy) || 0;
    if (qty <= 0) {
      return { success: false, error: 'Jumlah harus lebih dari 0.' };
    }
    const totalOmzet = qty * priceSell;
    const totalModal = qty * priceBuy;
    const profit = totalOmzet - totalModal;
    const description = `Penjualan ${product.name} (${formatQty(qty, product.unit)} ${product.unit})`;
    const result = await recordSale({
      userId,
      productId,
      quantity: qty,
      priceSell,
      priceBuy,
      totalOmzet,
      description,
      referenceType: 'cashier',
      channel,
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const saleData = result.data as any;
    try {
      const bomResult = await deductPackaging(userId, qty, description);
      if (bomResult.warnings && bomResult.warnings.length > 0) {
        addLog('info', '[BOM] Packaging deducted for ' + userId + ': ' + bomResult.warnings.join(', '));
      }
    } catch (bomErr: any) {
      addLog('error', '[BOM] deductPackaging failed (non-blocking): ' + (bomErr.message || bomErr));
    }
    return {
      success: true,
      data: {
        product,
        qty,
        unit: product.unit,
        priceSell,
        priceBuy,
        totalOmzet: saleData.totalOmzet,
        totalModal: saleData.totalModal,
        profit: saleData.profit,
        stockBefore: saleData.stockBefore,
        stockAfter: saleData.stockAfter,
        description,
      },
      error: undefined,
    };
  } catch (err: any) {
    addLog('error', '[STOCK] executeSale error: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── Stock Movement ──

async function logStockMovement(userId: string, productId: string, data: StockMovementData): Promise<boolean> {
  try {
    const { error } = await supabase.from('stock_movements').insert([
      {
        user_id: userId,
        product_id: productId,
        type: data.type,
        quantity: data.quantity,
        stock_before: data.stockBefore,
        stock_after: data.stockAfter,
        reference_type: data.referenceType,
        reference_id: data.referenceId,
        note: data.note,
        created_by: data.createdBy || 'system',
      },
    ] as any);
    if (error) {
      addLog('error', '[STOCK] logStockMovement error: ' + error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    addLog('error', '[STOCK] logStockMovement exception: ' + err.message);
    return false;
  }
}

async function getStockHistory(
  userId: string,
  productId: string,
  limit = 50,
): Promise<{ success: boolean; movements?: unknown[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { success: true, movements: data || [], error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Stock Alerts ──

async function createStockAlert(
  userId: string,
  productId: string,
  alertType: string,
  stockLevel: number,
): Promise<void> {
  try {
    const { data: recent } = (await supabase
      .from('stock_alerts')
      .select('id')
      .eq('product_id', productId)
      .eq('user_id', userId)
      .eq('alert_type', alertType)
      .is('resolved_at', null)
      .gte('alerted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle()) as any;
    if (recent) return;
    await supabase.from('stock_alerts').insert([
      {
        user_id: userId,
        product_id: productId,
        alert_type: alertType,
        stock_level: stockLevel,
      },
    ] as any);

    const io = getIO();
    if (io) {
      io.to(userId).emit('stock_alert', { userId, productId, alertType, stockLevel });
    }
  } catch (err: any) {
    addLog('error', '[STOCK] createStockAlert error: ' + err.message);
  }
}

async function resolveStockAlerts(productId: string, userId?: string): Promise<void> {
  try {
    let query: any = supabase
      .from('stock_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('product_id', productId)
      .is('resolved_at', null);
    if (userId) query = query.eq('user_id', userId);
    await query;
  } catch (err: any) {
    addLog('error', '[STOCK] resolveStockAlerts error: ' + err.message);
  }
}

async function getPendingAlerts(userId: string): Promise<{ success: boolean; alerts?: unknown[]; error?: string }> {
  try {
    let query: any = supabase
      .from('stock_alerts')
      .select('*, products (id, sku, name, unit, stock_current, stock_min)')
      .is('resolved_at', null)
      .order('alerted_at', { ascending: false });
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, alerts: data || [], error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Stock Report ──

async function generateStockReport(userId: string): Promise<Result> {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    let totalValue = 0;
    const byCategory: Record<string, { count: number; value: number; items: unknown[] }> = {};
    (products || []).forEach((p: any) => {
      const value = parseFloat(p.stock_current) * parseFloat(p.price_buy);
      totalValue += value;
      if (!byCategory[p.category]) {
        byCategory[p.category] = { count: 0, value: 0, items: [] };
      }
      byCategory[p.category].count++;
      byCategory[p.category].value += value;
      byCategory[p.category].items.push(p);
    });
    return { success: true, totalProducts: products.length, totalValue, byCategory, products, error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── BOM ──

interface AddMaterialData {
  name: string;
  unit?: string;
  stockCurrent?: number;
  stockMin?: number;
  costPerUnit?: number;
}

async function addMaterial(
  userId: string,
  data: AddMaterialData,
): Promise<{ success: boolean; material?: unknown; error?: string }> {
  const { name, unit, stockCurrent, stockMin, costPerUnit } = data;
  if (!name) return { success: false, error: 'Nama material wajib diisi.' };
  try {
    const { data: material, error } = await supabase
      .from('bom_materials')
      .insert([
        {
          user_id: userId,
          name,
          unit: unit || 'pcs',
          stock_current: parseFloat(String(stockCurrent)) || 0,
          stock_min: parseFloat(String(stockMin)) || 0,
          cost_per_unit: parseFloat(String(costPerUnit)) || 0,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return { success: true, material, error: undefined };
  } catch (err: any) {
    addLog('error', '[BOM] addMaterial error: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function listMaterials(userId: string): Promise<{ success: boolean; materials?: unknown[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('bom_materials')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return { success: true, materials: data || [], error: undefined };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function setRecipe(
  userId: string,
  materialId: string,
  qtyPerOrder: number,
): Promise<{ success: boolean; recipe?: unknown; error?: string }> {
  try {
    const qty = parseFloat(String(qtyPerOrder));
    if (isNaN(qty) || qty <= 0) {
      return { success: false, error: 'Jumlah per order harus lebih dari 0.' };
    }
    const { data: existing } = (await supabase
      .from('bom_recipes')
      .select('id')
      .eq('user_id', userId)
      .eq('material_id', materialId)
      .maybeSingle()) as any;
    let recipe: unknown;
    let error: any;
    if (existing) {
      const result = await supabase
        .from('bom_recipes')
        .update({ quantity_per_order: qty, auto_deduct: true })
        .eq('id', existing.id)
        .select()
        .single();
      recipe = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('bom_recipes')
        .insert([
          {
            user_id: userId,
            material_id: materialId,
            quantity_per_order: qty,
            auto_deduct: true,
          },
        ])
        .select()
        .single();
      recipe = result.data;
      error = result.error;
    }
    if (error) throw error;
    return { success: true, recipe, error: undefined };
  } catch (err: any) {
    addLog('error', '[BOM] setRecipe error: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getRecipes(userId: string): Promise<{ success: boolean; recipes: unknown[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('bom_recipes')
      .select('*, bom_materials(id, name, unit, stock_current)')
      .eq('user_id', userId)
      .eq('auto_deduct', true);
    if (error) throw error;
    return { success: true, recipes: data || [], error: undefined };
  } catch (err: any) {
    return { success: false, recipes: [], error: err.message };
  }
}

async function deductPackaging(
  userId: string,
  orderQty = 1,
  referenceNote = '',
): Promise<{ success: boolean; deducted: any[]; warnings: string[]; error?: string }> {
  const deducted: any[] = [];
  const warnings: string[] = [];
  try {
    const recipeResult = await getRecipes(userId);
    if (!recipeResult.success || (recipeResult.recipes as any[]).length === 0) {
      return { success: true, deducted, warnings: ['Belum ada resep BOM diatur.'] };
    }
    for (const recipe of recipeResult.recipes as any[]) {
      const material = recipe.bom_materials;
      if (!material) continue;
      const MAX_BOM_RETRIES = 3;
      for (let bomAttempt = 0; bomAttempt < MAX_BOM_RETRIES; bomAttempt++) {
        const { data: freshMaterial } = (await supabase
          .from('bom_materials')
          .select('stock_current')
          .eq('id', material.id)
          .single()) as any;
        const currentStock = freshMaterial
          ? parseFloat(freshMaterial.stock_current) || 0
          : parseFloat(material.stock_current) || 0;
        const qtyNeeded = parseFloat(recipe.quantity_per_order) * orderQty;
        const stockBefore = currentStock;
        const stockAfter = stockBefore - qtyNeeded;
        const updateResult = (await supabase
          .from('bom_materials')
          .update({ stock_current: Math.max(0, stockAfter), updated_at: new Date().toISOString() })
          .eq('id', material.id)
          .eq('user_id', userId)
          .eq('stock_current', stockBefore)) as any;
        const updateErr = updateResult.error;
        const updateCount = updateResult.count;
        if (updateErr) {
          warnings.push(`Gagal kurangi ${material.name}: ${updateErr.message}`);
          break;
        }
        if (updateCount === 0 && bomAttempt < MAX_BOM_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 30 * (bomAttempt + 1)));
          continue;
        }
        await supabase.from('bom_deduction_logs').insert([
          {
            user_id: userId,
            material_id: material.id,
            quantity: qtyNeeded,
            stock_before: stockBefore,
            stock_after: Math.max(0, stockAfter),
            reference_type: 'sale',
            reference_note: referenceNote,
          },
        ] as any);
        deducted.push({
          name: material.name,
          deducted: qtyNeeded,
          stockBefore,
          stockAfter: Math.max(0, stockAfter),
          unit: material.unit,
        });
        if (stockAfter <= 0) warnings.push(`⚠️ Material *${material.name}* HABIS! Segera restock.`);
        else if (stockAfter <= parseFloat(material.stock_min))
          warnings.push(
            `⚠️ Material *${material.name}* menipis (sisa ${formatQty(stockAfter, material.unit)} ${material.unit}).`,
          );
        break;
      }
    }
    return { success: true, deducted, warnings, error: undefined };
  } catch (err: any) {
    addLog('error', '[BOM] deductPackaging error: ' + err.message);
    return { success: false, deducted, warnings, error: err.message };
  }
}

export {
  addProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  listProducts,
  searchProductByName,
  executeSale,
  getStockHistory,
  getPendingAlerts,
  resolveStockAlerts,
  generateStockReport,
  formatQty,
  addMaterial,
  listMaterials,
  setRecipe,
  getRecipes,
  deductPackaging,
};
