import Foundation
import SwiftUI

@main
struct HILALDeviceApp: App {
    var body: some Scene {
        WindowGroup {
            DeviceMonitorView()
        }
    }
}

private struct DeviceSnapshot {
    let osVersion: String
    let storageFree: Int64?
    let storageTotal: Int64?
    let memoryTotal: Int64?
    let logicalCores: Int?

    static func read() -> DeviceSnapshot {
        let process = ProcessInfo.processInfo
        let version = process.operatingSystemVersion
        let osVersion = "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)"
        let memory = Int64(exactly: process.physicalMemory).flatMap { $0 > 0 ? $0 : nil }
        let cores = process.processorCount > 0 ? process.processorCount : nil
        let url = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)
        let values = try? url.resourceValues(forKeys: [
            .volumeAvailableCapacityKey, .volumeTotalCapacityKey,
        ])
        let free = values?.volumeAvailableCapacity.map(Int64.init)
        let total = values?.volumeTotalCapacity.map(Int64.init)
        if let free, let total, total > 0, free >= 0, free <= total {
            return DeviceSnapshot(osVersion: osVersion, storageFree: free,
                                  storageTotal: total, memoryTotal: memory, logicalCores: cores)
        }
        return DeviceSnapshot(osVersion: osVersion, storageFree: nil,
                              storageTotal: nil, memoryTotal: memory, logicalCores: cores)
    }
}

private struct DeviceMonitorView: View {
    @State private var snapshot = DeviceSnapshot(osVersion: "—", storageFree: nil,
                                                 storageTotal: nil, memoryTotal: nil, logicalCores: nil)
    @State private var lastChecked: Date?

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

    private var deviceName: String {
        #if os(tvOS)
        label("Cette Apple TV", "This Apple TV", "جهاز Apple TV هذا")
        #else
        label("Ce Vision Pro", "This Vision Pro", "جهاز Vision Pro هذا")
        #endif
    }

    private var systemName: String {
        #if os(tvOS)
        "tvOS"
        #else
        "visionOS"
        #endif
    }

    private func formattedBytes(_ count: Int64) -> String {
        ByteCountFormatter.string(fromByteCount: count, countStyle: .file)
    }

    private var storageIsLow: Bool {
        guard let free = snapshot.storageFree, let total = snapshot.storageTotal, total > 0 else {
            return false
        }
        return Double(free) / Double(total) < 0.1
    }

    private var lowStorageMessage: String {
        #if targetEnvironment(simulator)
        label("Stockage hôte presque plein (simulateur).",
              "Simulator host storage nearly full.",
              "تخزين الجهاز المضيف للمحاكي شبه ممتلئ.")
        #else
        label("Stockage local presque plein.",
              "Local storage is almost full.",
              "مساحة التخزين المحلية ممتلئة تقريبًا.")
        #endif
    }

    private func refresh() {
        snapshot = .read()
        lastChecked = .now
    }

    private var sectionSpacing: CGFloat {
        #if os(tvOS)
        16
        #else
        24
        #endif
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: sectionSpacing) {
                Text("HILAL")
                    .font(.largeTitle.bold())
                    .foregroundStyle(.yellow)

                Text(deviceName)
                    .font(.title2)

                if storageIsLow {
                    Text(lowStorageMessage)
                        .font(.headline)
                        .foregroundStyle(.yellow)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Système", "System", "النظام"))
                        .foregroundStyle(.secondary)
                    Text("\(systemName) \(snapshot.osVersion)")
                        .font(.title3.weight(.semibold))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Stockage local", "Local storage", "التخزين المحلي"))
                        .foregroundStyle(.secondary)
                    if let free = snapshot.storageFree, let total = snapshot.storageTotal {
                        Text("\(formattedBytes(free)) / \(formattedBytes(total))")
                            .font(.title3.weight(.semibold))
                        Text(label("libre / total", "free / total", "متاح / إجمالي"))
                            .font(.caption)
                        let used = total - free
                        let usedPercent = Int((Double(used) / Double(total) * 100).rounded())
                        ProgressView(value: Double(used), total: Double(total))
                            .tint(.yellow)
                            .accessibilityLabel(label("Stockage utilisé", "Storage used", "التخزين المستخدم"))
                        Text(label("\(usedPercent)% utilisé", "\(usedPercent)% used", "تم استخدام \(usedPercent)٪"))
                            .font(.caption)
                    } else {
                        Text(label("Mesure indisponible", "Measurement unavailable", "القياس غير متاح"))
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Mémoire physique", "Physical memory", "الذاكرة الفعلية"))
                        .foregroundStyle(.secondary)
                    if let memory = snapshot.memoryTotal {
                        Text(formattedBytes(memory))
                            .font(.title3.weight(.semibold))
                    } else {
                        Text(label("Mesure indisponible", "Measurement unavailable", "القياس غير متاح"))
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(label("Cœurs logiques", "Logical cores", "الأنوية المنطقية"))
                        .foregroundStyle(.secondary)
                    if let cores = snapshot.logicalCores {
                        Text("\(cores)")
                            .font(.title3.weight(.semibold))
                    } else {
                        Text(label("Mesure indisponible", "Measurement unavailable", "القياس غير متاح"))
                    }
                }

                #if targetEnvironment(simulator)
                Text(label("Valeurs du simulateur", "Simulator values", "قيم المحاكي"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                #endif

                HStack(spacing: 16) {
                    Button(label("Actualiser", "Refresh", "تحديث")) {
                        refresh()
                    }
                    if let lastChecked {
                        Text("\(label("Mesuré à", "Checked at", "تم القياس في")) \(lastChecked.formatted(date: .omitted, time: .standard))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: 700, alignment: .leading)
            .padding(32)
        }
        .task { refresh() }
    }
}
