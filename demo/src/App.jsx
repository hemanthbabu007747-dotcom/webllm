import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Download, Trash2, Bot, User } from 'lucide-react';

const WebLLMChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [engine, setEngine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const engineRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeEngine = async () => {
    setModelLoading(true);
    setLoadingProgress('Initializing Web-LLM engine...');

    try {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import * as webllm from "https://esm.run/@mlc-ai/web-llm";
        window.webllm = webllm;
      `;
      document.head.appendChild(script);

      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (window.webllm) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });

      const initProgressCallback = (progress) => {
        setLoadingProgress(progress.text || 'Loading model...');
      };

      const selectedModel = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
      
      const engineInstance = await window.webllm.CreateMLCEngine(
        selectedModel,
        { initProgressCallback }
      );

      engineRef.current = engineInstance;
      setEngine(engineInstance);
      setLoadingProgress('Model loaded successfully!');
      
      setMessages([{
        role: 'assistant',
        content: 'Hello! I\'m running entirely in your browser using Web-LLM. How can I help you today?',
        timestamp: new Date()
      }]);

      setTimeout(() => setModelLoading(false), 1000);
    } catch (error) {
      console.error('Error initializing engine:', error);
      setLoadingProgress(`Error: ${error.message}. Note: This requires WebGPU support. Try Chrome/Edge.`);
      setTimeout(() => setModelLoading(false), 3000);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !engine || isStreaming) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    const assistantMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const chatMessages = messages
        .concat(userMessage)
        .map(msg => ({ role: msg.role, content: msg.content }));

      const chunks = await engine.chat.completions.create({
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 512,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            ...newMessages[newMessages.length - 1],
            content: fullResponse
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error generating response:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          ...newMessages[newMessages.length - 1],
          content: `Error: ${error.message}`
        };
        return newMessages;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: 'Chat cleared. How can I help you?',
      timestamp: new Date()
    }]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="bg-black/30 backdrop-blur-lg border-b border-purple-500/20 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Web-LLM Chat</h1>
              <p className="text-xs text-purple-300">Running locally in your browser</p>
            </div>
          </div>
          {engine && (
            <button
              onClick={clearChat}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {modelLoading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full border border-purple-500/20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
                <Download className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Loading AI Model</h2>
              <p className="text-sm text-purple-300 text-center">{loadingProgress}</p>
              <div className="w-full bg-purple-900/30 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"></div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                First load downloads the model (~1-2GB). This may take a few minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {!engine && !modelLoading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full border border-purple-500/20">
            <div className="flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Web-LLM</h2>
                <p className="text-purple-300 mb-4">
                  Run large language models directly in your browser with no server required!
                </p>
                <ul className="text-sm text-gray-300 space-y-2 mb-6 text-left">
                  <li>✓ Complete privacy - everything runs locally</li>
                  <li>✓ No API keys needed</li>
                  <li>✓ Powered by WebGPU acceleration</li>
                  <li>✓ Works offline after initial download</li>
                </ul>
              </div>
              <button
                onClick={initializeEngine}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-purple-500/50"
              >
                Initialize AI Model
              </button>
              <p className="text-xs text-gray-500 text-center">
                Requires a modern browser with WebGPU support (Chrome/Edge)
              </p>
            </div>
          </div>
        </div>
      )}

      {engine && !modelLoading && (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-black/40 backdrop-blur-xl text-gray-100 border border-purple-500/20'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {isStreaming && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="bg-black/30 backdrop-blur-lg border-t border-purple-500/20 p-4">
            <div className="max-w-4xl mx-auto flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isStreaming}
                className="flex-1 bg-black/40 backdrop-blur-xl text-white placeholder-gray-400 rounded-xl px-4 py-3 border border-purple-500/20 focus:outline-none focus:border-purple-500 resize-none"
                rows="1"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg shadow-purple-500/50"
              >
                {isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WebLLMChatbot;