import Foundation

class UsageTracker: ObservableObject {
    static let shared = UsageTracker()

    private let freeLimit = 3
    private let countKey = "overthink_daily_count"
    private let dateKey = "overthink_last_date"

    @Published var usedToday: Int = 0

    init() {
        resetIfNewDay()
        usedToday = UserDefaults.standard.integer(forKey: countKey)
    }

    var remainingFree: Int {
        max(0, freeLimit - usedToday)
    }

    var hasReachedLimit: Bool {
        usedToday >= freeLimit
    }

    func recordUse() {
        resetIfNewDay()
        usedToday += 1
        UserDefaults.standard.set(usedToday, forKey: countKey)
    }

    private func resetIfNewDay() {
        let today = Calendar.current.startOfDay(for: Date())
        let lastDate = UserDefaults.standard.object(forKey: dateKey) as? Date ?? Date.distantPast
        if today > Calendar.current.startOfDay(for: lastDate) {
            UserDefaults.standard.set(0, forKey: countKey)
            UserDefaults.standard.set(today, forKey: dateKey)
            usedToday = 0
        }
    }
}
