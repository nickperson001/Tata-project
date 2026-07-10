import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Bot, Loader2 } from 'lucide-react';
import { useStockStore } from '../../store/stockStore';
import { stockApi } from '../../services/api';
import { Z } from '../../lib/zIndex';

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: 'ai', text: 'Halo! Ada yang bisa saya bantu? Tanya tentang stok, penjualan, atau laporan keuangan.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useStockStore();
  const chatEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const sendMessage = async () => {
    if (!input.trim() || !token) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await stockApi.post<{ reply: string }>('/api/stock/chat', token, { message: msg });
      setMessages(prev => [...prev, { role: 'ai', text: res.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Maaf, terjadi kesalahan. Coba lagi nanti.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-wrapper" style={{ zIndex: Z.CHATBOT }}>
      {open && (
        <div ref={panelRef} className="chatbot-panel">
          <div className="chatbot-header">
            <Bot size={18} />
            <span>Tata AI Assistant</span>
            <button className="chatbot-close" onClick={() => setOpen(false)} style={{ marginLeft: 'auto' }}>
              <X size={18} />
            </button>
          </div>

          <div className="chatbot-body">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === 'ai' && <Bot size={14} />}
                <span>{m.text}</span>
              </div>
            ))}
            {loading && (
              <div className="chat-msg ai">
                <Loader2 size={14} className="spin" /> Memproses...
              </div>
            )}
            <div ref={chatEnd} />
          </div>
          <div className="chatbot-input">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Tanya sesuatu..."
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button className="chatbot-fab" onClick={() => setOpen(!open)}>
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}

