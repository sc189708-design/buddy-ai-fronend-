import React, { useEffect, useRef, useState } from "react";
import type { Message } from "./types/chat";
import "./App.css";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
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
      const response = await fetch("http://localhost:3000/api/chat/Message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: userMessage.content,
        }),
      });

      const newConvId = response.headers.get("X-Conversation-Id");
      if (newConvId) setConversationId(newConvId);

      if (!response.ok) {
        // server respsnded , but with on error status (400, 404, 500 etc);
        let errMsg = `server error (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error) errMsg = data.error;
        } catch {
          //response wasn't Json, keep defult errMsg
        }
        throw new Error(errMsg);
      }

      if (!response.body) {
        throw new Error(`No response body from server`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedAnyContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n").filter(Boolean);
        buffer = "";

        for (const line of lines) {
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
                  lastMsg.content = parsed.content;
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
    }
  };
  const handleKeyDom = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };
  return (
    <div className=" flex flex-col h-screen max-w-2xl mx-auto text-gray-100 bg-neutral-900">
      <div className="p-4 text-xl font-semibold border-b border-neutral-700">
        I'm Buddy
      </div>
      <button
        onClick={startNewConversation}
        disabled={isStreaming}
        className="px-3 py-1.5 text-sm rounded-lg bg-neutral-800 border border-neutral-600 hover:bg-neutral-600 disabled:cursor-not-allowed"
      >+ New chat</button>
      <div className=" flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg, indx) => (
          <div key={indx}
            className={`max-w-[80%] px-4 py-2 rounded-xl ${msg.role === "user" ? "self-end bg-blue-600" : "self-start bg-neutral-800"}`}
          >
            <div className="text-[11px] opacity-60 mb-1">
              {msg.role === "user" ? "you" : "Ai"}
            </div>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
      {error ? (
        <div className="px-4 py-3 text-sm text-red-300 bg-red-950/20 border-t border-red-700">
          {error}
        </div>
      ) : null}
      <div className="flex gap-2 p-4 border-t border-neutral-700">
        <input type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDom}
          placeholder="Type your message..."
          disabled={isStreaming}
          className="flex-1 px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-600 outline-none disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming}
          className="px-5 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
          {isStreaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default App;