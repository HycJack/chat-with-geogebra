import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createDeepSeek } from "@ai-sdk/deepseek"
import { streamText } from "ai"
import { logger } from "@/lib/logger"

// 在函数开头添加调试日志
export async function POST(req: Request) {
  try {
    logger.api("收到聊天请求")
    const { messages, configSettings } = await req.json()
    logger.api("请求数据", {
      messageCount: messages.length,
      modelType: configSettings?.modelType,
      systemPromptLength: configSettings?.systemPrompt?.length,
    })

    // Default to OpenAI GPT-4o if no config is provided configSettings?.modelType ||
    const modelType =  "DeepSeek-V3-0324"
    const systemPrompt =
      configSettings?.systemPrompt ||
      "你是一个专注于数学和GeoGebra的助手。帮助用户理解数学概念并使用GeoGebra进行可视化。"

    // 获取对应模型的API密钥
    let apiKey = ""
    if (modelType.startsWith("claude")) {
      apiKey = configSettings?.apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY || ""
      logger.api("使用Anthropic API密钥", { keyLength: apiKey?.length || 0 })
    }
    //  else if (modelType.startsWith("deepseek")) {
    //   apiKey = configSettings?.apiKeys?.deepseek || process.env.DEEPSEEK_API_KEY || ""
    //   logger.api("使用DeepSeek API密钥", { keyLength: apiKey?.length || 0 })
    // } 
    else {
      // OpenAI 和其他模型
      apiKey = configSettings?.apiKeys?.openai || process.env.OPENAI_API_KEY || ""
      logger.api("使用OpenAI API密钥", { keyLength: apiKey?.length || 0 })
    }

    if (!apiKey) {
      logger.error("错误 - 缺少API密钥")
      return new Response(JSON.stringify({ error: "需要 API 密钥，请在设置中配置对应模型的 API 密钥" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Select the appropriate model based on the configuration
    let model, the_model

    try {
      if (modelType.startsWith("claude")) {
        // For Claude models
        logger.api("初始化Claude模型", { model: modelType })
        the_model = createAnthropic({apiKey})
      } else if (modelType.startsWith("deepseek")) {
        // For DeepSeek models modelType === "deepseek-chat" ? "deepseek-chat" :
        const deepseekModel =  "deepseek-coder"
        logger.api("初始化DeepSeek模型", { model: deepseekModel })
        the_model = createDeepSeek({apiKey})
      } else {
        // For OpenAI models (default)
        logger.api("初始化OpenAI模型", { model: modelType })
        the_model = createOpenAI({baseURL: "http://lanz.hikvision.com/v3/openai/deepseek-v3", apiKey: "LanzOpenAI_b65f6e11-ae53-4dcf-96c0-42daa3ae1b51"})
      }
    } catch (error) {
      logger.error("初始化模型错误:", error)
      return new Response(JSON.stringify({ error: "初始化模型失败，请检查API密钥和模型配置" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    model = the_model(modelType)

    logger.api("创建流式响应")
    // Create a stream using the AI SDK
    try {
      const result = streamText({
        model,
        system: systemPrompt,
        messages,
      })

      logger.api("返回流式响应")
      // Return the stream response
      return result.toDataStreamResponse({
        headers: {
          "Transfer-Encoding": "chunked",
          Connection: "keep-alive"
        }
      })
    } catch (error) {
      logger.error("创建流式响应错误:", error)
      return new Response(JSON.stringify({ error: "创建聊天流失败，请检查网络连接" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  } catch (error) {
    logger.error("聊天API错误:", error)
    return new Response(JSON.stringify({ error: "处理聊天请求失败", details: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

