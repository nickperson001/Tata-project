import os from 'os';
import { state, addLog, getSupabase } from '../config/state';

async function sendEmergencyBroadcast(reason: string): Promise<void> {
  if (state.emergencySent) return;
  state.emergencySent = true;

  const supabase = getSupabase();

  const emergencyMsg = `⚠️ *[SISTEM DARURAT]*\n\nMaaf Bos, server sedang mengalami gangguan/restart.\nMohon tunda pencatatan selama 5 menit.\n\n🔧 Alasan: ${reason}\n🕐 Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' } as any)}\n\nBot akan kembali online secara otomatis. Terima kasih! 🙏`;

  try {
    if (state.waClient && state.clientReady) {
      let adminWa = process.env.ADMIN_WA_NUMBER || null;
      if (!adminWa && supabase) {
        try {
          const { data: adminProfile } = await supabase
            .from('user_profiles').select('admin_wa_number')
            .not('admin_wa_number', 'is', null).limit(1).single() as any;
          if (adminProfile && adminProfile.admin_wa_number) adminWa = adminProfile.admin_wa_number;
        } catch (_: any) { addLog('error', `[EMERGENCY] admin_wa_number lookup failed: ${_.message}`); }
      }
      if (adminWa) {
        const adminMsg = `🚨 *[ADMIN ALERT — TATA BUSINESS SUITE]*\n\n⚠️ Server mengalami gangguan!\n\n🔧 Alasan: ${reason}\n🕐 Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' } as any)}\n🖥️ Host: ${os.hostname()}\n💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n⏱️ Uptime: ${Math.floor(process.uptime())}s\n\nSistem sedang mencoba recovery otomatis.`;
        const adminTarget = adminWa.includes('@') ? adminWa : `${adminWa.replace(/[^0-9]/g, '')}@c.us`;
        try { await state.waClient.sendMessage(adminTarget, adminMsg); } catch (_: any) { addLog('error', `[EMERGENCY] admin alert send failed: ${_.message}`); }
      }
    }
  } catch (adminErr: any) {
    addLog('error', `[EMERGENCY] Admin last-gasp failed: ${adminErr.message}`);
  }

  try {
    if (!state.waClient || !state.clientReady || !supabase) return;
    const { data: users } = await supabase.from('users').select('id').limit(50) as any;
    if (!users) return;

    for (const u of users) {
      try {
        await state.waClient.sendMessage(u.id, emergencyMsg);
      } catch (_: any) { addLog('error', `[EMERGENCY] broadcast send to ${u.id} failed: ${_.message}`); }
      await new Promise(r => setTimeout(r, 300));
    }
    addLog('info', `[EMERGENCY] Broadcast sent to ${users.length} users. Reason: ${reason}`);
  } catch (err: any) {
    addLog('error', `[EMERGENCY] Failed to send broadcast: ${err.message}`);
  }
}

export { sendEmergencyBroadcast };
