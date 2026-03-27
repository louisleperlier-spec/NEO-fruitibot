import SwiftUI

struct SettingsView: View {
    @AppStorage("claude_api_key") private var apiKey: String = ""
    @State private var showKey = false

    var body: some View {
        Form {
            Section("Claude API") {
                HStack {
                    if showKey {
                        TextField("sk-ant-...", text: $apiKey)
                    } else {
                        SecureField("sk-ant-...", text: $apiKey)
                    }
                    Button(action: { showKey.toggle() }) {
                        Image(systemName: showKey ? "eye.slash" : "eye")
                    }
                    .buttonStyle(.plain)
                }
                Text("Get your key at console.anthropic.com")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("About") {
                LabeledContent("Version", value: "1.0.0")
                LabeledContent("Model", value: "claude-haiku-4-5")
                Link("Privacy Policy", destination: URL(string: "https://example.com/privacy")!)
            }
        }
        .formStyle(.grouped)
        .frame(width: 400, height: 220)
        .navigationTitle("Settings")
    }
}
