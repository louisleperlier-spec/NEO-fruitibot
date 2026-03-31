import SwiftUI

struct ContentView: View {
    @StateObject private var usage = UsageTracker.shared
    @StateObject private var subscription = SubscriptionManager.shared

    @State private var question: String = ""
    @State private var result: OverthinkResponse?
    @State private var isLoading = false
    @State private var error: String?
    @State private var showPaywall = false

    private var canOverthink: Bool {
        subscription.isPremium || !usage.hasReachedLimit
    }

    var body: some View {
        ZStack {
            Color(NSColor.windowBackgroundColor)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Overthink It")
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                        Text("Because simple decisions deserve chaos")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if !subscription.isPremium {
                        Button("PRO") {
                            showPaywall = true
                        }
                        .buttonStyle(.plain)
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            LinearGradient(colors: [.purple, .pink], startPoint: .leading, endPoint: .trailing)
                        )
                        .foregroundStyle(.white)
                        .clipShape(Capsule())
                    } else {
                        Label("PRO", systemImage: "checkmark.seal.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.purple)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 14)

                Divider()

                ScrollView {
                    VStack(spacing: 16) {
                        // Input
                        VStack(alignment: .leading, spacing: 8) {
                            Text("What's keeping you up at night?")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.secondary)

                            ZStack(alignment: .topLeading) {
                                if question.isEmpty {
                                    Text("e.g. Should I reply to that email now or later?")
                                        .font(.system(size: 13))
                                        .foregroundStyle(.tertiary)
                                        .padding(.top, 8)
                                        .padding(.leading, 4)
                                        .allowsHitTesting(false)
                                }
                                TextEditor(text: $question)
                                    .font(.system(size: 13))
                                    .frame(minHeight: 64, maxHeight: 80)
                                    .scrollContentBackground(.hidden)
                            }
                            .padding(10)
                            .background(Color(NSColor.textBackgroundColor))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                            )
                        }

                        // Usage indicator (free tier)
                        if !subscription.isPremium {
                            HStack {
                                ForEach(0..<3, id: \.self) { i in
                                    Circle()
                                        .fill(i < usage.remainingFree ? Color.purple : Color.secondary.opacity(0.3))
                                        .frame(width: 8, height: 8)
                                }
                                Text(usage.remainingFree == 0
                                     ? "Daily limit reached — go PRO for unlimited"
                                     : "\(usage.remainingFree) free overthink\(usage.remainingFree == 1 ? "" : "s") left today")
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                                Spacer()
                            }
                        }

                        // Error
                        if let error {
                            Text(error)
                                .font(.system(size: 12))
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.center)
                        }

                        // CTA button
                        Button(action: overthink) {
                            HStack {
                                if isLoading {
                                    ProgressView()
                                        .scaleEffect(0.7)
                                        .tint(.white)
                                } else {
                                    Image(systemName: "brain.head.profile")
                                }
                                Text(isLoading ? "Spiraling..." : "Overthink It")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                canOverthink
                                    ? LinearGradient(colors: [.purple, .indigo], startPoint: .leading, endPoint: .trailing)
                                    : LinearGradient(colors: [.gray, .gray], startPoint: .leading, endPoint: .trailing)
                            )
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .disabled(!canOverthink || isLoading || question.trimmingCharacters(in: .whitespaces).isEmpty)

                        // Result
                        if let result {
                            ResultView(response: result)
                        }
                    }
                    .padding(20)
                }
            }
        }
        .frame(width: 400, height: 520)
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
    }

    private func overthink() {
        guard canOverthink else {
            showPaywall = true
            return
        }
        guard !question.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        isLoading = true
        error = nil
        result = nil

        Task {
            do {
                let response = try await ClaudeService.shared.overthink(question: question)
                await MainActor.run {
                    result = response
                    if !subscription.isPremium {
                        usage.recordUse()
                    }
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

struct ResultView: View {
    let response: OverthinkResponse

    var anxietyColor: Color {
        switch response.anxietyLevel {
        case 0...3: return .green
        case 4...6: return .orange
        default: return .red
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Anxiety meter
            HStack(alignment: .center, spacing: 10) {
                Text("ANXIETY LEVEL")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
                    .tracking(1)
                Spacer()
                HStack(spacing: 3) {
                    ForEach(1...10, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(i <= response.anxietyLevel ? anxietyColor : Color.secondary.opacity(0.2))
                            .frame(width: 16, height: 12)
                    }
                }
                Text("\(response.anxietyLevel)/10")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(anxietyColor)
            }

            Divider()

            // Scenarios
            VStack(alignment: .leading, spacing: 8) {
                Text("WHAT IF...")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
                    .tracking(1)

                ForEach(Array(response.scenarios.enumerated()), id: \.offset) { index, scenario in
                    HStack(alignment: .top, spacing: 8) {
                        Text("\(index + 1).")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.purple)
                            .frame(width: 16, alignment: .leading)
                        Text(scenario)
                            .font(.system(size: 12))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }

            Divider()

            // Bottom line
            VStack(alignment: .leading, spacing: 4) {
                Text("BOTTOM LINE")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
                    .tracking(1)
                Text(response.bottomLine)
                    .font(.system(size: 12, weight: .medium))
                    .italic()
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Share button
            Button(action: copyToClipboard) {
                Label("Copy for Sharing", systemImage: "square.and.arrow.up")
                    .font(.system(size: 11))
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(Color(NSColor.controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func copyToClipboard() {
        let scenarios = response.scenarios.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
        let text = """
        🧠 Overthink It — Anxiety Level \(response.anxietyLevel)/10

        What if...
        \(scenarios)

        Bottom line: \(response.bottomLine)

        — via Overthink It app
        """
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }
}
