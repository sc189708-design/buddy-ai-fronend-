export interface Message {
    role: "user" | "assistant";
    content: string;
    createdAt: string;
}

export interface chatresponse {
    _id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

export interface ChatReply {
    conversation: string;
    reply: string;
    message: Message[];
}