import SwiftUI

struct PaywallView: View {
    @StateObject private var subscription = SubscriptionManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var purchasing = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            ZStack {
                LinearGradient(
                    colors: [.purple.opacity(0.8), .indigo],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                VStack(spacing: 8) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 40))
                        .foregroundStyle(.white)
                    Text("Overthink It PRO")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("Because 3 spirals a day is not enough")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.8))
                }
                .padding(.vertical, 30)
            }
            .frame(maxWidth: .infinity)

            // Features
            VStack(alignment: .leading, spacing: 14) {
                FeatureRow(icon: "infinity", title: "Unlimited overthinking", subtitle: "Spiral as much as your heart desires")
                FeatureRow(icon: "sparkles", title: "Priority AI responses", subtitle: "Faster catastrophizing, 24/7")
                FeatureRow(icon: "square.and.arrow.up", title: "Shareable results", subtitle: "Spread the anxiety with friends")
                FeatureRow(icon: "heart.fill", title: "Support indie dev", subtitle: "Keep this app running and anxious")
            }
            .padding(24)

            Divider()

            // Pricing & CTA
            VStack(spacing: 12) {
                if let product = subscription.product {
                    VStack(spacing: 4) {
                        Text(product.displayPrice)
                            .font(.system(size: 28, weight: .bold))
                        Text("per month · cancel anytime")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("$3.99 / month")
                        .font(.system(size: 28, weight: .bold))
                    Text("cancel anytime")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(.red)
                }

                Button(action: purchase) {
                    HStack {
                        if purchasing {
                            ProgressView().scaleEffect(0.8).tint(.white)
                        }
                        Text(purchasing ? "Processing..." : "Start Overthinking")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        LinearGradient(colors: [.purple, .indigo], startPoint: .leading, endPoint: .trailing)
                    )
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .disabled(purchasing)

                HStack(spacing: 16) {
                    Button("Restore Purchases") {
                        Task { await subscription.restorePurchases() }
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)

                    Button("Cancel") { dismiss() }
                        .buttonStyle(.plain)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
        }
        .frame(width: 360)
        .onChange(of: subscription.isPremium) { _, isPremium in
            if isPremium { dismiss() }
        }
    }

    private func purchase() {
        purchasing = true
        errorMessage = nil
        Task {
            do {
                try await subscription.purchase()
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
            await MainActor.run { purchasing = false }
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(.purple)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
    }
}
