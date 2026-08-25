import React, {useEffect, useRef, useState } from "react";
import type { Message, chatresponse} from "./types/chat";
import "./App.css";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<chatresponse[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages]);

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setInput("");
  };

  const fetchConversation = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/chat/conversation");
      if (!res.ok) return;
      const data: chatresponse[] = await res.json();
      setConversation(data);
    } catch (error) {
      console.error("the error is", error);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchConversation);
  }, []);

  const loadConversation = async (id: string) => {
    if (isStreaming) return;
    try {
      const res = await fetch(`http://localhost:3000/api/chat/conversation/${id}`);
      if (!res.ok) throw new Error("converstion is can't load");
      const data = await res.json();
      setMessages(data.message);
      setConversationId(data._id);
      setError(null);
    } catch (error) {
      console.error('ther error is ', error);
      setError('some thing wrong')
    }
  }


  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    setError(null); //clear any previous error

    const userMessage: Message = {
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // add an empty assistant message we'll fill in as chunks arrive
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", createdAt: new Date().toISOString() },
    ]);
    try {
      const response = await fetch("http://localhost:3000/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: input,
        }),
      });

      if (!response.ok) {
        throw new Error(" Failed to send message errors from 86 line of code");
      }
      
      if (!response.body) {
        throw new Error(`No response body from server`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedAnyContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.replace("data:", "");

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.content) {
              receivedAnyContent = true;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg) {
                  lastMsg.content += parsed.content;
                }
                return updated;
              });
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
              // real error from the stream, not just an incomplete chunk
              if (jsonStr.includes("error")) throw e;
            }
          }
        }
      }

      if (!receivedAnyContent) {
        throw new Error("No content received from the server");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      // Give a clear hint for the most common failure: server not running
      const friendlyMessage = message.includes("Failed to fetch")
        ? "Can't reach the server. Is your backend running on port 3000?"
        : message;
      setError(friendlyMessage);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.role === "assistant" && updated[updated.length - 1]?.content === "") {
          updated.pop();
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      fetchConversation();
    }
  };
  const handleKeyDom = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };
  return (
    <div className="flex h-screen w-full bg-[#0b0d10] text-neutral-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-neutral-800/80 flex flex-col  bg-[#0e1013]">
        <div className="p-3">
          <button
            onClick={startNewConversation}
            disabled={isStreaming}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-lg leading-none">+</span> New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {conversation.length === 0 && (
            <div className="text-xs text-neutral-500 text-center mt-6 px-4">
              Your conversations will show up here
            </div>
          )}
          {conversation.map((conv) => (
            <button
              key={conv._id}
              onClick={() => loadConversation(conv._id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${conv._id === conversationId
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
                }`}
            >
              {conv.title || "New conversation"}
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="px-6 py-4 border-b border-neutral-800/80 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="font-medium text-neutral-200">My Personal AI</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="text-center text-neutral-500 mt-20">
                <p className="text-lg text-neutral-300 mb-1">Start a conversation</p>
                <p className="text-sm">Type a message below to begin</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-neutral-800/80 text-neutral-100 rounded-bl-md"
                    }`}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>
        </div>

        {error && (
          <div className="max-w-2xl mx-auto w-full px-6">
            <div className="mb-2 px-4 py-2.5 rounded-xl bg-red-950/50 border border-red-900/60 text-red-300 text-sm">
              {error}
            </div>
          </div>
        )}

        <div className="border-t border-neutral-800/80 px-6 py-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDom}
              placeholder="Message your AI..."
              disabled={isStreaming}
              className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-800/70 border border-neutral-700/80 outline-none focus:border-indigo-500 transition-colors placeholder:text-neutral-500 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isStreaming ? (
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;