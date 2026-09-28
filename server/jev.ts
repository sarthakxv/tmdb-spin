import { createTypeSafeAi } from "@ai-sdk/typesafe-ai"
import { experimental_evaluate } from "ai"
import type { Ask } from "./mood"

export function jevAsk(apiKey: string, mood: string): Ask {
  const model = createTypeSafeAi({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  }).evaluationModel("jev-latest")

  return async (criteria) => {
    const result = await experimental_evaluate({
      model,
      state: { mood },
      questions: {
        film: {
          type: "choice",
          instructions: "Which film best matches the mood",
          criteria,
        },
      },
    })
    return result.answers.film.choice
  }
}
