declare module 'ai' {
  export class DefaultChatTransport<UI_MESSAGE = any> {
    constructor(options?: {
      api?: string;
      body?: any;
      headers?: any;
      fetch?: typeof fetch;
      prepareSendMessagesRequest?: (options: any) => Promise<any> | any;
    });
    sendMessages(options: any): Promise<any>;
    processResponseStream(stream: ReadableStream<Uint8Array>): ReadableStream<any>;
  }

  export interface UIMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content?: string;
    parts?: Array<{
      type: string;
      text?: string;
      toolName?: string;
      toolCallId?: string;
      state?: string;
      input?: any;
      output?: any;
      url?: string;
      title?: string;
      data?: any;
      mediaType?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  }
}

