import { describe, it, expect } from 'vitest';
import { loginSchema, broadcastSchema, productSchema, maintenanceSchema, pembukuanSchema } from '../src/routes/schemas';

describe('loginSchema', () => {
  it('should accept valid credentials', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('should reject empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('broadcastSchema', () => {
  it('should accept valid broadcast', () => {
    const result = broadcastSchema.safeParse({ message: 'Hello!', target: 'all' });
    expect(result.success).toBe(true);
  });

  it('should default target to all', () => {
    const result = broadcastSchema.safeParse({ message: 'Hello!' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.target).toBe('all');
  });

  it('should reject empty message', () => {
    const result = broadcastSchema.safeParse({ message: '', target: 'all' });
    expect(result.success).toBe(false);
  });
});

describe('productSchema', () => {
  it('should accept valid product', () => {
    const result = productSchema.safeParse({
      sku: 'BRG001',
      name: 'Beras 5kg',
      priceSell: 65000,
      category: 'Sembako',
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative priceSell', () => {
    const result = productSchema.safeParse({
      sku: 'BRG001',
      name: 'Test',
      priceSell: -100,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty SKU', () => {
    const result = productSchema.safeParse({
      sku: '',
      name: 'Test',
      priceSell: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe('pembukuanSchema', () => {
  it('should accept valid pembukuan category', () => {
    const result = pembukuanSchema.safeParse({
      type: 'beban_gaji',
      amount: 5000000,
      description: 'Gaji karyawan Mei',
    });
    expect(result.success).toBe(true);
  });

  it('should reject masuk/keluar as type', () => {
    const result = pembukuanSchema.safeParse({
      type: 'masuk',
      amount: 100,
      description: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('maintenanceSchema', () => {
  it('should accept valid maintenance mode', () => {
    const result = maintenanceSchema.safeParse({ enabled: true, message: 'Maintenance' });
    expect(result.success).toBe(true);
  });

  it('should not require message', () => {
    const result = maintenanceSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });
});
