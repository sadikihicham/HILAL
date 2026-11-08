import Foundation
import SwiftUI
import UserNotifications
import WatchKit

@main
struct HILALWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchMonitorView()
        }
    }
}

private struct BatteryReading {
    let percent: Int?
    let state: WKInterfaceDeviceBatteryState
    let osVersion: String
    let storageFree: Int64?
    let storageTotal: Int64?

    static func read() -> BatteryReading {
        let device = WKInterfaceDevice.current()
        device.isBatteryMonitoringEnabled = true
        let level = device.batteryLevel
        let percent = level.isFinite && (0...1).contains(level)
            ? Int((level * 100).rounded()) : nil
        let version = ProcessInfo.processInfo.operatingSystemVersion
        let osVersion = "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)"
        let url = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
        let values = try? url.resourceValues(forKeys: [
            .volumeAvailableCapacityKey, .volumeTotalCapacityKey,
        ])
        let free = values?.volumeAvailableCapacity.map(Int64.init)
        let total = values?.volumeTotalCapacity.map(Int64.init)
        let validStorage: (free: Int64, total: Int64)?
        if let free, let total, total > 0, free >= 0, free <= total {
            validStorage = (free, total)
        } else {
            validStorage = nil
        }
        return BatteryReading(percent: percent, state: device.batteryState,
                              osVersion: osVersion,
                              storageFree: validStorage?.free,
                              storageTotal: validStorage?.total)
    }
}

private struct WatchMonitorView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var reading = BatteryReading(percent: nil, state: .unknown,
                                                osVersion: "—", storageFree: nil, storageTotal: nil)
    @State private var alertEnabled = UserDefaults.standard.bool(forKey: "alert.lowbattery.watch")
    @State private var alertArmed = UserDefaults.standard.object(forKey: "alert.armed.watch") as? Bool ?? true

    private var language: String {
        let code = Locale.current.language.languageCode?.identifier ?? "en"
        return ["fr", "en", "ar"].contains(code) ? code : "en"
    }

    private func label(_ french: String, _ english: String, _ arabic: String) -> String {
        switch language {
        case "fr": french
        case "ar": arabic
        default: english
        }
    }

    private var stateLabel: String {
        switch reading.state {
        case .charging: label("En charge", "Charging", "قيد الشحن")
        case .full: label("Chargée", "Full", "ممتلئة")
        case .unplugged: label("Sur batterie", "On battery", "على البطارية")
        default: label("État inconnu", "State unknown", "الحالة غير معروفة")
        }
    }

    private var batteryIsLow: Bool {
        guard let percent = reading.percent else { return false }
        return percent < 15 && reading.state == .unplugged
    }

    private func refresh() {
        reading = .read()
        if reading.state != .unplugged || (reading.percent ?? 0) >= 20 {
            alertArmed = true
            UserDefaults.standard.set(true, forKey: "alert.armed.watch")
        }
        guard alertEnabled, alertArmed, batteryIsLow else { return }
        alertArmed = false
        UserDefaults.standard.set(false, forKey: "alert.armed.watch")
        Task { await sendLowBatteryAlert() }
    }

    private func sendLowBatteryAlert() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard alertEnabled else { return }
        guard settings.authorizationStatus == .authorized else {
            alertEnabled = false
            UserDefaults.standard.set(false, forKey: "alert.lowbattery.watch")
            alertArmed = true
            UserDefaults.standard.set(true, forKey: "alert.armed.watch")
            return
        }
        let content = UNMutableNotificationContent()
        content.title = label("Batterie faible", "Low battery", "البطارية منخفضة")
        content.body = label("La montre est sous 15 % et hors charge.",
                             "This watch is below 15% and unplugged.",
                             "شحن الساعة أقل من ١٥٪ وهي غير موصولة بالشاحن.")
        content.sound = .default
        let request = UNNotificationRequest(identifier: "hilal-watch-low-battery",
                                            content: content,
                                            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
        do {
            try await center.add(request)
            if !alertEnabled {
                center.removePendingNotificationRequests(withIdentifiers: [request.identifier])
            }
        } catch {
            alertArmed = true
            UserDefaults.standard.set(true, forKey: "alert.armed.watch")
        }
    }

    private func changeAlert(_ enabled: Bool) async {
        if enabled {
            let center = UNUserNotificationCenter.current()
            do {
                let granted = try await center.requestAuthorization(options: [.alert, .sound])
                let settings = await center.notificationSettings()
                alertEnabled = granted && settings.authorizationStatus == .authorized
            } catch {
                alertEnabled = false
            }
        } else {
            alertEnabled = false
            alertArmed = true
            UserDefaults.standard.set(true, forKey: "alert.armed.watch")
            UNUserNotificationCenter.current().removePendingNotificationRequests(
                withIdentifiers: ["hilal-watch-low-battery"])
        }
        UserDefaults.standard.set(alertEnabled, forKey: "alert.lowbattery.watch")
        if alertEnabled { refresh() }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("HILAL")
                    .font(.headline.bold())
                    .foregroundStyle(.yellow)

                Text(label("Cette montre", "This watch", "هذه الساعة"))
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let percent = reading.percent {
                    Text("\(percent)%")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .accessibilityLabel(label("Batterie \(percent) pour cent", "Battery \(percent) percent", "البطارية \(percent) بالمئة"))
                    ProgressView(value: Double(percent), total: 100)
                        .tint(.yellow)
                        .accessibilityLabel(label("Niveau de batterie", "Battery level", "مستوى البطارية"))
                    Text(stateLabel)
                        .font(.caption)
                    if batteryIsLow {
                        Text(label("Batterie faible — rechargez la montre.",
                                   "Low battery — charge this watch.",
                                   "البطارية منخفضة — اشحن الساعة."))
                            .font(.caption2.bold())
                            .foregroundStyle(.orange)
                    }
                } else {
                    Text(label("Batterie indisponible", "Battery unavailable", "البطارية غير متاحة"))
                        .multilineTextAlignment(.center)
                        .font(.caption)
                }

                Text("watchOS \(reading.osVersion)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Text(label("Stockage local", "Local storage", "التخزين المحلي"))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if let free = reading.storageFree, let total = reading.storageTotal {
                    Text("\(ByteCountFormatter.string(fromByteCount: free, countStyle: .file)) / \(ByteCountFormatter.string(fromByteCount: total, countStyle: .file))")
                        .font(.caption2)
                        .multilineTextAlignment(.center)
                    let used = total - free
                    let usedPercent = Int((Double(used) / Double(total) * 100).rounded())
                    ProgressView(value: Double(used), total: Double(total))
                        .tint(.yellow)
                        .accessibilityLabel(label("Stockage utilisé", "Storage used", "التخزين المستخدم"))
                    Text(label("\(usedPercent)% utilisé", "\(usedPercent)% used", "تم استخدام \(usedPercent)٪"))
                        .font(.caption2)
                } else {
                    Text(label("Mesure indisponible", "Measurement unavailable", "القياس غير متاح"))
                        .font(.caption2)
                }

                #if targetEnvironment(simulator)
                Text(label("Valeurs du simulateur", "Simulator values", "قيم المحاكي"))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                #endif

                Button(label("Actualiser", "Refresh", "تحديث")) {
                    refresh()
                }
                .buttonStyle(.bordered)

                Toggle(isOn: Binding(get: { alertEnabled }, set: { enabled in
                    Task { await changeAlert(enabled) }
                })) {
                    Text(label("Alerte batterie", "Battery alert", "تنبيه البطارية"))
                        .font(.caption2)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)
        }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            refresh()
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(60)) }
                catch { break }
                refresh()
            }
        }
    }
}
