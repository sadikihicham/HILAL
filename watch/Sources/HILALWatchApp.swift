import SwiftUI
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

    static func read() -> BatteryReading {
        let device = WKInterfaceDevice.current()
        device.isBatteryMonitoringEnabled = true
        let level = device.batteryLevel
        let percent = level.isFinite && (0...1).contains(level)
            ? Int((level * 100).rounded()) : nil
        return BatteryReading(percent: percent, state: device.batteryState)
    }
}

private struct WatchMonitorView: View {
    @State private var reading = BatteryReading(percent: nil, state: .unknown)

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
                    Text(stateLabel)
                        .font(.caption)
                } else {
                    Text(label("Batterie indisponible", "Battery unavailable", "البطارية غير متاحة"))
                        .multilineTextAlignment(.center)
                        .font(.caption)
                }

                Button(label("Actualiser", "Refresh", "تحديث")) {
                    reading = .read()
                }
                .buttonStyle(.bordered)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)
        }
        .task { reading = .read() }
    }
}
