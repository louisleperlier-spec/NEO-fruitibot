import StoreKit
import SwiftUI

@MainActor
class SubscriptionManager: ObservableObject {
    static let shared = SubscriptionManager()

    let productID = "com.overthink.monthly"

    @Published var isPremium: Bool = false
    @Published var product: Product?
    @Published var isLoading: Bool = false

    private var transactionListener: Task<Void, Never>?

    init() {
        transactionListener = listenForTransactions()
        Task { await loadProduct() }
        Task { await refreshStatus() }
    }

    deinit {
        transactionListener?.cancel()
    }

    func loadProduct() async {
        do {
            let products = try await Product.products(for: [productID])
            product = products.first
        } catch {
            print("Failed to load products: \(error)")
        }
    }

    func purchase() async throws {
        guard let product = product else { return }
        isLoading = true
        defer { isLoading = false }

        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else { return }
            await transaction.finish()
            isPremium = true
        case .userCancelled, .pending:
            break
        @unknown default:
            break
        }
    }

    func restorePurchases() async {
        do {
            try await AppStore.sync()
            await refreshStatus()
        } catch {
            print("Restore failed: \(error)")
        }
    }

    func refreshStatus() async {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == productID,
               transaction.revocationDate == nil {
                isPremium = true
                return
            }
        }
        isPremium = false
    }

    private func listenForTransactions() -> Task<Void, Never> {
        Task(priority: .background) {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result {
                    await transaction.finish()
                    await refreshStatus()
                }
            }
        }
    }
}
