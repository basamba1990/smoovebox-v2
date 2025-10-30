import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button-enhanced';
import { X, Send, MessageCircle } from 'lucide-react';

const FootballChatModal = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!message.trim() || loading) return;
    
    const userMessage = message.trim();
    setMessage('');
    setLoading(true);
    
    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    
    try {
      const { data, error } = await supabase.functions.invoke('football-chat', {
        body: { 
          message: userMessage,
          history: messages
        }
      });
      
      if (error) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Erreur: ${error.message}` 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data?.response || 'Désolé, je n\'ai pas pu générer de réponse.' 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Erreur: ${err.message}` 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Assistant Football</h3>
              <p className="text-sm text-gray-400">Posez vos questions sur le football</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={clearChat}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Effacer
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-blue-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Bonjour ! 👋</h4>
              <p className="text-gray-400 mb-4">
                Je suis votre assistant football. Posez-moi des questions sur :
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="font-semibold text-blue-400">⚽ Règles & Tactiques</div>
                  <div className="text-xs text-gray-400">Positions, formations, stratégies</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="font-semibold text-green-400">📊 Statistiques</div>
                  <div className="text-xs text-gray-400">Joueurs, équipes, compétitions</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="font-semibold text-purple-400">💡 Conseils</div>
                  <div className="text-xs text-gray-400">Entraînement, techniques</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="font-semibold text-orange-400">🎯 Analyse</div>
                  <div className="text-xs text-gray-400">Matchs, performances</div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question sur le football..."
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              disabled={loading}
            />
            <Button
              onClick={sendMessage}
              disabled={loading || !message.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FootballChatModal;
