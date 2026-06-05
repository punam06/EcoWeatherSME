/**
 * ═══════════════════════════════════════════════════════════════
 * ECOSORTHA AI — AGENT PANEL COMPONENT (React / JavaScript)
 * File: Frontend and UI/components/AgentPanel/AgentPanel.jsx
 *
 * Fully modular self-contained component for Next.js / Vite.
 * Uses exact standard CSS colors and animations matching dashboard.
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef } from 'react';

const IS_LOCAL_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
const BACKEND_URL = IS_LOCAL_DEV ? 'http://localhost:5001' : 'https://ecosortha.onrender.com';

export default function AgentPanel({ setTab, products, setVerificationBatchId, setVerificationDispatchZone, currentUser, authToken }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('ecosortha_agent_panel_messages');
      if (saved) return JSON.parse(saved);
    }
    return [
      {
        role: 'assistant',
        type: 'TEXT',
        content: 'Hello! I am your EcoSortha AI Agricultural Assistant. How can I help you with BARI compliance, product catalog searches, or order dispatches today?'
      }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ecosortha_agent_panel_session_id') || '';
    }
    return '';
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [language, setLanguage] = useState('bn');
  const [voiceSupported, setVoiceSupported] = useState(true);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Persist messages
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ecosortha_agent_panel_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Persist session ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionId) {
        sessionStorage.setItem('ecosortha_agent_panel_session_id', sessionId);
      } else {
        sessionStorage.removeItem('ecosortha_agent_panel_session_id');
      }
    }
  }, [sessionId]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
    }
  }, []);

  // Initialize Session
  const initSession = async () => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('ecosortha_agent_panel_session_id')) {
      console.log("[AgentPanel] Restoring existing session:", sessionStorage.getItem('ecosortha_agent_panel_session_id'));
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/chat/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ farmerId: currentUser ? currentUser.id : undefined })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setSessionId(resData.data.sessionId);
      }
    } catch (err) {
      console.warn('Failed to initialize session:', err);
    }
  };

  // Close Session
  const endSession = async () => {
    if (!sessionId) return;
    try {
      await fetch(`${BACKEND_URL}/api/ai/chat/end`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ sessionId })
      });
      setSessionId('');
    } catch (err) {
      console.warn('Failed to end session:', err);
    }
  };

  // Handle Toggle Panel Open/Closed
  const togglePanel = () => {
    if (!isOpen) {
      initSession();
      setIsOpen(true);
    } else {
      endSession();
      setIsOpen(false);
    }
  };

  // Send message to agent backend
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    // Append user message locally
    setMessages((prev) => [...prev, { role: 'user', type: 'TEXT', content: text }]);
    if (!textToSend) setInputValue('');
    setIsProcessing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/agent/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          query: text,
          language,
          sessionId: sessionId || undefined,
          farmerId: currentUser ? currentUser.id : undefined
        })
      });
      const resData = await response.json();

      if (resData.success && resData.data) {
        const agentData = resData.data;

        // Append assistant response locally
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            type: agentData.type,
            content: agentData.message,
            products: agentData.products,
            pendingOrder: agentData.pendingOrder,
            orderResult: agentData.orderResult,
            navigationTarget: agentData.navigationTarget,
            rawOrders: agentData.rawOrders,
            helpTopic: agentData.helpTopic
          }
        ]);

        // Handle navigation routing dynamically
        if (agentData.type === 'NAVIGATION' && agentData.navigationTarget) {
          setTimeout(() => {
            const target = agentData.navigationTarget.toLowerCase();
            if (target.includes('marketplace') || target.includes('market')) {
              setTab(6);
            } else if (target.includes('dashboard')) {
              setTab(0);
            } else if (target.includes('order')) {
              setTab(1);
            } else if (target.includes('verification')) {
              setTab(2);
            } else if (target.includes('climate') || target.includes('forecast')) {
              setTab(3);
            }
          }, 1500);
        }
      }
    } catch (err) {
      console.warn('Failed to get agent response:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          type: 'TEXT',
          content: language === 'bn' ? 'দুঃখিত, সংযোগে কিছু সমস্যা হচ্ছে।' : 'Sorry, I am facing connection issues.'
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Web Speech API Recording handler
  const handleVoiceInput = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;
    recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={togglePanel}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#2d6a4f',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 4px 14px rgba(45, 106, 79, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 9.8a7 7 0 0 1-9 8.2z"></path>
          </svg>
        </button>
      )}

      {/* Chat window panel */}
      {isOpen && (
        <div
          style={{
            width: 360,
            height: 520,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-hover)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-primary)',
              background: 'var(--bg-header)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}></div>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>EcoSortha AI Agent</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setLanguage((l) => (l === 'en' ? 'bn' : 'en'))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  border: '1px solid var(--border-primary)',
                  background: 'var(--bg-input)',
                  color: '#10B981',
                  cursor: 'pointer'
                }}
              >
                {language === 'en' ? 'EN' : 'বাং'}
              </button>
              <button onClick={togglePanel} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
          </div>

          {/* Messages scroll section */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: isAssistant ? 'flex-start' : 'flex-end' }}>
                  
                  {/* TEXT TYPE */}
                  {msg.type === 'TEXT' && (
                    <div style={{ padding: '10px 14px', borderRadius: isAssistant ? '14px 14px 14px 2px' : '14px 14px 2px 14px', background: isAssistant ? 'var(--bg-input)' : '#2d6a4f', color: isAssistant ? 'var(--text-primary)' : '#ffffff', fontSize: 12.5, lineHeight: 1.45, maxWidth: '85%', border: isAssistant ? '1px solid var(--border-primary)' : 'none' }}>
                      {msg.content}
                    </div>
                  )}

                  {/* PRODUCT LIST TYPE */}
                  {msg.type === 'PRODUCT_LIST' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '90%' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{msg.content}</div>
                      {msg.products && msg.products.map((prod, pIdx) => (
                        <div key={pIdx} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{prod.name}</span>
                            <span style={{ fontWeight: 700, color: '#10B981', fontSize: 13 }}>৳{prod.price_bdt}</span>
                          </div>
                          <button onClick={() => handleSendMessage(`${pIdx + 1}`)} style={{ marginTop: 4, padding: '6px', borderRadius: 6, background: '#2d6a4f', color: '#ffffff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'center' }}>
                            {language === 'bn' ? 'নির্বাচন করুন' : 'Select Product'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ORDER CONFIRM PROMPT */}
                  {msg.type === 'ORDER_CONFIRM_PROMPT' && msg.pendingOrder && (
                    <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border-primary)', width: '90%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)' }}>{language === 'bn' ? '📝 পেন্ডিং অর্ডার বিবরণী' : '📝 Order Details'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        <div><strong>Item:</strong> {msg.pendingOrder.productName}</div>
                        <div><strong>Qty:</strong> {msg.pendingOrder.quantity} bags</div>
                        <div><strong>Total BDT:</strong> ৳{msg.pendingOrder.totalBdt}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleSendMessage('yes')} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#10B981', color: '#ffffff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 11 }}>Confirm ✓</button>
                        <button onClick={() => handleSendMessage('no')} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#EF4444', color: '#ffffff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 11 }}>Cancel ✗</button>
                      </div>
                    </div>
                  )}

                  {/* ORDER SUCCESS TYPE */}
                  {msg.type === 'ORDER_SUCCESS' && (
                    <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 2px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', color: '#10B981', fontSize: 12.5, maxWidth: '85%' }}>
                      🎉 {msg.content}
                    </div>
                  )}

                  {/* ORDER CANCELLED TYPE */}
                  {msg.type === 'ORDER_CANCELLED' && (
                    <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 2px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', color: 'var(--text-muted)', fontSize: 12.5, maxWidth: '85%' }}>
                      ✕ {msg.content}
                    </div>
                  )}

                  {/* AUTH REQUIRED TYPE */}
                  {msg.type === 'AUTH_REQUIRED' && (
                    <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 2px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #F59E0B', color: '#F59E0B', fontSize: 12.5, maxWidth: '85%' }}>
                      ⚠️ {msg.content}
                    </div>
                  )}

                  {/* NAVIGATION TYPE */}
                  {msg.type === 'NAVIGATION' && (
                    <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 2px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3B82F6', color: '#3B82F6', fontSize: 12.5, maxWidth: '85%' }}>
                      🚀 {msg.content}
                    </div>
                  )}
                  {/* APP HELP TYPE */}
                  {msg.type === 'APP_HELP' && (
                    <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 2px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3B82F6', color: 'var(--text-primary)', fontSize: 12.5, maxWidth: '85%' }}>
                      <div style={{ fontWeight: 700, color: '#3B82F6', marginBottom: 6 }}>ℹ️ {msg.helpTopic ? msg.helpTopic.toUpperCase() : 'GUIDANCE'}</div>
                      <div style={{ lineHeight: 1.5 }}>{msg.content}</div>
                    </div>
                  )}

                  {/* ORDER STATUS TYPE */}
                  {msg.type === 'ORDER_STATUS' && (
                    <div style={{ padding: '12px', borderRadius: '12px 12px 12px 2px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', width: '90%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{msg.content}</div>
                      {msg.rawOrders && msg.rawOrders.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>RECENT ORDERS</div>
                          {msg.rawOrders.map((order, idx) => (
                            <div key={idx} style={{ padding: '8px', background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                              <span><strong style={{color:'var(--text-primary)'}}>{order.product_name}</strong> ({order.quantity}x)</span>
                              <span style={{color: order.status === 'delivered' ? '#10B981' : '#F59E0B', fontWeight:600}}>{order.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
            
            {isProcessing && (
              <div style={{ display: 'flex', gap: 4, padding: 8 }}>
                <span style={{ fontSize: 14 }}>⏳</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>EcoSortha Agent thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input row */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-primary)', background: 'var(--bg-header)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="text" placeholder={language === 'bn' ? 'মেসেজ লিখুন...' : 'Type your message...'} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} disabled={isProcessing} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 12.5, outline: 'none' }} />
            {voiceSupported && <button onClick={handleVoiceInput} disabled={isProcessing} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${isRecording ? '#EF4444' : 'var(--border-primary)'}`, background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary)', color: isRecording ? '#EF4444' : '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>🎤</button>}
            <button onClick={() => handleSendMessage()} disabled={isProcessing || !inputValue.trim()} style={{ padding: '8px 14px', borderRadius: 8, background: '#2d6a4f', color: '#ffffff', fontWeight: 700, border: 'none', fontSize: 12.5, cursor: 'pointer', opacity: !inputValue.trim() ? 0.6 : 1 }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
