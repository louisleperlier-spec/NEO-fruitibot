import Foundation

struct OverthinkResponse {
    let anxietyLevel: Int
    let scenarios: [String]
    let bottomLine: String
    let rawText: String
}

class ClaudeService {
    static let shared = ClaudeService()

    private let apiURL = URL(string: "https://api.anthropic.com/v1/messages")!

    // API key stored in UserDefaults (user sets it in Settings)
    var apiKey: String {
        UserDefaults.standard.string(forKey: "claude_api_key") ?? ""
    }

    private let systemPrompt = """
    You are OverthinkIt, an AI that catastrophizes simple decisions with dark humor and existential dread — but in a funny, relatable way.

    When the user gives you any decision or situation (no matter how mundane), you must:
    1. Assign an ANXIETY LEVEL from 1–10 (always higher than warranted)
    2. List exactly 5 "What if..." scenarios — each escalating in absurdity
    3. End with a BOTTOM LINE that is dramatic, unhelpful, yet oddly comforting

    Rules:
    - Be witty and funny, not actually distressing
    - Reference real-world consequences that spiral from the mundane to the cosmic
    - Keep each scenario to 1–2 sentences max
    - The bottom line must be 1 sentence, start with "So basically..."
    - Respond ONLY in this exact format, no extra text:

    ANXIETY_LEVEL: [number]
    SCENARIO_1: [text]
    SCENARIO_2: [text]
    SCENARIO_3: [text]
    SCENARIO_4: [text]
    SCENARIO_5: [text]
    BOTTOM_LINE: [text]
    """

    func overthink(question: String) async throws -> OverthinkResponse {
        guard !apiKey.isEmpty else {
            throw ClaudeError.missingAPIKey
        }

        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let body: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 500,
            "system": systemPrompt,
            "messages": [
                ["role": "user", "content": question]
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ClaudeError.invalidResponse
        }
        guard httpResponse.statusCode == 200 else {
            throw ClaudeError.apiError(httpResponse.statusCode)
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String else {
            throw ClaudeError.parseError
        }

        return parseResponse(text)
    }

    private func parseResponse(_ text: String) -> OverthinkResponse {
        var anxietyLevel = 7
        var scenarios: [String] = []
        var bottomLine = "So basically... good luck with that."

        let lines = text.components(separatedBy: "\n")
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("ANXIETY_LEVEL:") {
                let val = trimmed.replacingOccurrences(of: "ANXIETY_LEVEL:", with: "").trimmingCharacters(in: .whitespaces)
                anxietyLevel = Int(val) ?? 7
            } else if trimmed.hasPrefix("SCENARIO_") {
                let parts = trimmed.components(separatedBy: ":")
                if parts.count >= 2 {
                    let scenario = parts.dropFirst().joined(separator: ":").trimmingCharacters(in: .whitespaces)
                    scenarios.append(scenario)
                }
            } else if trimmed.hasPrefix("BOTTOM_LINE:") {
                bottomLine = trimmed.replacingOccurrences(of: "BOTTOM_LINE:", with: "").trimmingCharacters(in: .whitespaces)
            }
        }

        return OverthinkResponse(
            anxietyLevel: anxietyLevel,
            scenarios: scenarios,
            bottomLine: bottomLine,
            rawText: text
        )
    }
}

enum ClaudeError: LocalizedError {
    case missingAPIKey
    case invalidResponse
    case apiError(Int)
    case parseError

    var errorDescription: String? {
        switch self {
        case .missingAPIKey: return "No API key set. Go to Settings to add your Claude API key."
        case .invalidResponse: return "Invalid response from server."
        case .apiError(let code): return "API error (status \(code)). Check your API key."
        case .parseError: return "Could not parse response."
        }
    }
}
